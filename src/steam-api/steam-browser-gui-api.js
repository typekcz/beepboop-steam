const SteamBrowserGuiApi =  {
	login: (user, pass, selectors) => {
		document.querySelector(selectors.loginUsername).value = user;
		document.querySelector(selectors.loginPassword).value = pass;
		let captcha_input = document.querySelector(selectors.loginCaptcha);
		if(captcha_input.offsetParent != null){
			// Captcha detected
			return false;
		}
		document.querySelector(selectors.loginButton).click();
		return true;
	},

	verifyLogin: (selectors) => {
		return new Promise((resolve, reject) => {
			let checkInt = setInterval(() => {
				if(document.querySelector(selectors.loginError).offsetParent != null){
					clearInterval(checkInt);
					reject(new Error("Login failed."));
				}
			}, 200);
			window.addEventListener("beforeunload", () => {
				clearInterval(checkInt);
				resolve();
			});
		});
	},

	waitForCaptchaImage: async (selectors) => {
		let img = document.querySelector(selectors.loginCaptchaImg);
		if(!img.complete){
			await new Promise((resolve => {
				img.onload = () => resolve();
			}));
		}
	},

	fillCaptcha: (solution, selectors) => {
		document.querySelector(selectors.loginCaptcha).value = solution;
		document.querySelector(selectors.loginButton).click();
	}
}

export default SteamBrowserGuiApi;