const puppeteer = require("puppeteer-core");
const utils = require("../utils");

class SteamGateway {
	async connectToCef(){
		this.browser = await puppeteer.connect({
			browserURL: "http://localhost:8080",
			defaultViewport: null
		});
		await this.identifyPages();
	}

	async identifyPages(){
		for(let page of await this.browser.pages()){
			let type = await page.evaluate(() => {
				if(SteamClient?.Apps)
					return "library";
				if(SteamClient?.WebChat)
					return "chat";
			});
			switch(type){
				case "library":
					this.libraryPage = page;
					break;
				case "chat":
					this.chatPage = page;
					for(let frame of page.frames())
						if(frame.name() === "tracked_frame_friends_chat")
							this.chatFrame = frame;
					break;
			}
		}
	}

	/**
	 * @returns {Promise<{displayName: string, accountId: number}>}
	 */
	async getSelf(){
		return this.chatFrame.evaluate(() => g_FriendsUIApp.FriendStore.m_self);
	}

	/**
	 * @returns {Promise<{id: string, name: string, tagLine: string}[]>}
	 */
	async getGroups(){
		return this.chatFrame.evaluate(() => [...g_FriendsUIApp.ChatStore.m_mapChatGroups.values()].map(
			g => {return {id: g.m_ulGroupID, name: g.name, tagLine: g.tagLine}}
		));
	}
}

module.exports = SteamGateway;