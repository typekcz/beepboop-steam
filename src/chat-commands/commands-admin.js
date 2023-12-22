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
 * @param {import("puppeteer-core/lib/cjs/puppeteer/api-docs-entry.js").Page | import("puppeteer-core/lib/cjs/puppeteer/api-docs-entry.js").Frame} chatFrame 
 * @returns {import("../chat-handler.js").ChatCommand[]}
 */
export function createAdminCommands(chatFrame, bb){
	return [
		{
			command: "die",
			handler: wrapAdminCheckCommandHandler(e => Main.shutdown())
		}, {
			command: "pupeval",
			handler: wrapAdminCheckCommandHandler(async e => {
				let result = await chatFrame.evaluate(
					/** @type {(code: string) => any} */ 
					code => eval( `(async () => ${code})()`), e.argument
				);
				e.sendResponse("/code " + JSON.stringify(result));
			})
		}
	];
}