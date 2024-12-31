//@ts-check
import http from "http";
import https from "https";
import url from "url";
import Express from "express";
import("express-async-errors");
import BodyParser from "body-parser";
import fileUpload from "express-fileupload";
import openid from "openid";
import generateUid from "uid-safe";
import config from "./config-loader.js";
import UserInfo from "./dto/user-info.js";
import ytdl from "@distube/ytdl-core";

const webDir = "./web";
const steamOpenId = "https://steamcommunity.com/openid";
const allowedMime = [
	"audio/webm",
	"audio/ogg",
	"video/ogg",
	"application/ogg",
	"audio/mpeg",
	"audio/mp3"
];

export default class WebApp {
	/**
	 * @param {?string} baseUrl
	 * @param {number} port
	 */
	constructor(baseUrl, port){
		if(!baseUrl?.endsWith("/"))
			baseUrl += "/";
		this.baseUrl = baseUrl ?? `http://localhost:${port}/`;
		this.port = port;
		this.expressApp = Express();
		this.log = [];

		this.sessions = new Map();

		this.expressApp.use((req, res, next) => {
			res.set("Access-Control-Allow-Origin", "*");
			next();
		});
		this.expressApp.use(BodyParser.json());
		this.expressApp.use(BodyParser.text());
		this.expressApp.use(fileUpload());
		this.expressApp.use(Express.static(webDir));

		this.browserScripts = "";
		this.expressApp.get("/api/browserScripts", (req, res) => {
			res.type("text/javascript");
			res.write(this.browserScripts);
			res.end();
		});

		this.expressApp.get("/log", (req, res) => {
			res.set("Content-Type", "text/plain");
			for(let line of this.log){
				res.write(line);
			}
			res.end();
		});

		// Proxy endpoint used to add Access-Control-Allow-Origin header to sound requests.
		this.expressApp.get("/api/proxy/:url", async (req, res) => {
			/*                        ▼ Insert "What the hell is this?" meme */
			if(!["172.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress || ""))
				return res.status(403).send("Nope").end();

			let parsedUrl = url.parse(req.params.url);
			let provider = null
			if(parsedUrl.protocol == "https:")
				provider = https;
			else if(parsedUrl.protocol == "http:")
				provider = http;
			if(provider == null)
				throw new Error("No provider for protocol \"" + parsedUrl.protocol + "\"");
			let request = provider.request(parsedUrl, (result) => {
				res.statusCode = result.statusCode ?? 500;
				for(let header of Object.entries(result.headers))
					if(header[1] && header[0].toLowerCase() !== "access-control-allow-origin")
						res.set(header[0], header[1]);
				res.set("Access-Control-Allow-Origin", "*");

				result.on("data", (chunk) => {
					res.write(chunk);
				});
				result.on("end", () => {
					res.end();
				});
			});
			request.end();
		});

		this.expressApp.get("/api/ytdl/:url", async (req, res) => {
			if(!["172.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress || ""))
				return res.status(403).send("Nope").end();

			let info = await ytdl.getInfo(req.params.url);
			info.formats = ytdl.filterFormats(info.formats, "audio");

			// Keep only formats that return ok status
			info.formats = await Promise.all(
				info.formats.map(f => fetch(f.url, { method: "HEAD" }).then(r => r.ok ? f: null))
			).then(a => a.filter(f => f));
			// Choose one final format for playing
			info.formats = [ ytdl.chooseFormat(info.formats, {}) ];
			
			res.status(200);
			res.set("Access-Control-Allow-Origin", "*");
			res.set("Content-Type", info.formats[0].mimeType);

			// Download and pipe to response
			ytdl.downloadFromInfo(info).pipe(res);
		});

		this.expressApp.listen(port);
	}
	
	setupPageScreen(page){
		// Debug screenshot of page
		page.setViewport({width: 1024, height: 900});
		this.expressApp.get(["/screen", "/screen.png"], async (req, res) => {
			let image = page.screenshot({type: "png"});
			res.set("Content-Type", "image/png");
			res.write(await image);
			res.end();
		});

		this.expressApp.get("/html", async (req, res) => {
			let html = `<!DOCTYPE html>
				<html class="responsive web_chat_frame fullheight">
				<head>
				<meta name="theme-color" content="#171a21">
				<link href="https://steamcommunity-a.akamaihd.net/public/shared/css/motiva_sans.css?v=FAK4O46_mOLB" rel="stylesheet" type="text/css" >
				<link href="https://steamcommunity-a.akamaihd.net/public/shared/css/shared_global.css?v=5OoDLCYZma2O" rel="stylesheet" type="text/css" >
				<link href="https://steamcommunity-a.akamaihd.net/public/css/webui/friends.css?v=vCn_VIISkvcx" rel="stylesheet" type="text/css" >
				</head>`;
			html += await page.evaluate(() => document.body.outerHTML);
			html += `</html>`;
			res.setHeader("Content-Type", "utf8");
			res.write(html);
			res.end();
		});
	}

	appendToLog(text){
		this.log.push("[" + (new Date()).toLocaleString("en-GB") + "] " + text);
	}

	addBrowserScript(func){
		this.browserScripts += "("+func.toString()+")();";
	}

	/**
	 * 
	 * @param {import("./beepboop.js").default} beepboop
	 */
	startRestApi(beepboop){
		this.expressApp.post("/api/playSoundUrl", async (req, res) => {
			if(req.body?.url){
				await beepboop.steamChatAudio.playSoundUrl(req.body.url);
			} else {
				res.status(400);
			}
			res.end();
		});

		this.expressApp.post("/api/play", (req, res) => {
			beepboop.steamChatAudio.resumeSound().catch(console.error);
			res.end();
		});

		this.expressApp.post("/api/stop", (req, res) => {
			beepboop.steamChatAudio.stopSound().catch(console.error);
			res.end();
		});

		this.expressApp.post("/api/uploadSound", async (req, res) => {
			try {
				if(req.body?.name && req.files){
					let steamid = this.sessions.get(req.get("Session"));
					if(!steamid)
						return res.status(401).send("Not logged in.").end();
					if(!beepboop.config.steam?.groupName)
						throw new Error("Cannot check permissions, group is not configured.")
					let groupId = await beepboop.steamChat.getGroupIdByName(beepboop.config.steam.groupName);
					if(!groupId)
						return res.status(500).end();
					let members = await beepboop.steamChat.getGroupMembers(groupId);
					let member = members.find((m) => m.steamid == steamid);
					if(!member)
						return res.status(403).send("Not member of group.").end();
				
					if(req.files.sound instanceof Array)
						res.status(415).send("Only one file can be uploaded.").end();
					else {
						if(allowedMime.includes(req.files.sound.mimetype)){
							await beepboop.soundsDbGw?.insert(req.body.name, req.files.sound.data, req.files.sound.mimetype);
						} else 
							res.status(415).send("Unsupported Media Type.").end();
					}
				} else {
					res.status(400).send("Missing data.");
				}
				res.end();
			} catch(e) {
				console.log(e);
				res.status(500).json(e).end();
			}
		});

		this.expressApp.get("/api/sounds", async (req, res) => {
			res.json(await beepboop.soundsDbGw?.selectList()).end();
		});

		this.expressApp.get("/api/sounds/:soundName", async (req, res) => {
			try {
				let file = await beepboop.soundsDbGw?.selectOne(req.params.soundName);
				res.set("Content-Type", file.mime);
				res.set("Access-Control-Allow-Origin", "https://steam-chat.com");
				res.write(file.data);
				res.end();
			} catch(e){
				res.status(500).send(e).end();
			}
		});

		this.expressApp.post("/api/sounds/:soundName/play", async (req, res) => {
			await beepboop.steamChatAudio.playSoundUrl("http://localhost:" + this.port + "/api/sounds/" + req.params.soundName);
			res.end();
		});

		this.expressApp.get("/api/members", async (req, res) => {
			if(!beepboop.config.steam?.groupName)
				res.json([]);
			else {
				let groupId = await beepboop.steamChat.getGroupIdByName(beepboop.config.steam.groupName);
				res.json(await beepboop.steamChat.getGroupMembers(groupId));
			}
			res.end();
		});

		this.expressApp.get("/api/user/sounds/:type", async (req, res) => {
			if(req.params.type){
				let steamid = this.sessions.get(req.get("Session"));
				if(!steamid)
					return res.status(401).send("Not logged in.").end();
				let type = beepboop.soundsDbGw?.SoundType[req.params.type.toUpperCase()];
				if(typeof(type) === "undefined")
					return res.status(400).send("Unknown type.").end();
				res.json(await beepboop.soundsDbGw?.selectUserSounds(steamid, type));
				res.end();
			}
		});

		this.expressApp.post("/api/user/sounds/:type/:soundName", async (req, res) => {
			if(req.body && req.params.soundName && req.params.type){
				let steamid = this.sessions.get(req.get("Session"));
				if(!steamid)
					return res.status(401).send("Not logged in.").end();
				let type = beepboop.soundsDbGw?.SoundType[req.params.type.toUpperCase()];
				if(typeof(type) === "undefined")
					return res.status(400).send("Unknown type.").end();
				if(await beepboop.soundsDbGw?.insertUserSound(steamid, req.params.soundName, type))
					res.status(201);
				else
					res.status(200);
			}
			res.end();
		});

		this.expressApp.delete("/api/user/sounds/:type/:soundName", async (req, res) => {
			if(req.body && req.params.soundName && req.params.type){
				let steamid = this.sessions.get(req.get("Session"));
				if(!steamid)
					return res.status(401).send("Not logged in.").end();
				let type = beepboop.soundsDbGw?.SoundType[req.params.type.toUpperCase()];
				if(typeof(type) === "undefined")
					return res.status(400).send("Unknown type.").end();
				beepboop.soundsDbGw?.deleteUserSound(steamid, req.params.soundName, type).catch(console.error);
			}
			res.status(200);
			res.end();
		});

		this.expressApp.post("/api/messages", async (req, res) => {
			let steamid = this.sessions.get(req.get("Session"));
			if(!steamid)
				return res.status(401).send("Not logged in.").end();
			if(!config.admins.includes(steamid))
				return res.status(403).send("Forbidden.").end();
			await beepboop.steamChat.chatHandler.handleMessage(
				null, new UserInfo({steamid64: steamid}), req.body, req.body,
				async (response) => {
					res.status(200);
					res.write(response);
				}
			);
			res.end();
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

		this.expressApp.get("/api/steam/authenticate", (req, res) => {
			this.relyingParty?.authenticate(steamOpenId, false, (error, authUrl) => {
				if(error){
					res.json(error);
					return;
				}
				res.redirect(authUrl || "");
			});
		});

		this.expressApp.get("/api/steam/verify", (req, res) => {
			this.relyingParty?.verifyAssertion(req, async (error, result) => {
				if(error){
					res.json(error);
					return;
				}
				let uid = await generateUid(18);
				this.sessions.set(uid, result?.claimedIdentifier?.substring(steamOpenId.length + 4)); // 4 == "/id/".length
				res.write(`<!DOCTYPE HTML><html><head>
					<script>
						localStorage.setItem("authId", ${JSON.stringify(uid)});
						close();
					</script>
				</head><body>
					You are logged in and you can close this window.
				</body></html>`);
				res.end();
			});
		});

		this.expressApp.get("/api/steam/check", (req, res) => {
			if(this.sessions.has(req.get("Session")))
				res.status(200);
			else
				res.status(401);
			res.end();
		});

		this.expressApp.get("/api/steam/logout", (req, res) => {
			if(this.sessions.delete(req.get("Session"))){
				res.header("content-type", "text/javascript");
				res.write(`localStorage.removeItem("authId");
					window.dispatchEvent(new StorageEvent('storage', {key: 'authId'}));`);
			} else
				res.status(200);
			res.end();
		});
	}
}