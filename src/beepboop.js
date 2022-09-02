//@ts-check
import pgPromise from "pg-promise";
import requireFromString from "require-from-string";
import config from "./config-loader";
import SoundsDbGw from "./sounds-db-gw";
import SteamBrowserApi from "./steam-api/steam-browser-api";
import SteamChatApi from "./steam-api/steam-chat-api";
import SteamChatAudio from "./steam-api/steam-chat-audio";
import SteamClientApi from "./steam-api/steam-client-api";
import { getStorage, setUpPersistence } from "./storage";
import utils from "./utils";
import WebApp from "./webapp";
const pkg = require('../package.json');

const paddedVer = (pkg?.version || "").padEnd(13).substring(0, 13);
const startMessage = 
` ___               ___                
| _ ) ___ ___ _ __| _ ) ___  ___ _ __ 
| _ \/ -_) -_) '_ \ _ \/ _ \/ _ \ '_ \
|___/\___\___| .__/___/\___/\___/ .__/
             |_| v${paddedVer } |_|  `;


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
				this.steamClientApi = new SteamClientApi();
				break;
			case "web":
				this.steamBrowserApi = new SteamBrowserApi(this);
				break;
		}
		this.steamChatApi = new SteamChatApi(this);
		this.steamChatAudio = new SteamChatAudio(this, "http://localhost:" + config.port + "/api/sounds/");
		this.plugins = [];
	}

	async init(){
		console.info(startMessage);
		await this.soundsDbGw?.init();
		setUpPersistence(this.db);
		console.info(`Initializing Steam ${config.mode} API.`);
		await this.steamClientApi?.init();
		await this.steamBrowserApi?.init()
		console.info("Initializing Steam chat API.");
		await this.steamChatApi.init();

		if(config.steam?.groupName && config.steam?.channelName){
			await this.steamChatApi.joinVoiceChannel(config.steam.groupName, config.steam.channelName, true);
			console.info(`Successully joined voice channel ${config.steam?.channelName} in ${config.steam?.groupName}`);
		} else
			console.warn("Missing steam.groupName or steam.channelName, got nowhere to join.");
		console.info("Initializing REST API.");
		this.webApp.startRestApi(this);
		this.webApp.startSteamLoginApi();
		console.info(`BeepBoop started in ${process.uptime()} seconds.`);
	}

	/**
	 * @returns {import("puppeteer-core").Page | import("puppeteer-core").Frame | undefined}
	 */
	get chatFrame(){
		//@ts-ignore my head hurts...
		return this.steamClientApi?.getFriendsUiFrame() || this.steamBrowserApi?.getFriendsUiFrame();
	}

	/**
	 * @returns {import("puppeteer-core").Page | undefined}
	 */
	get chatPage(){
		//@ts-ignore
		return this.steamClientApi?.getFriendsUiPage() || this.steamBrowserApi?.getFriendsUiPage();
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
					pluginClass = require("./plugins/"+plugin+".js");
				}
				this.plugins.push(new (pluginClass)(this, await getStorage(plugin)));
			} catch(error){
				console.error(error);
			}
		}
	}
}