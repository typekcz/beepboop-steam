const SteamBrowserGuiApi =  {
	login: (user, pass, selectors) => {
		document.querySelector(selectors.loginUsername).value = user;
		document.querySelector(selectors.loginPassword).value = pass;
	},

	verifyLogin: (selectors) => {
		return new Promise((resolve, reject) => {
			let checkInt = setInterval(() => {
				let errorMsg = document.querySelector(selectors.loginError);
				if(errorMsg && !errorMsg.innerText.blank()){
					console.error("Login error:", errorMsg.innerText);
					clearInterval(checkInt);
					reject(new Error("Login failed."));
				}

				if(document.querySelector(selectors.steamGuardInput)){
					resolve("steamguard");
				}
			}, 200);
			window.addEventListener("beforeunload", () => {
				clearInterval(checkInt);
				resolve(true);
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
	},

	clearSteamGuard: (selectors) => {
		document.querySelector(selectors.steamGuardInput)
			.querySelectorAll("input")
			.forEach(i => i.value = "");
	}
}

export default SteamBrowserGuiApi;