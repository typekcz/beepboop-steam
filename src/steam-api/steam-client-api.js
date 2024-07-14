//@ts-check
import puppeteer from "puppeteer";
import { retryPromise } from "../utils.js";

export default class SteamClientApi {
	async init(){
		await retryPromise(() => this.connectToCef(), 1000, Number.POSITIVE_INFINITY, true);
		await retryPromise(() => this.identifyPages(), 1000, Number.POSITIVE_INFINITY, true);
	}

	async connectToCef(){
		this.browser = await puppeteer.connect({
			browserURL: "http://localhost:8080", // Steam browser's devtools when launched with -cef-enable-debugging
			defaultViewport: null, // Don't resize the viewport
			ignoreHTTPSErrors: true
		});
	}

	async identifyPages(){
		if(!this.browser)
			throw new Error("Failed to connect to Steam CEF.");
		for(let page of await this.browser.pages()){
			if(page.isClosed())
				continue;
			let type = await page.evaluate(() => {
				// @ts-ignore
				if(SteamClient?.Apps)
					return "library";
				// @ts-ignore
				if(SteamClient?.WebChat)
					return "chat";
			});
			switch(type){
				case "library":
					this.libraryPage = page;
					break;
				case "chat":
					await page.setBypassCSP(true);
					await page.setExtraHTTPHeaders({
						"Content-Security-Policy": "base-uri 'self'; media-src *;"
					});
					await page.reload({waitUntil: "networkidle0", timeout: 30000});
					await page.setBypassCSP(true);
					this.chatPage = page;
					for(let frame of page.frames()){
						if(frame.name() === "tracked_frame_friends_chat")
							this.chatFrame = frame;
					}
					break;
			}
		}
		if(!this.chatPage)
			throw new Error("Failed to find chat page.");
		if(!this.chatFrame)
			throw new Error("Failed to find chat frame.");
		// @ts-ignore it exists damn it!
		this.chatFrame.waitForFunction(() => window.g_FriendsUIApp?.ready_to_render);
		this.chatPage.on("console", msg => {
			// Reduce the spam
			if(msg.text().startsWith("WebSocket connection to 'ws://127.0.0.1:27060/clientsocket/' failed")
				|| msg.text().startsWith("Mixed Content:")
			) return;
			console.log("Page log:", msg.text());
		});
		this.chatPage.on("pageerror", error => console.log("Page error:", error.message) );
		this.chatPage.on("requestfailed", request => console.log("Page request failed:", request?.failure()?.errorText, request.url));
	}

	getFriendsUiFrame(){
		if(!this.chatFrame)
		throw new Error("FriendsUi frame is not available.");
		//@ts-ignore
		return this.chatFrame;
	}

	getFriendsUiPage(){
		if(!this.chatPage)
			throw new Error("FriendsUi page is not available.");
		return this.chatPage;
	}
}
