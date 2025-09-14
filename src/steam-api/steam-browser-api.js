//@ts-check
import puppeteer from "puppeteer";
import DealWithCaptcha from "../deal-with-captcha.js";
import SteamBrowserGuiApi from "./steam-browser-gui-api.js";
import DealWithSteamGuard from "../deal-with-steam-guard.js";
import { unpromisify } from "../utils.js";
import { EventEmitter } from "node:events";

const selectors = {
	// Steam login selectors:
	loginArea: "[data-featuretarget=login]",
	loginUsername: "[data-featuretarget=login] input[type=text]",
	loginPassword: "[data-featuretarget=login] input[type=password]",
	loginRememberMe: "[data-featuretarget=login] div[tabindex]",
	loginCaptcha: "#input_captcha", // Captcha selectors are probably wrong, haven't seen the captcha in a while...
	loginCaptchaImg: "#captchaImg",
	loginError: "[data-featuretarget=login] form > div:last-of-type:not(:first-of-type)",
	loginButton: "[data-featuretarget=login] [type=submit]",
	steamGuardInput: "[data-featuretarget=login] div:has(> input) .wtf",
	// Steam Chat selectors:
	loading: ".WaitingForInterFaceReadyContainer",
	connectionTroubleButton: ".ConnectionTroubleReconnectMessage button"
};

const steamChatUrl = "https://steamcommunity.com/chat";

/**
 * @param {puppeteer.ConsoleMessage} msg 
 * @returns 
 */
function pageLogFiltered(msg){
	if(msg.text().startsWith("Mixed Content:")) return;
	if(msg.text().startsWith("Failed to load resource: net::ERR_FAILED")) return;
	console.log("Page log:", msg.text());
}

export default class SteamBrowserApi extends EventEmitter {
	/**
	 * 
	 * @param {import("../beepboop.js").default} beepboop 
	 */
	constructor(beepboop){
		super();
		this.bb = beepboop;
		this.lastState = "uninitialized";
		this.stateMethodRunning = false;
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
		this.frame.on("console", pageLogFiltered);
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
	}

	async doLogin(){
		const username = this.bb.config.steam?.userName
		const password = this.bb.config.steam?.password;

		if(!this.frame)
			throw new Error("Steam chat frame not loaded.");

		await this.frame.type(selectors.loginUsername, username);
		await this.frame.type(selectors.loginPassword, password);
		await this.frame.evaluate(SteamBrowserGuiApi.rememberMe, selectors);
		await this.frame.click(selectors.loginButton);
	}

	async doLoginGuard() {
		console.log(`Steam Guard detected! You need to provide Steam Guard code. Visit ${this.bb.config.baseUrl} to fill it out.`);
		let code = await this.requestSteamGuardCode.getSteamGuardCode();
		
		await this.frame.evaluate(SteamBrowserGuiApi.clearSteamGuard, selectors);
		await this.frame.type(selectors.steamGuardInput, code);
	}

	async doLoginCaptcha() {
		console.log("Login: Captcha detected, requesting solution.");
		// Deal with captcha
		if(this.requestCaptchaSolution){
			await this.frame.evaluate(SteamBrowserGuiApi.waitForCaptchaImage, selectors);
			let captchaElement = await this.frame.$(selectors.loginCaptchaImg);
			let solution = await this.requestCaptchaSolution(await captchaElement?.screenshot({type: "png"}));
			console.log("Login: Captcha solution received.");
			await this.frame.evaluate(SteamBrowserGuiApi.fillCaptcha, solution, selectors);
		} else {
			throw new Error("Captcha solver is not set.");
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
		// Preven method from running multiple times
		if(this.stateMethodRunning) return;
		this.stateMethodRunning = true;
		try {
			try {
				await this.frame.waitForNetworkIdle({ timeout: 5_000, concurrency: 3 });
			} catch(e) {/* Ingore error */}
			const state = await this.detectState();
			const stateChanged = state !== this.lastState;
			this.lastState = state;
			if(!stateChanged)
				return;
			console.log(`🔘 ${state}`);
			switch(state){
				case "login":
					await this.doLogin();
					break;
				case "login-guard":
					await this.doLoginGuard();
					break;
				case "login-error":
					await this.goToSteamChat();
					break;
				case "chat-disconnected":
					console.log("Disconnect detected. Attempting reconnect.")
					await this.goToSteamChat();
					break;
				default:
					break;
			}
			this.emit(state);
		} finally {
			this.stateMethodRunning = false;
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
