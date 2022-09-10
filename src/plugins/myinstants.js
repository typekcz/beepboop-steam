//@ts-check
import * as utils from "../utils.js";

export default class MyInstantsPlugin {
	/**
	 * 
	 * @param {import("../beepboop").default} apiGW 
	 */
	constructor(apiGW){
		this.apiGW = apiGW;

		apiGW.steamChat.on("chatCommand", async (event) => {
			if(event.command != "instant")
				return;
			await this.playInstant(event.argument);
			event.setAsHandled();
		});

		apiGW.webApp.expressApp.post("/api/plugins/myinstants/play", async (req, res) => {
			if(req.body && req.body.name){
				await this.playInstant(req.body.name);
			} else {
				res.status(400);
			}
			res.end();
		});

		apiGW.webApp.addBrowserScript(() => {
			window.addEventListener("load", () => {
				document.getElementById("controls")?.insertAdjacentHTML("beforeend", 
					`<fieldset>
						<legend>Play Instant</legend>
						<form action="/api/plugins/myinstants/play" method="post" data-asyncSubmit>
							<small>Find and play button from <a href="https://myinstants.com" target="_blank">myinstants.com</a></small><br>
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

	async playInstant(search){
		const instantRegEx = /^(.*?)(#(\d))?$/;
		let reRes = instantRegEx.exec(search);
		if(!reRes || reRes.length <= 1)
			throw new Error("Bad search string");
		search = reRes[1];
		let number = reRes[3] || 1;
		let url = "https://www.myinstants.com/search/?name=" + encodeURIComponent(search);
		console.log("instant search url", url);

		let response = await utils.request(url);

		let body = response.body.toString();
		let search_regex = /<button class="small-button" onclick="play\('([\w\.\/\-%]*)'\)/g;
		let regex_result;
		for(let i = 0; i < number; i++){
			regex_result = search_regex.exec(body);
		}
		if(regex_result == null)
			throw new Error("No instant found.");
		await this.apiGW.steamChatAudio.playSoundUrl("https://www.myinstants.com" + regex_result[1]);
	}
}
