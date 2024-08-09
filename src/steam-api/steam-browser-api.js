//@ts-check
import puppeteer from "puppeteer";
import DealWithCaptcha from "../deal-with-captcha.js";
import SteamBrowserGuiApi from "./steam-browser-gui-api.js";
import DealWithSteamGuard from "../deal-with-steam-guard.js";
import { unpromisify } from "../utils.js";
import timers from "node:timers/promises";

const selectors = {
	// Steam login selectors:
	loginUsername: "[data-featuretarget=login] input[type=text]",
	loginPassword: "[data-featuretarget=login] input[type=password]",
	loginRememberMe: "[data-featuretarget=login] div[tabindex]",
	loginCaptcha: "#input_captcha", // Captcha selectors are probably wrong, haven't seen the captcha in a while...
	loginCaptchaImg: "#captchaImg",
	loginError: "[data-featuretarget=login] form > div:last-of-type:not(:first-of-type)",
	loginButton: "[data-featuretarget=login] [type=submit]",
	steamGuardInput: "[data-featuretarget=login] div:has(> input)",
	// Steam Chat selectors:
	loading: ".WaitingForInterFaceReadyContainer",
	connectionTroubleButton: ".ConnectionTroubleReconnectMessage button"
};

const steamChatUrl = "https://steamcommunity.com/chat";

function pageLogFiltered(msg){
	if(msg.text().startsWith("Mixed Content:"))
		return;
	console.log("Page log:", msg.text());
}

export default class SteamBrowserApi {
	/**
	 * 
	 * @param {import("../beepboop.js").default} beepboop 
	 */
	constructor(beepboop){
		this.bb = beepboop;
		this.lastState = "uninitialized";
	}

	async init(){
		try {
			await this.bb.db?.none(
				`CREATE TABLE IF NOT EXISTS variable(
					name	text PRIMARY KEY,
					value	text NOT NULL
				)`
			);
		} catch(e){
			console.error(e.message);
		}
		let browserArgs = [
			"--disable-client-side-phishing-detection",
			"--disable-sync",
			"--use-fake-ui-for-media-stream",
			"--use-fake-device-for-media-stream",
			"--enable-local-file-accesses",
			"--allow-file-access-from-files",
			"--disable-web-security",
			"--reduce-security-for-testing",
			"--no-sandbox",
			"--disable-dev-shm-usage",
			"--disable-setuid-sandbox",
			"--disable-site-isolation-for-policy",
			"--allow-http-background-page",
			// Optimizations
			"--disable-site-isolation-trials",
			"--wm-window-animations-disabled",
			"--renderer-process-limit=1",
			"--enable-low-end-device-mode",
			"--disable-gpu",
			"--disable-software-rasterizer",
		];

		// Add this argument only when headless is enabled, otherwise it crashes.
		//if(this.bb.config.headless ?? true) 
		//	browserArgs.push("--single-process");

		this.browser = await puppeteer.launch({
			headless: this.bb.config.headless ?? true,
			args: browserArgs,
			userDataDir: "./chromium-user-data",
			executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
		});
		this.frame = (await this.browser.pages())[0];
		await this.frame.setRequestInterception(true);
		this.frame.on("request",
			req => {
				if(["image", "font"].includes(req.resourceType()))
					req.abort();
				else
					req.continue();
			}
		);
		await this.frame.setBypassCSP(true);
		// Steam won't accept HeadlessChrome
		let userAgent = await this.frame.evaluate(() => navigator.userAgent);
		userAgent = userAgent.replace("HeadlessChrome", "Chrome");
		await this.frame.setUserAgent(userAgent);
		this.frame.on("console", msg => pageLogFiltered);
		this.frame.on("pageerror", error => {
			if(error.message.startsWith("Failed to execute 'getStats' on 'RTCPeerConnection'"))
				return; // Ignore this message, because it's spamming the log
			console.log("Page error:", error.message)
		});
		let dealWithCaptcha = new DealWithCaptcha(this.bb);
		this.requestCaptchaSolution = (img) => dealWithCaptcha.getCaptchaSolution(img);
		this.requestSteamGuardCode = new DealWithSteamGuard(this.bb);

		this.bb.webApp.setupPageScreen(this.frame);

		await this.goToSteamChat();
		// Wait for Steam Chat loading to finish
		await this.frame.waitForSelector(selectors.loading, {hidden: true, timeout: 10000});

		setInterval(unpromisify(async () => this.detectStateAndAct()), 1000);
	}

	async goToSteamChat(){
		if(!this.frame)
			throw new Error("Steam chat frame not loaded.");
		try {
			await this.frame.goto(steamChatUrl, {waitUntil : "networkidle2"});
		} catch(e){
			console.error(e.message);
		}

		if(this.frame.url().includes("login")){
			await this.login(this.bb.config.steam?.userName, this.bb.config.steam?.password);
		}
	}

	async login(username, password){
		if(!this.frame)
			throw new Error("Steam chat frame not loaded.");
		await this.frame.waitForSelector(selectors.loginButton);
		await this.frame.type(selectors.loginUsername, username);
		await this.frame.type(selectors.loginPassword, password);
		await this.frame.evaluate(SteamBrowserGuiApi.rememberMe, selectors);
		await this.frame.click(selectors.loginButton);
		await this.frame.waitForNavigation({timeout: 10000}).catch(() => {});
		// TODO: This is a mess and needs refactor
		let verifyRes = await this.frame.evaluate(SteamBrowserGuiApi.verifyLogin, selectors);
		if(verifyRes === true){
			console.log("Login: Success.");
			if(!this.frame.url().startsWith(steamChatUrl))
				await this.frame.waitForNavigation({timeout: 5000, waitUntil: "networkidle2"});
		} else if(verifyRes === "steamguard"){
			console.log(`Steam Guard detected! You need to provide Steam Guard code. Visit ${this.bb.config.baseUrl} to fill it out.`);
			while(true) {
				let code = await this.requestSteamGuardCode.getSteamGuardCode();
				await this.frame.type(selectors.steamGuardInput, code);
				try {
					let verifyRes = await this.frame.evaluate(SteamBrowserGuiApi.verifyLogin, selectors);
					if(verifyRes === true){
						console.log("Login: Steam Guard completed.");
						// IDK let's just wait, this need refactor anyway
						await timers.setTimeout(10000);
						break;
					} else
						console.log("Login: Steam Guard failed. Trying again.");
				} catch(e){
					console.log("Login: Steam Guard failed. Trying again.");
				}
				await this.frame.evaluate(SteamBrowserGuiApi.clearSteamGuard, selectors);
			}
		} else if(verifyRes === "captcha"){
			console.log("Login: Captcha detected, requesting solution.");
			// Deal with captcha
			if(this.requestCaptchaSolution){
				while(true) {
					await this.frame.evaluate(SteamBrowserGuiApi.waitForCaptchaImage, selectors);
					let captchaElement = await this.frame.$(selectors.loginCaptchaImg);
					let solution = await this.requestCaptchaSolution(await captchaElement?.screenshot({type: "png"}));
					console.log("Login: Captcha solution received.");
					await this.frame.evaluate(SteamBrowserGuiApi.fillCaptcha, solution, selectors);
					try {
						await this.frame.evaluate(SteamBrowserGuiApi.verifyLogin, selectors);
						console.log("Login: Captcha solved.");
						break;
					} catch(e){
						console.log("Login: Captcha solution failed. Trying again.");
					}
				}
			} else {
				throw new Error("Captcha solver is not set.");
			}
		}
	}

	async detectState() {
		if(!this.frame)
			return "uninitialized";

		const readyState = await this.frame.evaluate(() => document.readyState);
		if(readyState != "complete")
			return "loading";

		return this.frame.evaluate(SteamBrowserGuiApi.detectState, selectors);
	}

	async detectStateAndAct(){
		const state = await this.detectState();
		const stateChanged = state !== this.lastState;
		this.lastState = state;
		if(stateChanged)
			console.log(`🔘 ${state}`);
		switch(state){
			case "chat-disconnected":
				console.log("Disconnect detected. Attempting reconnect.")
				await this.frame.evaluate(SteamBrowserGuiApi.reconnect, selectors);
				break;
			default:
				// TODO: do the rest, move whole login extravaganza here
				break;
		}
	}

	getFriendsUiFrame(){
		return this.getFriendsUiPage();
	}

	getFriendsUiPage(){
		if(!this.frame)
			throw new Error("FriendsUi page is not available.");
		return this.frame;
	}
}
