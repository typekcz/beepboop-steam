const utils = require("../utils");

const VIDEO_ID_REGEX = /watch\?v=([a-zA-Z0-9-]*)/g;
const VIDEO_URL = "https://www.youtube.com/watch?v=";
const SEARCH_URL = "https://www.youtube.com/results?search_query=";

class YoutubeSearch {
	constructor(apiGW){
		this.apiGW = apiGW;

		apiGW.steamChat.on("chatCommand", async (event) => {
			if(event.command != "youtube")
				return;
			await this.findVideo(event.argument);
			event.setAsHandled();
		});

		apiGW.webApp.expressApp.post("/api/plugins/youtube/find", async (req, res) => {
			if(req.body && req.body.name){
				await this.findVideo(req.body.name);
			} else {
				res.status(400);
			}
			res.end();
		});

		apiGW.webApp.addBrowserScript(() => {
			window.addEventListener("load", () => {
				document.getElementById("controls").insertAdjacentHTML("beforeend", 
					`<fieldset>
						<legend>Find YouTube video</legend>
						<form action="/api/plugins/youtube/find" method="post" data-asyncSubmit>
							<input type="text" name="name">
							<input type="submit" value="Play">
						</form>
					</fieldset>`
				);
				registerAsyncSubmitEvents();
			});
		});
	}

	async findVideo(search){
		const searchRegEx = /^(.*?)(#(\d))?$/;
		let reRes = searchRegEx.exec(search);
		search = reRes[1];
		let number = reRes[3] || 1;
		let url = SEARCH_URL + encodeURIComponent(search);

		let response = await utils.request(url);

		let body = response.body.toString();
		let regex_result;
		for(let i = 0; i < number; i++){
			regex_result = VIDEO_ID_REGEX.exec(body);
		}
		if(regex_result == null)
			throw new Error("No video found.");
		await this.apiGW.steamChat.playSoundUrl(VIDEO_URL + regex_result[1], true);
	}
}

module.exports = YoutubeSearch;