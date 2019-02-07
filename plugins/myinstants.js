const https = require('https');

class MyInstantsPlugin {
	constructor(apiGW){
		this.apiGW = apiGW;

		apiGW.steamChat.on("chatCommand", async (event) => {
			if(event.command != "instant")
				return;
			await this.playInstant(event.argument);
			event.setAsHandled();
		});

		apiGW.webApp.expressApp.post("/api/plugins/myinstants/play", (req, res) => {
			if(req.body && req.body.name){
				this.playInstant(req.body.name);
			} else {
				res.status(400);
			}
			res.end();
		});

		apiGW.webApp.addBrowserScript(() => {
			window.addEventListener("load", () => {
				let form = document.createElement("form");
				document.getElementById("controls").innerHTML += 
					`<form action="/api/plugins/myinstants/play" method="post" data-asyncSubmit>
						<fieldset>
							<legend>Play Instant</legend>
							<input type="text" name="name">
							<input type="submit" value="Play">
						</fieldset>
					</form>`;
				registerAsyncSubmitEvents();
			});
		});
	}

	playInstant(search){
		return new Promise((resolve, reject) => {
			const instantRegEx = /^(.*?)(#(\d))?$/;
			let reRes = instantRegEx.exec(search);
			search = reRes[1];
			let number = reRes[3] || 1;
			let url = "https://www.myinstants.com/search/?name=" + encodeURIComponent(search);
			console.log("instant search url", url);
			https.get(url, (resp) => {
				let data = "";

				resp.on('data', (chunk) => {
					data += chunk;
				});

				resp.on('end', () => {
					let search_regex = /<div class="small-button" onmousedown="play\('([\w\.\/\-_%]*)'\)/g;
					let regex_result;
					for(let i = 0; i < number; i++){
						regex_result = search_regex.exec(data);
					}
					if(regex_result == null)
						return reject(new Error("No instant found."));
					this.apiGW.steamChat.playSoundUrl("https://www.myinstants.com" + regex_result[1]);
					resolve();
				});
			}).on("error", (err) => {
				console.log("Error: " + err.message);
				reject(err);
			});
		});
	}
}

module.exports = MyInstantsPlugin;