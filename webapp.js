const express = require("express");
const bodyParser = require("body-parser");
const fileUpload = require('express-fileupload');
const fs = require("fs");

const webDir = "./web";

class WebApp {
	constructor(port){
		this.port = port;
		this.expressApp = express();
		this.log = [];

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
					await soundsDbGw.insert(req.body.name, req.files.sound.data, req.files.sound.mimetype);
				} else {
					res.status(400);
				}
				res.end();
			} catch(e) {
				res.status(500).send(e).end();
			}
		});

		this.expressApp.post("/api/playSound", (req, res) => {
			if(req.body && req.body.sound){
				steamchat.playSoundUrl("http://localhost:" + this.port + "/sounds/" + req.body.sound);
			} else {
				res.status(400);
			}
			res.end();
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
	}
}

module.exports = WebApp;