//@ts-check

export default class ChatCommandEvent {
	#handled = false;

	/**
	 * 
	 * @param {import("./chat-handler.js").default} chatHandler 
	 * @param {import("./dto/room-info.js").default} roomInfo 
	 * @param {import("./dto/user-info.js").default} userInfo 
	 * @param {string} command 
	 * @param {string} message 
	 * @param {string} argument 
	 * @param {string} rawMessage 
	 */
	constructor(chatHandler, roomInfo, userInfo, command, message, argument, rawMessage){
		this.chatHandler = chatHandler;
		this.roomInfo = roomInfo;
		this.groupName = (roomInfo != null)? roomInfo.groupName : null;
		this.roomName = (roomInfo != null)? roomInfo.name : null;
		this.command = command;
		this.message = message;
		this.rawMessage = rawMessage;
		this.argument = argument;
		this.userinfo = userInfo;
		/** @type {(response: string) => Promise<void> | null} */
		this.customResponseHandler = null;
	}

	/**
	 * 
	 * @param {string} response 
	 * @param {string|boolean} ttsText 
	 */
	async sendResponse(response, ttsText = true){
		this.handled = true;

		if(this.customResponseHandler)
			return this.customResponseHandler(response);

		if(this.roomInfo != null)
			await this.chatHandler.sendGroupMessage(this.roomInfo.groupId, this.roomInfo.id, response);
		else
			await this.chatHandler.sendDirectMessage(this.userinfo.accountid, response);
		let isUserInRoom = (await this.chatHandler.bb.steamChat.getVoiceChannelUsers()).some(u => u.steamid === this.userinfo.steamid);
		if(ttsText && isUserInRoom){
			if(ttsText === true)
				ttsText = response;
			this.chatHandler.bb.steamChatAudio.textToSpeech(ttsText);
		}
	}

	setAsHandled(){
		this.#handled = true;
	}

	set handled(val){
		if(val)
			this.#handled = true;
	}

	get handled(){
		return this.#handled;
	}
}