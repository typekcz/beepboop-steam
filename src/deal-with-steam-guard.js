//@ts-check

import { unpromisify } from "./utils.js";

export default class DealWithSteamGuard {
	/**
	 * 
	 * @param {import("./beepboop.js").default} beepboop 
	 */
	constructor(beepboop){
		this.beepboop = beepboop;
		/** @type {{promise: Promise, resolve: Function, reject: Function}?} */
		this.steamGuardCodePromise = null;

		beepboop.webApp.expressApp.get("/api/plugins/dealwithsteamguard", async (req, res) => {
			res.json({pending: !!this.steamGuardCodePromise});
			res.end();
		});

		beepboop.webApp.expressApp.post("/api/plugins/dealwithsteamguard", async (req, res) => {
			if(this.steamGuardCodePromise && req.body && req.body.code){
				this.steamGuardCodePromise.resolve(req.body.code);
				this.steamGuardCodePromise = null;
			}
			res.end();
		});

		beepboop.webApp.addBrowserScript(() => {
			window.addEventListener("load", unpromisify(async () => {
				let res = await fetch("/api/plugins/dealwithsteamguard");
				let json = await res.json();
				if(json.pending){
					document.body.insertAdjacentHTML("beforeend", 
						`<fieldset style="position: fixed;top: 50%;left: 50%;transform: translate(-50%,-50%);">
							<legend>Steam Guard</legend>
							<p>Hello human!</p>
							<p>I need Steam Guard code for my account that you gave me. Please write it here:</p>
							<form action="api/plugins/dealwithsteamguard" method="post" data-asyncsubmit="" data-beforesubmit="form[1].disabled = true;setTimeout(()=>location.reload(), 4000);">
								<input type="text" name="code">
								<input type="submit" value="Send">
							</form>
						</fieldset>`
					);
					//@ts-ignore available on the page
					registerAsyncSubmitEvents();
				}
			}));
		});
	}

	getSteamGuardCode(){
		if(this.steamGuardCodePromise){
			return this.steamGuardCodePromise.promise;
		}
		let resolve, reject;
		let promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		this.steamGuardCodePromise = {resolve, reject, promise};

		return this.steamGuardCodePromise.promise;
	}
}
