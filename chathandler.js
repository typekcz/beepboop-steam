const {VM} = require('vm2');
const UserInfo = require("./userinfo");
const RoomInfo = require("./roominfo");
const ChatCommandEvent = require("./chatcommandevent");

const help_msg = `Commands:
play sound
playurl url
say text
stop
beep
eval`;

class ChatHandler {
	/**
	 * @param {Page} page - Puppeteer page
	 */
	constructor(steamChat){
		this.steamChat = steamChat;
		this.page = steamChat.getPage();
		
		this.page.exposeFunction("handleMessage", (room, user, text, rawText) => {
			this.handleMessage(room, user, text, rawText);
		});

		this.page.evaluate(() => {
			g_FriendsUIApp.ChatStore.m_mapChatGroups.values().next().value.m_mapRooms.values().next().value.__proto__.CheckShouldNotify = function(msg, text, rawText){
				handleMessage(new RoomInfo(this), new UserInfo(this.GetMember(msg.unAccountID)), text, rawText);
			}
			g_FriendsUIApp.ChatStore.FriendChatStore.GetFriendChat(g_FriendsUIApp.FriendStore.m_self.accountid).__proto__.CheckShouldNotify = function(msg, text, rawText){
				handleMessage(null, new UserInfo(this.chat_partner), text, rawText);
			}
		});
	}

	async handleMessage(room, user, message, rawMessage){
		const unknownMessages = [
			"The fuck you want?",
			"I'm not fluent in meatbag language.",
			"Fuck you too."
		];
		const errorMessages = [
			"Nope.",
			"418 I'm a teapot.",
			"E̴͚̠̰̺͎̘ͫR̮͈͓̆͜R͕̩̩̭̙͘Ȯ͖̜̱̞̜ͮR̉.",
			"/me is currently unavailable.",
			"No can do."
		];
		//message = /.*: "(.*)"/.exec(message)[1];
		let response = null;
		if(room == null || rawMessage.startsWith("[mention="+this.steamChat.getLoggedUserInfo().accountid+"]")){
			if(room){
				console.log("handleMessage", room.groupName, "|", room.name, ":", rawMessage);
				rawMessage = rawMessage.substr(rawMessage.indexOf("[/mention]") + "[/mention]".length);
				message = message.substring(this.steamChat.myName.length + 2);
			}
			let index = message.indexOf(" ");
			if(index < 0)
				index = message.length;
			let command = message.substr(0, index).trim();
			let arg = message.substr(index + 1);
			try {
				switch(command.toLowerCase()){
					case "help":
						response = help_msg;
						break;
					case "play":
						await this.steamChat.playSound(arg);
						break;
					case "playurl":
						await this.steamChat.playSoundUrl(arg);
						break;
					case "say":
						if(!this.steamChat.ttsUrl)
							throw new Error("Missing text to speech URL.");
						await this.steamChat.textToSpeech(arg);
						break;
					case "stop":
						await this.steamChat.stopSound();
						break;
					case "beep":
					case "beep?":
						response = "boop";
						break;
					case "eval":
						const vm = new VM({
							wrapper: "none"
						});
						let result = vm.run(arg);
						response = "/code " + JSON.stringify(result);
						break;
					default:
						let event = new ChatCommandEvent(this.steamChat, room, user, command, message, arg, rawMessage);
						for(let listener of this.steamChat.rawListeners("chatCommand")){
							await Promise.resolve(listener.call(this.steamChat, event));
						}
						if(event.handled)
							response = null;
						else
							response = unknownMessages[Math.round(Math.random()*(unknownMessages.length - 1))];
						break;
				}
			} catch(e){
				console.log("command error", e.message);
				response = errorMessages[Math.round(Math.random()*(errorMessages.length - 1))] + "\n" + e.message;
			}
		}
		if(response){
			console.log("response", response);
			try {
				await this.steamChat.textToSpeech(response);
			} catch(e){
				console.error(e);
			}
			if(room)
				await this.sendGroupMessage(room.groupId, room.id, response);
			else
				await this.sendDirectMessage(user.accountid, response);
		}
	}

	async sendGroupMessage(group, room, text){
		await this.page.evaluate((group, room, text) => {
			let g;
			if(/^[0-9]*$/.test(group))
				g = g_FriendsUIApp.ChatStore.m_mapChatGroups.get(group);
			else {
				for(let i of g_FriendsUIApp.ChatStore.m_mapChatGroups.values()){
					if(i.name == group){
						g = i;
					}
				}
			}
			if(!g)
				throw new Error("ChatHandler.sendGroupMessage: Group \""+group+"\" not found.");
			
			let r;
			if(/^[0-9]*$/.test(room))
				r = g.m_mapRooms.get(room);
			else {
				for(let i of g.m_mapRooms.values()){
					if(i.name == room){
						r = i;
					}
				}
			}
			if(!r)
				throw new Error("ChatHandler.sendGroupMessage: Room \""+room+"\" not found in group \""+group+"\".");

			r.SendChatMessage(text);
		}, group, room, text);
	}

	async sendDirectMessage(userId, text){
		await this.page.evaluate((userId, text) => {
			g_FriendsUIApp.ChatStore.GetFriendChat(userId).SendChatMessage(text);
		}, userId, text);
	}
}

module.exports = ChatHandler;