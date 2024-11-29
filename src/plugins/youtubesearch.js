//@ts-check
import * as utils from "../utils.js";

const VIDEO_ID_REGEX = /watch\?v=([a-zA-Z0-9-_]*)/g;
const VIDEO_URL = "https://www.youtube.com/watch?v=";
const SEARCH_URL = "https://www.youtube.com/results?search_query=";

export default class YoutubeSearch {
	/**
	 * 
	 * @param {import("../beepboop.js").default} apiGW 
	 */
	constructor(apiGW){
		this.apiGW = apiGW;

		apiGW.chatHandler.addCommands({
			command: "youtube",
			help: "Play Youtube video",
			longHelp: "You can specify which search result to play by appending # and a number.",
			argsHelp: "<search>",
			handler: async (e) => {
				e.sendResponse(await this.findVideo(e.argument), false);
			}
		});

		apiGW.webApp.expressApp.post("/api/plugins/youtube/find", async (req, res) => {
			if(req.body?.name){
				await this.findVideo(req.body.name);
			} else {
				res.status(400);
			}
			res.end();
		});

		apiGW.webApp.addBrowserScript(() => {
			window.addEventListener("load", () => {
				document.getElementById("controls")?.insertAdjacentHTML("beforeend", 
					`<fieldset>
						<legend>Find YouTube video</legend>
						<form action="api/plugins/youtube/find" method="post" data-asyncSubmit>
							<small>Search and directly play YouTube videos.</small><br>
							<input type="text" name="name">
							<input type="submit" value="Play">
						</form>
					</fieldset>`
				);
				// @ts-ignore
				registerAsyncSubmitEvents();
			});
		});
	}

	async findVideo(search){
		const searchRegEx = /^(.*?)(#(\d))?$/;
		let reRes = searchRegEx.exec(search);
		if(!reRes || reRes.length <= 1)
			throw new Error("Bad search string");
		search = reRes[1];
		let number = Number(reRes[3]) || 1;
		let url = SEARCH_URL + encodeURIComponent(search);

		let response = await utils.request(url);

		let body = response.body.toString();
		let regex_result;
		for(let i = 0; i < number; i++){
			regex_result = VIDEO_ID_REGEX.exec(body);
		}
		if(regex_result == null)
			throw new Error("No video found.");
		let ytUrl = VIDEO_URL + regex_result[1];
		await this.apiGW.steamChatAudio.playSoundUrl(ytUrl, true);
		return ytUrl;
	}
}
