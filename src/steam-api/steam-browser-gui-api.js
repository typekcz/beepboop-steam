const SteamBrowserGuiApi =  {
	login: (user, pass, selectors) => {
		document.querySelector(selectors.loginUsername).value = user;
		document.querySelector(selectors.loginPassword).value = pass;
	},

	rememberMe: (selectors) => {
		let remember = document.querySelector(selectors.loginRememberMe);
		if(!remember.querySelector(selectors.loginRememberMeCheck))
			remember.click();
	},

	/** @type {(selectors: any) => "login"|"login-guard"|"chat"|"chat-disconnected"} */
	detectState: (selectors) => {
		if(location.pathname.startsWith("/login")){
			// On login page

			if(document.querySelector(selectors.steamGuardInput)){
				return "login-guard";
			} else {
				return "login";
			}
		} else if(location.pathname.startsWith("/chat")){
			// In chat

			let reconnectButton = document.querySelector(selectors.connectionTroubleButton);
			if(reconnectButton){
				return "chat-disconnected";
			} else {
				return "chat";
			}
		}
		return "unknown";
	},

	verifyLogin: (selectors) => {
		return new Promise((resolve, reject) => {
			let steamGuardCounter = 0;
			let checkInt = setInterval(() => {
				let errorMsg = document.querySelector(selectors.loginError);
				if(errorMsg && !errorMsg.innerText.blank()){
					console.error("Login error:", errorMsg.innerText);
					clearInterval(checkInt);
					reject(new Error("Login failed."));
				}

				if(document.querySelector(selectors.steamGuardInput)){
					// Delay Steam Guard detection, because when we check after typing code, it take a while to disappear
					if(steamGuardCounter++ > 10)
						resolve("steamguard");
				}

				if(window.g_FriendsUIApp)
					resolve(true); // Already in the chat
			}, 200);
			setTimeout(() => {
				clearInterval(checkInt);
				reject(new Error("Verify login timeout."));
			}, 20000);
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
	},

	reconnect: (selectors) => {
		document.querySelector(selectors.connectionTroubleButton)?.click();
	}
}

export default SteamBrowserGuiApi;