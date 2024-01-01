//@ts-check
import config from "../config-loader.js";
import Main from "../main.js";

/**
 * 
 * @param {import("../chat-handler.js").ChatCommandHandler} handler 
 * @returns {import("../chat-handler.js").ChatCommandHandler}
 */
export function wrapAdminCheckCommandHandler(handler){
	return e => {
		if(config.admins?.includes(e.userinfo.steamid))
			return handler(e);
		e.sendResponse("You are not admin.");
	};
}

/**
 * 
 * @param {import("../beepboop.js").default} bb
 * @returns {import("../chat-handler.js").ChatCommand[]}
 */
export function createAdminCommands(bb){
	return [
		{
			command: "die",
			handler: wrapAdminCheckCommandHandler(e => Main.shutdown())
		}, {
			command: "pupeval",
			handler: wrapAdminCheckCommandHandler(async e => {
				let result = await bb.chatFrame.evaluate(
					/** @type {(code: string) => any} */ 
					code => eval( `(async () => ${code})()`), e.argument
				);
				e.sendResponse("/code " + JSON.stringify(result));
			})
		}, {
			command: "nodeeval",
			handler: wrapAdminCheckCommandHandler(async e => {
				let result = await eval(`(async () => ${e.argument})()`);
				e.sendResponse("/code " + JSON.stringify(result));
			})
		}
	];
}