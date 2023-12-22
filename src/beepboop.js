//@ts-check
import pgPromise from "pg-promise";
import requireFromString from "require-from-string";
import config from "./config-loader.js";
import SoundsDbGw from "./sounds-db-gw.js";
import SteamBrowserApi from "./steam-api/steam-browser-api.js";
import SteamChatApi from "./steam-api/steam-chat-api.js";
import SteamChatAudio from "./steam-api/steam-chat-audio.js";
import SteamClientApi from "./steam-api/steam-client-api.js";
import { getStorage, setUpPersistence } from "./storage.js";
import * as utils from "./utils.js";
import WebApp from "./webapp.js";
///<reference path="./types.d.ts" />

const paddedVer = (config?.version || "?").padEnd(13).substring(0, 13);
const startMessage = 
`
 ___               ___                
| _ ) ___ ___ _ __| _ ) ___  ___ _ __ 
| _ V/ -_) -_) '_ V _ V/ _ V/ _ V '_ V
|___/V___V___| .__/___/V___/V___/ .__/
             |_| v${paddedVer } |_|  `
	//@ts-ignore
	.replaceAll("V", "\\");


export default class BeepBoop {
	constructor(){
		/** @type {Config} */
		this.config = config;
		this.webApp = new WebApp(config.baseUrl, config.port);
		if(config.db?.connection){
			this.db = pgPromise()(config.db.connection);
			this.soundsDbGw = new SoundsDbGw(this.db);
		}
		switch(config.mode){
			case "client":
				this.steamClient = new SteamClientApi();
				break;
			case "web":
				this.steamBrowser = new SteamBrowserApi(this);
				break;
		}
		this.steamChat = new SteamChatApi(this);
		this.steamChatAudio = new SteamChatAudio(this, "http://localhost:" + config.port);
		this.plugins = [];
	}

	async init(){
		console.info(startMessage);
		await this.soundsDbGw?.init();
		setUpPersistence(this.db).catch(console.error);
		console.info(`Initializing Steam ${config.mode} API.`);
		await this.steamClient?.init();
		await this.steamBrowser?.init()
		console.info("Initializing Steam chat API.");
		await this.steamChat.init();
		console.log("Initializing Steam chat audio.");
		await this.steamChatAudio.init(config.volume);

		if(config.steam?.groupName && config.steam?.channelName){
			await this.steamChat.joinVoiceChannel(config.steam.groupName, config.steam.channelName, true);
			console.info(`Successully joined voice channel ${config.steam?.channelName} in ${config.steam?.groupName}`);
		} else
			console.warn("Missing steam.groupName or steam.channelName, got nowhere to join.");
		console.info("Initializing REST API.");
		this.webApp.startRestApi(this);
		this.webApp.startSteamLoginApi();
		await this.loadPlugins();
		console.info(`BeepBoop started in ${process.uptime()} seconds.`);
	}

	async stop(){
		await this.steamChat.leaveVoiceChannel();
		await this.steamBrowser.browser.close();
	}

	/**
	 * @returns {import("puppeteer-core/lib/cjs/puppeteer/api-docs-entry.js").Page | import("puppeteer-core/lib/cjs/puppeteer/api-docs-entry.js").Frame | undefined}
	 */
	get chatFrame(){
		//@ts-ignore my head hurts...
		return this.steamClient?.getFriendsUiFrame() || this.steamBrowser?.getFriendsUiFrame();
	}

	/**
	 * @returns {import("puppeteer-core/lib/cjs/puppeteer/api-docs-entry.js").Page | undefined}
	 */
	get chatPage(){
		//@ts-ignore
		return this.steamClient?.getFriendsUiPage() || this.steamBrowser?.getFriendsUiPage();
	}

	async loadPlugins(){
		if(!config.plugins)
			return;
		for(let plugin of config.plugins){
			console.log("Loading \""+plugin+"\" plugin.");
			try {
				let pluginClass;
				if(plugin.startsWith("http:") || plugin.startsWith("https:")){
					let code = (await utils.request(plugin)).body.toString();
					pluginClass = requireFromString(code, "./plugins/"+plugin.replace(/[^\w^.]+/g, "_"));
				} else {
					pluginClass = await import("./plugins/"+plugin+".js");
				}
				if(typeof pluginClass !== "function" && pluginClass.default)
					pluginClass = pluginClass.default;
				this.plugins.push(new (pluginClass)(this, await getStorage(plugin)));
			} catch(error){
				console.error(error);
			}
		}
	}
}