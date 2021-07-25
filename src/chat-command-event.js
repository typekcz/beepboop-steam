class ChatCommandEvent {
	constructor(steamChat, roomInfo, userInfo, command, message, argument, rawMessage){
		this.steamChat = steamChat;
		this.roomInfo = roomInfo;
		this.groupName = (roomInfo != null)? roomInfo.groupName : null;
		this.roomName = (roomInfo != null)? roomInfo.name : null;
		this.command = command;
		this.message = message;
		this.rawMessage = rawMessage;
		this.argument = argument;
		this.handled = false;
		this.userinfo = userInfo;
	}

	async sendResponse(response){
		this.handled = true;
		if(this.roomInfo != null)
			await this.steamChat.sendMessage(this.roomInfo.groupId, this.roomInfo.id, response);
		else
			await this.steamChat.sendDirectMessage(this.userinfo.accountid, response);
	}

	setAsHandled(){
		this.handled = true;
	}
}

module.exports = ChatCommandEvent;