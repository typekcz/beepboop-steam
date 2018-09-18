const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const webDir = "./web";

class WebApp {
	constructor(port){
		this.port = port;
		this.expressApp = express();
		this.log = [];

		this.expressApp.use(bodyParser.json());
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

	startRestApi(steamchat){
		this.expressApp.post("/api/playSoundUrl", (req, res) => {
			if(req.body && req.body.url){
				steamchat.playSoundUrl(req.body.url);
			} else {
				res.status(400);
			}
			res.end();
		});

		this.expressApp.post("/api/playSound", (req, res) => {
			if(req.body && req.body.sound){
				steamchat.playSoundUrl("http://localhost:" + this.port + "/sounds/" + req.body.sound);
			} else {
				res.status(400);
			}
			res.end();
		});

		this.expressApp.get("/api/sounds", (req, res) => {
			fs.readdir(webDir + "/sounds", (error, files) => {
				if(error){
					res.status(500);
					res.write(error);
					res.end();
				} else {
					//TODO: Check what is file and what is directory.
					res.json(files);
					res.end();
				}
			});
		});
	}
}

module.exports = WebApp;