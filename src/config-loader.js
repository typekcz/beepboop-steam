//@ts-check
/* If you are looking for configuration, create file config.json and use example configuration from README.md. */
import fs from "fs";

const helpString = 
`Usage:
	[--config <json> | -c <json>]
	[--config-file <path> | -C <path>]
Default config file is "config.json". 
Required values are steam.userName, steam.password, steam.groupName, steam.channelName.`;

function loadConfig(){
	if(process.env.CONFIG){
		try {
			return JSON.parse(process.env.CONFIG);
		} catch(error){
			console.error("Error: Parsing config from evironment variable failed.");
			console.error(error);
		}
	}

	let configFilename = process.env.CONFIGFILE || "config.json";

	// Handle process arguments
	for(let i = 2; i < process.argv.length; i++) {
		let arg = process.argv[i];
		
		if((arg == "--config" || arg == "-c") && process.argv.length >= i){
			try {
				return JSON.parse(process.argv[++i]);
			} catch(error){
				console.error("Error: Parsing config from process argument failed.");
				console.error(error);
			}
		} else if((arg == "--config-file" || arg == "-C") && process.argv.length >= i){
			configFilename = process.argv[++i];
		} else {
			console.error("Unknown parameter \"" + arg + "\"");
			console.log(helpString);
			process.exit(1);
		}
	}

	// Load config file
	try {
		if(typeof(configFilename) === "string" && fs.existsSync(configFilename) && fs.statSync(configFilename).isFile())
			return JSON.parse(fs.readFileSync(configFilename, "utf8"));
	} catch(error){
		console.error("Error: Parsing config from file \"" + configFilename + "\" failed.");
		console.error(error);
	}
	return null;
}

/** @type {Config} */
let config = loadConfig();

try {
	config.version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
} catch(e){
	console.error("Failed to load package.json", e);
}

if(!config){
	console.error("Error: Missing config.");
	process.exit(1);
}

// Default plugins
if(!config.plugins){
	config.plugins = ["myinstants"];
}

// Env var port or default port if missing in config
config.port = config.port || Number(process.env.PORT) || 8081;
config.mode = config.mode || process.env.MODE || "web";
if(process.env.DB_CONNECTION){
	if(!config.db)
		config.db = {connection: process.env.DB_CONNECTION};
	else if(!config.db?.connection)
		config.db.connection = process.env.DB_CONNECTION;
}

export default config;
