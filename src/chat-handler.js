//@ts-check
import UserInfo from "./dto/user-info.js";
import RoomInfo from "./dto/room-info.js";
import ChatCommandEvent from "./chat-command-event.js";
import createSteamChatAudioCommands from "./chat-commands/commands-steam-chat-audio.js";
import { createBasicCommands } from "./chat-commands/commands-basic.js";
import { createAdminCommands } from "./chat-commands/commands-admin.js";

/**
 * @typedef {(e: ChatCommandEvent) => Promise<?>|void} ChatCommandHandler
 */

/**
 * @typedef ChatCommand
 * @property {string|string[]} command
 * @property {ChatCommandHandler} handler
 * @property {string} [argsHelp]
 * @property {string} [help]
 * @property {string} [longHelp]
 */

export default class ChatHandler {
	/** @type {ChatCommand[]} */
	#chatCommands = [];
	/** @type {Map<string, ChatCommand>} */
	#chatCommandsMap = new Map();

	/**
	 * @param {import("./beepboop.js").default} beepboop
	 */
	constructor(beepboop){
		this.bb = beepboop;

		this.addCommands(...createBasicCommands(this.bb, this.#chatCommandsMap));
		this.addCommands(...createSteamChatAudioCommands(this.bb));
		this.addCommands(...createAdminCommands(this.bb));
	}

	init(){
		this.bb.chatPage?.exposeFunction("handleMessage", (room, user, text, rawText) => {
			this.handleMessage(room, user, text, rawText).catch(console.error);
		}).catch(console.error);

		let g_FriendsUIApp; // Fake for TS check
		let handleMessage = (/** @type {RoomInfo} */ room, /** @type {UserInfo} */ user, /** @type {any} */ text, /** @type {any} */ rawText) => {};
		this.bb.chatFrame?.evaluate(() => {
			g_FriendsUIApp.ChatStore.m_mapChatGroups.values().next().value.m_mapRooms.values().next().value.__proto__.CheckShouldNotify = function(msg, text, rawText){
				handleMessage(new RoomInfo(this), new UserInfo(this.GetMember(msg.unAccountID)), text, rawText);
			}
			g_FriendsUIApp.ChatStore.FriendChatStore.GetFriendChat(g_FriendsUIApp.FriendStore.m_self.accountid).__proto__.CheckShouldNotify = function(msg, text, rawText){
				handleMessage(null, new UserInfo(this.chat_partner), text, rawText);
			}
		}).catch(console.error);
	}

	get frame(){
		let f = this.bb.chatFrame;
		if(!f)
			throw new Error("FriendsUi frame is not available.");
		return f;
	}

	/**
	 * 
	 * @param {RoomInfo} room 
	 * @param {UserInfo} user 
	 * @param {string} message 
	 * @param {string} rawMessage 
	 * @param {(response: string) => Promise<void> | null} [customResponseHandler]
	 */
	async handleMessage(room, user, message, rawMessage, customResponseHandler = null){
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

		if(room != null && !rawMessage.startsWith("[mention="+this.bb.steamChat.getLoggedUserInfo()?.accountid+"]"))
			return;

		if(room){
			console.log("handleMessage", room.groupName, "|", room.name, ":", rawMessage);
			rawMessage = rawMessage.substring(rawMessage.indexOf("[/mention]") + "[/mention]".length);
			message = message.substring((this.bb.steamChat.myName?.length ?? 0) + 2);
		}
		let index = message.indexOf(" ");
		if(index < 0)
			index = message.length;
		let command = message.substring(0, index).trim();
		let arg = message.substring(index + 1);
		let event = new ChatCommandEvent(this, room, user, command, message, arg, rawMessage);
		if(customResponseHandler)
			event.customResponseHandler = customResponseHandler;
		try {
			command = command.toLowerCase();
			let chatCommand = this.#chatCommandsMap.get(command);
			if(chatCommand){
				await chatCommand.handler(event);
				event.setAsHandled();
			}

			if(!event.handled)
				event.sendResponse(unknownMessages[Math.round(Math.random()*(unknownMessages.length - 1))]);
		} catch(e){
			console.log("command error", e.message);
			event.sendResponse(errorMessages[Math.round(Math.random()*(errorMessages.length - 1))] + "\n" + e.message);
		}
	}

	/**
	 * 
	 * @param {ChatCommand[]} chatCommands
	 */
	addCommands(...chatCommands){
		for(let chatCommand of chatCommands){
			let commands = Array.isArray(chatCommand.command)? chatCommand.command: [chatCommand.command];
			commands = commands.map(s => s.toLowerCase());
			let anySet = false;
			for(let command of commands){
				if(!/^[^\s]+$/.test(command))
					throw new Error(`Cannot use word "${command}" as command. No whitespace characters are allowed.`);
				if(this.#chatCommandsMap.has(command))
					console.warn(`Command "${command}" is already used. Skipping.`);
				this.#chatCommandsMap.set(command, chatCommand);
				anySet = true;
			}
			if(anySet)
				this.#chatCommands.push(chatCommand);
			else
				console.error(`Command was not added. All command words (${commands.join(", ")}) are already used.`);
		}
	}

	/**
	 * 
	 * @param {string} group 
	 * @param {string} room 
	 * @param {string} text 
	 */
	async sendGroupMessage(group, room, text){
		let g_FriendsUIApp; // Fake for TS check
		await this.frame.evaluate(
			/** @type {(group: string, room: string, text: string) => void} */
			(group, room, text) => {
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