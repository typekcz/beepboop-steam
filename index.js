const puppeteer = require("puppeteer");
const SteamChat = require("./steamchat");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");

var strlog = "";
function log(text){
	console.log(text);
	strlog += text + "\r\n";
}

let webApp = express();
webApp.use(express.static("web"));
webApp.use(bodyParser.json());
webApp.get("/log", (req, res) => {
	res.set("Content-Type", "text/plain");
	res.send(strlog);
	res.end();
});
webApp.listen(process.env.PORT || 8080);

/*http.createServer(async function (req, res) {
	res.write(strlog);
	res.end();
}).listen(process.env.PORT || 8080);*/

const args = process.argv.slice(2);

// Configuration
let config = JSON.parse(fs.readFileSync("config.json", "utf8"));

let steamUserName = config.steamUserName;
let steamPassword = config.steamPassword;
let groupName = config.groupName;
let channelName = config.channelName;

if(typeof(process.env.STEAM_USER) !== "undefined")
	steamUserName = process.env.STEAM_USER;
if(typeof(process.env.STEAM_PASSWORD) !== "undefined")
	steamPassword = process.env.STEAM_PASSWORD;
if(typeof(process.env.GROUP_NAME) !== "undefined")
	groupName = process.env.GROUP_NAME;
if(typeof(process.env.CHANNEL_NAME) !== "undefined")
	channelName = process.env.CHANNEL_NAME;

for(let i = 0; i < args.length; i++) {
	let arg = args[i];
	
	if((arg == "--steamuser" || arg == "-u") && args.length >= i){
		steamUserName = args[++i];
	} else if((arg == "--steampassword" || arg == "-p") && args.length >= i){
		steamPassword = args[++i];
	} else if((arg == "--groupname" || arg == "-g") && args.length >= i){
		groupName = args[++i];
	} else if((arg == "--channelname" || arg == "-c") && args.length >= i){
		channelName = args[++i];
	}
}

log("start");
(async () => {
	try{
		const browser = await puppeteer.launch({
			headless: false,
			args: [
				"--disable-client-side-phishing-detection",
				"--disable-sync",
				"--use-fake-ui-for-media-stream",
				"--use-fake-device-for-media-stream",
				"--enable-local-file-accesses",
				"--allow-file-access-from-files",
				"--disable-web-security",
				"--reduce-security-for-testing",
				"--no-sandbox",
				"--disable-setuid-sandbox"
			]
		});
		const page = (await browser.pages())[0];
		
		page.on("console", msg => log("PAGE LOG:" + msg.text()));
		page.on("pageerror", error => {
			log(error.message());
		});
		/*page.on('response', response => {
			log(response.status(), response.url);
		});*/
		page.on("requestfailed", request => {
			log(request.failure().errorText, request.url);
		});
		
		await page.setBypassCSP(true);
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36");
		await page.goto("https://steamcommunity.com/chat", {waitUntil : "networkidle2"});
		if(page.url().includes("login")){
			log("login");
			try {
				let navigationPromise = page.waitForNavigation({waitUntil : "networkidle0"});
				await page.evaluate((user, pass) => {
					document.querySelector("#steamAccountName").value = user;
					document.querySelector("#steamPassword").value = pass;
					document.querySelector("#SteamLogin").click();
				}, steamUserName, steamPassword);
				await navigationPromise;
			} catch(e){
				log(e);
			}
		}
		
		let steamchat = new SteamChat(page);
		await steamchat.initAudio();
		await new Promise((res) => { setTimeout(res, 1000); });
		await steamchat.joinVoiceChannel(groupName, channelName);
		await steamchat.playSoundUrl("https://kotrzena.eu/engineerremix.mp3");

		webApp.post("/api/playSoundUrl", (req, res) => {
			if(req.body && req.body.url){
				steamchat.playSoundUrl(req.body.url);
			} else {
				res.status(400);
			}
			res.end();
		});

		/*var stdin = process.openStdin();

		stdin.addListener("data", async function(d) {
			console.log(await page.evaluate((str) => {
				return eval(str);
			}, d.toString().trim()));
		});*/
		
		
		/*await page.evaluate((groupName, channelName) => {
			var audioContext = new AudioContext();
			var mixedAudio = audioContext.createMediaStreamDestination();

			function addStream(stream){
				console.log(stream);
				var audioSource = audioContext.createMediaStreamSource(stream);
				audioSource.connect(mixedAudio);
			}

			navigator.getUserMedia = function(options, success, failure){
				success(mixedAudio.stream);
			}

			document.getElementById("friendslist-container").style.width = "calc(100% - 150px)";
			var beepboop = document.createElement("DIV");
			beepboop.style.width = "150px";
			beepboop.style.position = "absolute";
			beepboop.style.right = "0";
			beepboop.style.top = "0";
			beepboop.style.bottom = "0";
			document.body.appendChild(beepboop);

			var file = document.createElement("INPUT");
			file.type = "file";
			file.onchange = () => {
				audio.src = URL.createObjectURL(file.files[0]);
			}
			beepboop.appendChild(file);

			var audio = document.createElement("AUDIO");
			audio.setAttribute("controls","");
			audio.muted = true;
			audio.oncanplay = ()=>{
				addStream(audio.captureStream());
				audio.play();
			}
			beepboop.appendChild(audio);

			setTimeout(()=>{
				for(let g of document.querySelectorAll(".ChatRoomList .ChatRoomListGroupItem")){
					if(g.querySelector(".chatRoomName").innerText == groupName){
						let voiceRooms = g.querySelector(".ChatRoomListGroupItemChatRooms").firstChild;
						if(voiceRooms.children.length == 0)
							g.querySelector(".openGroupButton").click();
						for(let ch of g.querySelectorAll(".chatRoomVoiceChannel")){
							if(ch.querySelector(".chatRoomVoiceChannelName").innerText == channelName){
								ch.click();
								break;
							}
						}
						break;
					}
				}
			}, 1000);
		}, groupName, channelName);*/

		log("Done!");
		//await browser.close();
	}catch(e){
		log(e);
	}
})();