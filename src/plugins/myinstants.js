//@ts-check

export default class MyInstantsPlugin {
	/**
	 * 
	 * @param {import("../beepboop.js").default} apiGW 
	 */
	constructor(apiGW){
		this.apiGW = apiGW;

		apiGW.chatHandler.addCommands({
			command: "instant",
			help: "Play an instant from myinstants",
			argsHelp: "<search>",
			handler: async (e) => {
				e.sendResponse(await this.playInstant(e.argument), false);
			}
		});

		apiGW.webApp.expressApp.post("/api/plugins/myinstants/play", async (req, res) => {
			if(req.body?.name){
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
						<form action="api/plugins/myinstants/play" method="post" data-asyncSubmit>
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
		let number = Number(reRes[3]) || 1;
		let url = "https://www.myinstants.com/search/?name=" + encodeURIComponent(search);
		console.log("instant search url", url);

		let response = await fetch(url);
		if(response.status != 200)
			throw new Error("Bad response status: " + response.status);

		let body = await response.text();
		let search_regex = /<button class="small-button" onclick="play\('([\w./\-%]*)'\s*,\s*'[^']+'\s*,\s*'([^']+)'/g;
		let regex_result;
		for(let i = 0; i < number; i++){
			regex_result = search_regex.exec(body);
		}
		if(regex_result == null)
			throw new Error("No instant found.");
		let [, instantPath, instantId] = regex_result;

		await this.apiGW.steamChatAudio.playSoundUrl("https://www.myinstants.com" + instantPath);
		return `https://www.myinstants.com/en/instant/${instantId}/`;
	}
}
