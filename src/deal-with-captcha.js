const utils = require("./utils");

class DealWithCaptcha {
	constructor(apiGW){
		this.apiGW = apiGW;
		this.captchaSolutionPromise = null;
		this.captchaImage = null;

		apiGW.webApp.expressApp.get("/api/plugins/dealwithcaptcha", async (req, res) => {
			res.json({pending: !!this.captchaSolutionPromise});
			res.end();
		});

		apiGW.webApp.expressApp.get("/api/plugins/dealwithcaptcha/image", async (req, res) => {
			res.set("Content-Type", "image/png");
			res.write(this.captchaImage);
			res.end();
		});

		apiGW.webApp.expressApp.post("/api/plugins/dealwithcaptcha", async (req, res) => {
			if(this.captchaSolutionPromise && req.body && req.body.solution){
				this.captchaSolutionPromise.resolve(req.body.solution);
				this.captchaSolutionPromise = null;
			}
			res.end();
		});

		apiGW.webApp.addBrowserScript(() => {
			window.addEventListener("load", async () => {
				let res = await fetch("/api/plugins/dealwithcaptcha");
				let json = await res.json();
				if(json.pending){
					document.body.insertAdjacentHTML("beforeend", 
						`<fieldset style="position: fixed;top: 50%;left: 50%;transform: translate(-50%,-50%);">
							<legend>PLS HELP</legend>
							<p>Hello human!</p>
							<p>I require assistance with this robot countermeasure:</p>
							<form action="/api/plugins/dealwithcaptcha" method="post" data-asyncsubmit="" data-beforesubmit="form[1].disabled = true;setTimeout(()=>location.reload(), 4000);">
								<img src="/api/plugins/dealwithcaptcha/image" alt="captcha"><br>
								<input type="text" name="solution">
								<input type="submit" value="Send">
							</form>
						</fieldset>`
					);
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
		this.captchaSolutionPromise = {};
		this.captchaSolutionPromise.promise = new Promise((resolve, reject) => {
			this.captchaSolutionPromise.resolve = resolve;
			this.captchaSolutionPromise.reject = reject;
		});

		return this.captchaSolutionPromise.promise;
	}
}

module.exports = DealWithCaptcha;