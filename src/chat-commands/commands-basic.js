//@ts-check

import { formatDuration } from "../utils.js";

/**
 * 
 * @param {[string, import("../chat-handler.js").ChatCommand]} param0 
 */
function shortHelp([keyword, command]){
	if(!command.argsHelp && !command.help && !command.longHelp)
		return "";
	let str = ["\u2003 ", keyword];
	if(command.argsHelp)
		str.push(` ${command.argsHelp}`);
	if(command.help)
		str.push(` - ${command.help}`);
	str.push("\n");
	return str.join("");
}

/**
 * 
 * @param {string} keyword 
 * @param {import("../chat-handler.js").ChatCommand} command 
 */
function longHelp(keyword, command){
	let help = shortHelp([keyword, command]);
	if(command.longHelp)
		help += "\n" + command.longHelp;
	return help;
}

/**
 * 
 * @param {import("../beepboop.js").default} bb
 * @param {Map<string, import("../chat-handler.js").ChatCommand>} chatCommandsMap 
 * @returns {import("../chat-handler.js").ChatCommand[]}
 */
export function createBasicCommands(bb, chatCommandsMap){
	return [
		{
			command: "help",
			handler: e => {
				let keyword = e.argument?.toLowerCase();
				if(keyword){
					let cmd = chatCommandsMap.get(keyword);
					if(cmd)
						e.sendResponse(longHelp(keyword, cmd));
					else
						e.sendResponse(`There is no help for "${e.argument}".`);
				} else {
					let str = [
						"𝘾𝙤𝙢𝙢𝙖𝙣𝙙𝙨\n", 
						...([...chatCommandsMap.entries()].map(shortHelp)),
						"𝙒𝙚𝙗 𝙞𝙣𝙩𝙚𝙧𝙛𝙖𝙘𝙚: ", bb.config.baseUrl,
						"\n𝘽𝙚𝙚𝙥𝘽𝙤𝙤𝙥 v", bb.config.version
					].join("");
					console.log("help", str);
					e.sendResponse(str);
				}
			},
			argsHelp: "[command]",
			help: "Shows help for specific command."
		}, {
			command: ["beep", "beep?"],
			handler: e => e.sendResponse("boop"),
			help: "Use to test if bot is responding."
		}, {
			command: "time",
			handler: e => e.sendResponse(`It's ${new Date().toLocaleString()} and I'm up for ${formatDuration(process.uptime())}`),
			help: "Shows time and bot's uptime."
		}
	];
}
