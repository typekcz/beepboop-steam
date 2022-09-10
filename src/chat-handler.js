//@ts-check
import {VM} from "vm2";
import UserInfo from "./dto/user-info.js";
import RoomInfo from "./dto/room-info.js";
import ChatCommandEvent from "./chat-command-event.js";

const help_msg = `Commands:
play sound
playurl url
say text
pause
stop
play
beep
eval`;

export default class ChatHandler {
	/**
	 * @param {import("./beepboop").default} beepboop
	 */
	constructor(beepboop){
		this.bb = beepboop;

		this.bb.chatPage?.exposeFunction("handleMessage", (room, user, text, rawText) => {
			this.handleMessage(room, user, text, rawText);
		});

		let g_FriendsUIApp; // Fake for TS check
		let handleMessage = (a, b, c, d) => 1;
		this.bb.chatFrame?.evaluate(() => {
			g_FriendsUIApp.ChatStore.m_mapChatGroups.values().next().value.m_mapRooms.values().next().value.__proto__.CheckShouldNotify = function(msg, text, rawText){
				handleMessage(new RoomInfo(this), new UserInfo(this.GetMember(msg.unAccountID)), text, rawText);
			}
			g_FriendsUIApp.ChatStore.FriendChatStore.GetFriendChat(g_FriendsUIApp.FriendStore.m_self.accountid).__proto__.CheckShouldNotify = function(msg, text, rawText){
				handleMessage(null, new UserInfo(this.chat_partner), text, rawText);
			}
		});
	}

	get frame(){
		let f = this.bb.chatFrame;
		if(!f)
			throw new Error("FriendsUi frame is not available.");
		return f;
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
		let response = null;
		if(room == null || rawMessage.startsWith("[mention="+this.bb.steamChat.getLoggedUserInfo()?.accountid+"]")){
			if(room){
				console.log("handleMessage", room.groupName, "|", room.name, ":", rawMessage);
				rawMessage = rawMessage.substr(rawMessage.indexOf("[/mention]") + "[/mention]".length);
				message = message.substring((this.bb.steamChat.myName?.length ?? 0) + 2);
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
						if(arg)
							await this.bb.steamChatAudio.playSound(arg);
						else
							await this.bb.steamChatAudio.resumeSound();
						break;
					case "playurl":
						await this.bb.steamChatAudio.playSoundUrl(arg);
						break;
					case "say":
						if(!this.bb.config.ttsUrl)
							throw new Error("Missing text to speech URL.");
						await this.bb.steamChatAudio.textToSpeech(arg);
						break;
					case "stop":
					case "pause":
						await this.bb.steamChatAudio.stopSound();
						break;
					case "beep":
					case "beep?":
						response = "boop";
						break;
					case "eval":
						const vm = new VM({});
						let result = vm.run(arg);
						response = "/code " + JSON.stringify(result);
						break;
					default:
						let event = new ChatCommandEvent(this, room, user, command, message, arg, rawMessage);
						for(let listener of this.bb.steamChat.rawListeners("chatCommand")){
							await Promise.resolve(listener.call(this, event));
						}
						if(!event.handled)
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
				await this.bb.steamChatAudio.textToSpeech(response);
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
		let g_FriendsUIApp; // Fake for TS check
		await this.frame.evaluate((group, room, text) => {
			let g;
			if(/^\d*$/.test(group))
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
			if(/^\d*$/.test(room))
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
		let g_FriendsUIApp; // Fake for TS check
		await this.frame.evaluate((userId, text) => {
			g_FriendsUIApp.ChatStore.GetFriendChat(userId).SendChatMessage(text);
		}, userId, text);
	}
}