const puppeteer = require("puppeteer");
const fs = require("fs");
const SteamChat = require("./steamchat");
const WebApp = require("./webapp");

let webApp = new WebApp(process.env.PORT || 8080);

function log(text){
	console.log(text);
	webApp.appendToLog(text);
}

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
			headless: true,
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
		// Steam won't accept HeadlessChrome
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

		webApp.startRestApi(steamchat);

		log("Done!");
		//await browser.close();
	}catch(e){
		log(e);
	}
})();