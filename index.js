const puppeteer = require("puppeteer");
const fs = require("fs");
const SteamChat = require("./steamchat");
const WebApp = require("./webapp");

class Main {
	static async main(args){
		process.on("unhandledRejection", (error, p) => {
			console.error("Unhandled Promise Rejection", p, error);
		});
	
		process.on("SIGINT", process.exit);
		process.on("SIGUSR1", process.exit);
		process.on("SIGUSR2", process.exit);

		const helpString = 
		`Usage:
			[--config <json> | -c <json>]
			[--config-file <path> | -C <path>]
		Default config file is config.json. 
		Required values are steamUserName, steamPassword, groupName, channelName.
		These can also be set by enviroment variables with capitalised names.`;
		let configFile = process.env.CONFIGFILE || "config.json";
		let config = null;
		if(process.env.CONFIG){
			try {
				config = JSON.parse(process.env.CONFIG);
			} catch(error){
				console.log(error);
			}
		}

		// Handle parameters
		for(let i = 2; i < args.length; i++) {
			let arg = args[i];
			
			if((arg == "--config" || arg == "-c") && args.length >= i){
				try {
					config = JSON.parse(args[++i]);
				} catch(error){
					console.log(error);
				}
			} else if((arg == "--config-file" || arg == "-C") && args.length >= i){
				configFile = args[++i];
			} else {
				console.error("Unknown parameter \"" + arg + "\"");
			}
		}

		// Load config file
		if(!config)
			try {
				if(typeof(configFile) === "string" && fs.statSync(configFile).isFile())
					config = JSON.parse(fs.readFileSync(configFile, "utf8"));
			} catch(error){
				console.error(error);
				console.log(helpString);
				process.exit(1);
			}
		if(!config){
			config = {};
		}

		// Use environment variables
		config.steamUserName =  process.env.STEAMUSERNAME || config.steamUserName;
		config.steamPassword =  process.env.STEAMPASSWORD || config.steamPassword;
		config.groupName = process.env.GROUPNAME || config.groupName;
		config.channelName = process.env.CHANNELNAME || config.channelName;

		// Check if all required values are defined
		if(!config.steamUserName){
			console.log("Missing steamUserName in the configuration.");
			process.exit(1);
		}
		if(!config.steamPassword){
			console.log("Missing steamPassword in the configuration.");
			process.exit(1);
		}
		if(!config.groupName){
			console.log("Missing groupName in the configuration.");
			process.exit(1);
		}
		if(!config.channelName){
			console.log("Missing channelName in the configuration.");
			process.exit(1);
		}

		// Start
		let webApp = new WebApp(config.port || process.env.PORT || 8080);

		this.hook_stream(process.stdout, (str) => webApp.appendToLog(str));
		this.hook_stream(process.stderr, (str) => webApp.appendToLog(str));

		console.log("Start:");

		try {
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
			
			page.on("console", msg => console.log("Page log: " + msg.text()) );
			page.on("pageerror", error => console.log("Page error: " + error.message) );
			page.on("requestfailed", request => console.log("Page request failed: " + request.failure().errorText, request.url) );
			
			await page.setBypassCSP(true);
			// Steam won't accept HeadlessChrome
			await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36");
			await page.goto("https://steamcommunity.com/chat", {waitUntil : "networkidle2"});
			if(page.url().includes("login")){
				console.log("login");
				try {
					let navigationPromise = page.waitForNavigation({waitUntil : "networkidle0"});
					await page.evaluate((user, pass) => {
						document.querySelector("#steamAccountName").value = user;
						document.querySelector("#steamPassword").value = pass;
						document.querySelector("#SteamLogin").click();
					}, config.steamUserName, config.steamPassword);
					await navigationPromise;
				} catch(error){
					console.log(error);
				}
			}
			
			await new Promise((res) => { setTimeout(res, 1000); });
			let steamchat = new SteamChat(page);
			await steamchat.initAudio();
			await steamchat.joinVoiceChannel(config.groupName, config.channelName);
	
			webApp.startRestApi(steamchat);
	
			console.log("Web UI ready.");
			//await browser.close();
		} catch(error){
			console.error(error);
		}
	}
	
	// Credit: https://gist.github.com/pguillory/729616/32aa9dd5b5881f6f2719db835424a7cb96dfdfd6
	static hook_stream(stream, callback) {
		let old_write = stream.write;
	
		stream.write = (function(write) {
			return function(string, encoding, fd) {
				write.apply(stream, arguments)
				callback(string, encoding, fd)
			}
		})(stream.write);
	}
}

Main.main(process.argv);