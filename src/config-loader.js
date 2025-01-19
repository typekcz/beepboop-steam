//@ts-check
/* If you are looking for configuration, create file config.json and use example configuration from README.md. */
import fs from "fs";
import "dotenv/config";
import { parseArgs } from "node:util";

const helpString = 
`Usage:
	[--config <json> | -c <json>]
	[--config-file <path> | -C <path>]
Default config file is "config.json". 
Required values are steam.userName, steam.password, steam.groupName, steam.channelName.`;

/** @type {Partial<Config>} */
const defaultConfig = {
	plugins: ["myinstants", "youtubesearch"],
	messages: {
		greeting: [
			"Hello, I am BeebBoop and I do beep and boop.",
			"I really like cheese.",
			"Knock, knock."
		],
		unknownCommand: [
			"The fuck you want?",
			"I'm not fluent in meatbag language.",
			"Fuck you too."
		],
		error: [
			"Nope.",
			"418 I'm a teapot.",
			"E̴͚̠̰̺͎̘ͫR̮͈͓̆͜R͕̩̩̭̙͘Ȯ͖̜̱̞̜ͮR̉.",
			"/me is currently unavailable.",
			"No can do."
		]
	}
}

function loadConfig(){
	if(process.env.CONFIG){
		try {
			return JSON.parse(process.env.CONFIG);
		} catch(error){
			console.error("Error: Parsing config from evironment variable failed.");
			console.error(error);
		}
	}

	let configFilename = process.env.CONFIGFILE ?? "config.json";

	// Handle process arguments
	let args;
	try {
		args = parseArgs({
			options: {
				config: {
					type: "string",
					short: "c"
				},
				"config-file": {
					type: "string",
					short: "C"
				},
				help: {
					type: "boolean",
					short: "h"
				}
			}
		});
	} catch(e){
		console.error(e.message);
		process.exit(1);
	}

	if(args.values.help){
		console.log(helpString);
		process.exit(1);
	}

	if(args.values.config){
		try {
			return JSON.parse(process.argv[args.values.config]);
		} catch(error){
			console.error("Error: Parsing config from process argument failed.");
			console.error(error);
		}
	}

	configFilename = args.values["config-file"] ?? configFilename;

	// Load config file
	try {
		if(typeof(configFilename) === "string" && fs.existsSync(configFilename) && fs.statSync(configFilename).isFile())
			return JSON.parse(fs.readFileSync(configFilename, "utf8"));
	} catch(error){
		console.error("Error: Parsing config from file \"" + configFilename + "\" failed.");
		console.error(error);
	}

	console.error("No config was loaded!");
	process.exit(1);
}

/** @type {Config} */
const config = loadConfig();

try {
	config.version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
} catch(e){
	console.error("Failed to load package.json", e);
}

if(!config){
	console.error("Error: Missing config.");
	process.exit(1);
}

// Defaults
config.plugins = config.plugins ?? defaultConfig.plugins;
config.messages = {
	...defaultConfig.messages,
	...config.messages
};

// Env var port or default port if missing in config
config.port = config.port || Number(process.env.PORT) || 8081;

let mode = config.mode || process.env.MODE || "web";
if(["client", "web"].includes(mode)){
	//@ts-ignore Dude, I just checked it...
	config.mode = mode;
} else {
	console.error(`Error: Unknown mode configured: ${mode}.`);
	process.exit(1);
}

if(process.env.DB_CONNECTION){
	if(!config.db)
		config.db = {connection: process.env.DB_CONNECTION};
	else if(!config.db?.connection)
		config.db.connection = process.env.DB_CONNECTION;
}
if(!config.steam)
	config.steam = {};
if(process.env.STEAM_USERNAME)
	config.steam.userName = process.env.STEAM_USERNAME;
if(process.env.STEAM_PASSWORD)
	config.steam.password = process.env.STEAM_PASSWORD;

export default config;
