//@ts-check

export default class DealWithCaptcha {
	/**
	 * 
	 * @param {import("./beepboop.js").default} beepboop 
	 */
	constructor(beepboop){
		this.beepboop = beepboop;
		this.captchaSolutionPromise = null;
		this.captchaImage = null;

		beepboop.webApp.expressApp.get("/api/plugins/dealwithcaptcha", async (req, res) => {
			res.json({pending: !!this.captchaSolutionPromise});
			res.end();
		});

		beepboop.webApp.expressApp.get("/api/plugins/dealwithcaptcha/image", async (req, res) => {
			res.set("Content-Type", "image/png");
			res.write(this.captchaImage);
			res.end();
		});

		beepboop.webApp.expressApp.post("/api/plugins/dealwithcaptcha", async (req, res) => {
			if(this.captchaSolutionPromise && req.body && req.body.solution){
				this.captchaSolutionPromise.resolve(req.body.solution);
				this.captchaSolutionPromise = null;
			}
			res.end();
		});

		beepboop.webApp.addBrowserScript(() => {
			window.addEventListener("load", async () => {
				let res = await fetch("/api/plugins/dealwithcaptcha");
				let json = await res.json();
				if(json.pending){
					document.body.insertAdjacentHTML("beforeend", 
						`<fieldset style="position: fixed;top: 50%;left: 50%;transform: translate(-50%,-50%);">
							<legend>PLS HELP</legend>
							<p>Hello human!</p>
							<p>I require assistance with this robot countermeasure:</p>
							<form action="api/plugins/dealwithcaptcha" method="post" data-asyncsubmit="" data-beforesubmit="form[1].disabled = true;setTimeout(()=>location.reload(), 4000);">
								<img src="api/plugins/dealwithcaptcha/image" alt="captcha"><br>
								<input type="text" name="solution">
								<input type="submit" value="Send">
							</form>
						</fieldset>`
					);
					//@ts-ignore available on the page
					registerAsyncSubmitEvents();
				}
			});
		});
	}

	getCaptchaSolution(image){
		if(this.captchaSolutionPromise){
			this.captchaSolutionPromise.reject("Captcha solution rejected. Another captcha solution was requested.");
			this.captchaSolutionPromise = null;
		}
		this.captchaImage = image;
		this.captchaSolutionPromise.promise = new Promise((resolve, reject) => {
			this.captchaSolutionPromise = {resolve, reject};
		});

		return this.captchaSolutionPromise.promise;
	}
}
