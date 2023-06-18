//@ts-check
import puppeteer from "puppeteer";
import DealWithCaptcha from "../deal-with-captcha.js";
import SteamBrowserGuiApi from "./steam-browser-gui-api.js";
import DealWithSteamGuard from "../deal-with-steam-guard.js";

const selectors = {
	loginUsername: "[type=text].newlogindialog_TextInput_2eKVn",
	loginPassword: "[type=password].newlogindialog_TextInput_2eKVn",
	loginCaptcha: "#input_captcha",
	loginCaptchaImg: "#captchaImg",
	loginError: ".newlogindialog_FormError_1Mcy9",
	loginButton: "[type=submit].newlogindialog_SubmitButton_2QgFE",
	loading: ".WaitingForInterFaceReadyContainer",
	steamGuardInput: ".segmentedinputs_SegmentedCharacterInput_3PDBF"
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
		const browser = await puppeteer.launch({
			headless: true,
			args: [
				"--disable-client-side-phishing-detection",
				"--disable-sync",
				"--use-fake-ui-for-media-stream",
				"--use-fake-device-for-media-stream",
				"--enable-local-file-accesses",
				"--allow-file-access-from-files",
				"--disable-web-security",
				"--reduce-security-for-testing",
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--incognito",
				"--disable-site-isolation-for-policy",
				"--allow-http-background-page"
			]
		});
		this.frame = (await browser.pages())[0];
		await this.loadCookies();
		await this.frame.setBypassCSP(true);
		// Steam won't accept HeadlessChrome
		let userAgent = await this.frame.evaluate(() => navigator.userAgent);
		userAgent = userAgent.replace("HeadlessChrome", "Chrome");
		await this.frame.setUserAgent(userAgent);
		this.frame.on("console", msg => pageLogFiltered);
		this.frame.on("pageerror", error => console.log("Page error:", error.message) );
		this.frame.on("requestfailed", request => console.log("Page request failed:", request?.failure()?.errorText, request.url));

		let dealWithCaptcha = new DealWithCaptcha(this.bb);
		this.requestCaptchaSolution = (img) => dealWithCaptcha.getCaptchaSolution(img);
		this.requestSteamGuardCode = new DealWithSteamGuard(this.bb);

		this.bb.webApp.setupPageScreen(this.frame);

		await this.goToSteamChat();
		// Wait for Steam Chat loading to finish
		await this.frame.waitForSelector(selectors.loading, {hidden: true, timeout: 10000});
	}

	async storeCookies(){
		if(!this.frame)
			throw new Error("Steam chat frame not loaded");
		try {
			let localStorageJson = await this.frame.evaluate(() => {
				return JSON.stringify(window.localStorage);
			});
			await this.bb.db?.none(
				"INSERT INTO variable(name, value) VALUES('localStorage', $1) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value",
				[ localStorageJson ]
			);

			await this.bb.db?.none(
				"INSERT INTO variable(name, value) VALUES('cookies', $1) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value",
				[ JSON.stringify(await this.frame.cookies()) ]
			);
		} catch(e){
			console.error(e.message);
			return null;
		}
	}

	async loadCookies(){
		if(!this.frame)
			throw new Error("Steam chat frame not loaded.");
		try {
			await this.frame.goto("https://steamcommunity.com/comment/ForumTopic/formattinghelp?ajax=1");
			let localStorageRow = await this.bb.db?.oneOrNone("SELECT value FROM variable WHERE name = 'localStorage'");
			if(localStorageRow){
				let localStorageData = JSON.parse(localStorageRow.value.toString());
				await this.frame.evaluate((localStorageData) => {
					Object.assign(window.localStorage, localStorageData);
				}, localStorageData);
			}

			let cookiesRow = await this.bb.db?.oneOrNone("SELECT value FROM variable WHERE name = 'cookies'");
			if(cookiesRow){
				let cookies = JSON.parse(cookiesRow.value.toString());
				for(let cookie of cookies)
					await this.frame.setCookie(cookie);
			}
		} catch(e){
			console.error(e.message);
		}
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
				await this.frame.waitForTimeout(3000);
				try {
					let verifyRes = await this.frame.evaluate(SteamBrowserGuiApi.verifyLogin, selectors);
					if(verifyRes === true){
						console.log("Login: Steam Guard completed.");
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

	getFriendsUiFrame(){
		return this.getFriendsUiPage();
	}

	getFriendsUiPage(){
		if(!this.frame)
			throw new Error("FriendsUi page is not available.");
		return this.frame;
	}
}