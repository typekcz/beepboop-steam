//@ts-check
import puppeteer from "puppeteer";
import DealWithCaptcha from "../deal-with-captcha";
import SteamBrowserGuiApi from "./steam-browser-gui-api";

const selectors = {
	loginUsername: "#input_username",
	loginPassword: "#input_password",
	loginCaptcha: "#input_captcha",
	loginCaptchaImg: "#captchaImg",
	loginError: "#error_display",
	loginButton: "#login_btn_signin button",
	loading: ".main_throbberContainer-exit-active_24VO6",
	loggedUsername: ".personanameandstatus_playerName_1uxaf",
	groupList: ".ChatRoomList .ChatRoomListGroupItem",
	groupListItem: ".chatRoomName",
	groupListItemChatroomList: ".ChatRoomListGroupItemChatRooms",
	groupListItemOpenBtn: ".openGroupButton",
	groupListItemVoiceChannel: ".chatRoomVoiceChannel .chatRoomVoiceChannelName",
	groupChatTab: "div.chatDialogs div.chatWindow.MultiUserChat.namedGroup",
	voiceChannelUsers: ".chatRoomVoiceChannelsGroup", // Extended to entire voice channels list to capture users change even if out of room.
	loggedOut: ".ConnectionTroubleMessage:not(.NotificationBrowserWarning)",
	activeVoice: ".activeVoiceControls",
	fileUpload: ".chatEntry input[name=fileupload]",
	confirmFileUpload: ".chatFileUploadBtn",
	audioElementContainer: ".main_SteamPageHeader_3EaXO", // Just some place to put audio element
	activeVoiceName: ".ActiveVoiceChannel .chatRoomVoiceChannelName",
	connectionStatus: ".activeVoiceControls .connectionStatus", // Place where reconnecting message appears
	leaveVoiceBtn: ".VoiceControlPanelButton.chatEndVoiceChat"
};

export default class SteamBrowserApi {
	/**
	 * 
	 * @param {import("../beepboop").default} beepboop 
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
			headless: false,
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
		await this.frame.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36");
		this.frame.on("console", msg => console.log("Page log:", msg.text()) );
		this.frame.on("pageerror", error => console.log("Page error:", error.message) );
		this.frame.on("requestfailed", request => console.log("Page request failed:", request?.failure()?.errorText, request.url));

		let dealWithCaptcha = new DealWithCaptcha(this.bb);
		this.requestCaptchaSolution = (img) => dealWithCaptcha.getCaptchaSolution(img);

		await this.goToSteamChat();
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
			await this.frame.goto("https://steamcommunity.com/chat", {waitUntil : "networkidle2"});
		} catch(e){
			console.error(e.message);
		}

		if(this.frame.url().includes("login")){
			console.log("login");
			await this.login(this.bb.config.steam?.userName, this.bb.config.steam?.password);
		}
	}

	async login(username, password){
		if(!this.frame)
			throw new Error("Steam chat frame not loaded.");
		try {
			if(await this.frame.evaluate(SteamBrowserGuiApi.login, username, password, selectors)){
				await this.frame.evaluate(SteamBrowserGuiApi.verifyLogin, selectors);
				console.log("Login: Success.");
			} else {
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
		} catch(error){
			console.log(error);
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