class ChatCommandEvent {
	constructor(steamChat, groupName, roomName, command, message, argument, userinfo){
		this.steamChat = steamChat;
		this.groupName = groupName;
		this.roomName = roomName;
		this.command = command;
		this.message = message;
		this.argument = argument;
		this.handled = false;
		this.userinfo = userinfo;
	}

	sendResponse(response){
		this.handled = true;
		return (async () => {
			await this.steamChat.getPage().type("textarea", response);
			await this.steamChat.getPage().click("textarea + button");
		})();
	}

	setAsHandled(){
		this.handled = true;
	}
}

module.exports = ChatCommandEvent;