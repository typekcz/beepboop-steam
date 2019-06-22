const config = require("./configloader");
const puppeteer = require("puppeteer");
const SteamChat = require("./steamchat");
const WebApp = require("./webapp");
const pgp = require("pg-promise")();
const SoundsDBGW = require("./soundsdbgw");
const http = require('http');
const https = require('https');
const storage = require("./storage");
const utils = require("./utils");
const requireFromString = require("require-from-string");
const DealWithCaptcha = require("./dealwithcaptcha");

let db = null;
let page = null;

class Main {
	static async joinSteamChat(steamchat, config){
		try {
			await steamchat.getPage().goto("https://steamcommunity.com/chat", {waitUntil : "networkidle2"});
		} catch(e){
			console.error(e.message);
		}

		if(steamchat.getPage().url().includes("login")){
			console.log("login");
			await steamchat.login(config.steam.userName, config.steam.password);
		}
		
		await steamchat.init(config.volume || 0.3);
		await steamchat.joinVoiceChannel(config.steam.groupName, config.steam.channelName);
	}

	static async main(args){
		process.on("unhandledRejection", (error, p) => {
			console.error("Unhandled Promise Rejection", p, error);
		});
	
		process.on("SIGINT", Main.shutdown);
		process.on("SIGUSR1", Main.shutdown);
		process.on("SIGUSR2", Main.shutdown);

		// Start
		let port = config.port || process.env.PORT || 8080;
		let webApp = new WebApp(config.baseUrl, port);
		db = pgp(config.db.connection);
		const soundsDbGw = new SoundsDBGW(db);
		soundsDbGw.init();
		storage.setUpPersistence(db);

		try {
			await db.none(
				`CREATE TABLE IF NOT EXISTS variable(
					name	text PRIMARY KEY,
					value	text NOT NULL
				)`
			);
		} catch(e){
			console.error(e.message);
		}

		this.hook_stream(process.stdout, (str) => webApp.appendToLog(str));
		this.hook_stream(process.stderr, (str) => webApp.appendToLog(str));

		console.log("Start:");

		try {
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
			page = (await browser.pages())[0];
			webApp.setupPageScreen(page);

			await this.loadCookies();
			
			page.on("console", msg => console.log("Page log: " + msg.text()) );
			page.on("pageerror", error => console.log("Page error: " + error.message) );
			page.on("requestfailed", request => console.log("Page request failed: " + request.failure().errorText, request.url) );
			
			await page.setBypassCSP(true);
			// Steam won't accept HeadlessChrome
			await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36");
			
			let steamchat = new SteamChat(page, "http://localhost:" + port + "/api/sounds/", "http://localhost:" + port + "/api/yt?url=", soundsDbGw, config.ttsUrl);

			let apiGW = {
				steamChat: steamchat,
				webApp: webApp,
				config: config,
				browser: browser,
				port: port,
				plugins: []
			}

			let dealWithCaptcha = new DealWithCaptcha(apiGW);
			steamchat.setCaptchaSolver((img) => dealWithCaptcha.getCaptchaSolution(img));

			await this.joinSteamChat(steamchat, config);

			steamchat.on("connectionTrouble", (e) => {
				console.log("Connection trouble: ", e.message);
				this.joinSteamChat(steamchat, config);
			})
				
			webApp.startRestApi(steamchat, soundsDbGw);
			webApp.startSteamLoginApi();
	
			console.log("Web UI ready.");

			console.log("Loading plugins.");
			for(let plugin of config.plugins){
				console.log("Loading \""+plugin+"\" plugin.");
				try {
					let pluginClass;
					if(plugin.startsWith("http:") || plugin.startsWith("https:")){
						let code = (await utils.request(plugin)).body.toString();
						pluginClass = requireFromString(code, "./plugins/"+plugin.replace(/[^\w^.]+/g, "_"));
					} else {
						pluginClass = require("./plugins/"+plugin+".js");
					}
					apiGW.plugins.push(new (pluginClass)(apiGW, await storage.getStorage(plugin)));
				} catch(error){
					console.error(error);
				}
			}
			console.log("Start done.");
			this.storeCookies();
		} catch(error){
			console.error(error);
		}
	}
	
	// Credit: https://gist.github.com/pguillory/729616/32aa9dd5b5881f6f2719db835424a7cb96dfdfd6
	static hook_stream(stream, callback) {
		stream.write = (function(write) {
			return function(string, encoding, fd) {
				write.apply(stream, arguments);
				callback(string, encoding, fd);
			};
		})(stream.write);
	}

	static async loadCookies(){
		try {
			await page.goto("https://steamcommunity.com/comment/ForumTopic/formattinghelp?ajax=1");
			let localStorageRow = await db.oneOrNone("SELECT value FROM variable WHERE name = 'localStorage'");
			if(localStorageRow){
				let localStorageData = JSON.parse(localStorageRow.value.toString());
				await page.evaluate((localStorageData) => {
					Object.assign(window.localStorage, localStorageData);
				}, localStorageData);
			}

			let cookiesRow = await db.oneOrNone("SELECT value FROM variable WHERE name = 'cookies'");
			if(cookiesRow){
				let cookies = JSON.parse(cookiesRow.value.toString());
				for(let cookie of cookies)
					await page.setCookie(cookie);
			}
		} catch(e){
			console.error(e.message);
		}
	}

	static async storeCookies(){
		try {
			let localStorageJson = await page.evaluate(() => {
				return JSON.stringify(window.localStorage);
			});
			await db.none(
				"INSERT INTO variable(name, value) VALUES('localStorage', $1) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value",
				[ localStorageJson ]
			);

			await db.none(
				"INSERT INTO variable(name, value) VALUES('cookies', $1) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value",
				[ JSON.stringify(await page.cookies()) ]
			);
		} catch(e){
			console.error(e.message);
			return null;
		}
	}

	static shutdown(){
		console.log("Shutdown:");
		Main.storeCookies().then(() => {
			console.log("Cookies stored.");
			page.browser().close().then(() => process.exit(0));
		}).catch((e) => {
			console.error(e.message);
			page.browser().close().then(() => process.exit(1));
		});
	}
}

Main.main(process.argv);