const express = require("express");
const bodyParser = require("body-parser");
const fileUpload = require('express-fileupload');
const openid = require('openid');
const fs = require("fs");
const generateUid = require("uid-safe");

const webDir = "./web";
const steamOpenId = "https://steamcommunity.com/openid";
const allowedMime = [
	"audio/webm",
	"audio/ogg",
	"video/ogg",
	"application/ogg",
	"audio/mpeg"
];

class WebApp {
	constructor(baseUrl, port){
		if(!baseUrl.endsWith("/"))
			baseUrl += "/";
		this.baseUrl = baseUrl;
		this.port = port;
		this.expressApp = express();
		this.log = [];

		this.sessions = new Map();

		this.expressApp.use(bodyParser.json());
		this.expressApp.use(fileUpload());
		this.expressApp.use(express.static(webDir));

		this.expressApp.get("/log", (req, res) => {
			res.set("Content-Type", "text/plain");
			for(let line of this.log){
				res.write(line);
			}
			res.end();
		});

		this.expressApp.listen(port);
	}

	appendToLog(text){
		this.log.push(text);
	}

	startRestApi(steamchat, soundsDbGw){
		// Debug screenshot of page
		this.expressApp.get("/screen", async (req, res) => {
			let image = steamchat.getPage().screenshot({type: "png"});
			res.set("Content-Type", "image/png");
			res.write(await image);
			res.end();
		});

		this.expressApp.post("/api/playSoundUrl", (req, res) => {
			if(req.body && req.body.url){
				steamchat.playSoundUrl(req.body.url);
			} else {
				res.status(400);
			}
			res.end();
		});

		this.expressApp.post("/api/uploadSound", async (req, res) => {
			try {
				if(req.body && req.body.name && req.files){
					let steamid = this.sessions.get(req.get("Session"));
					if(!steamid)
						return res.status(401).end();
					let groupId = await steamchat.getGroupIdByName(steamchat.groupName);
					if(!groupId)
						return res.status(500).end();
					let members = await steamchat.getGroupMembers(groupId);
					let member = members.find((m) => m.steamid64 == steamid);
					if(!member)
						return res.status(403).end();
				
					if(allowedMime.includes(req.files.sound.mimetype)){
						await soundsDbGw.insert(req.body.name, req.files.sound.data, req.files.sound.mimetype);
					} else 
						res.status(415).send("Unsupported Media Type").end();
				} else {
					res.status(400);
				}
				res.end();
			} catch(e) {
				console.log(e);
				res.status(500).json(e).end();
			}
		});

		this.expressApp.get("/api/sounds", async (req, res) => {
			/*fs.readdir(webDir + "/sounds", (error, files) => {
				if(error){
					res.status(500);
					res.write(error);
					res.end();
				} else {
					//TODO: Check what is file and what is directory.
					res.json(files);
					res.end();
				}
			});*/
			res.json(await soundsDbGw.selectList()).end();
		});

		this.expressApp.get("/api/sounds/:soundName", async (req, res) => {
			try {
				let file = await soundsDbGw.selectOne(req.params.soundName);
				res.set("Content-Type", file.mime);
				res.write(file.data);
				res.end();
			} catch(e){
				res.status(500).send(e).end();
			}
		});

		this.expressApp.post("/api/sounds/:soundName/play", (req, res) => {
			steamchat.playSoundUrl("http://localhost:" + this.port + "/api/sounds/" + req.params.soundName);
		});
	}

	startSteamLoginApi(){
		this.relyingParty = new openid.RelyingParty(
			this.baseUrl + "api/steam/verify", // Verification URL (yours)
			this.baseUrl, 	// Realm (optional, specifies realm for OpenID authentication)
			true, 		// Use stateless verification
			true, 		// Strict mode
			[]			// List of extensions to enable and include
		);

		this.expressApp.get('/api/steam/authenticate', (req, res) => {
			this.relyingParty.authenticate(steamOpenId, false, (error, authUrl) => {
				if(error){
					res.json(error);
					return;
				}
				res.redirect(authUrl);
			});
		});

		this.expressApp.get("/api/steam/verify", (req, res) => {
			this.relyingParty.verifyAssertion(req, async (error, result) => {
				if(error){
					res.json(error);
					return;
				}
				let uid = await generateUid(18);
				this.sessions.set(uid, result.claimedIdentifier.substr(steamOpenId.length + 4)); // 4 == "/id/".length
				res.write(`<!DOCTYPE HTML><html><head>
					<script>localStorage.setItem("authId", ${JSON.stringify(uid)});close();</script>
				</head></html>`);
				res.end();
			});
		});
	}
}

module.exports = WebApp;