const https = require('https');
const EventEmitter = require('events');
const ytdl = require("ytdl-core");
const UserInfo = require("./user-info");
const RoomInfo = require("./room-info");
const ChatHandler = require("./chat-handler");
const pageInteractions = require("./steam-chat-page-interactions");

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

class ConnectionTroubleEvent {
	constructor(message){
		this.message = message;
	}
}

class SteamChat extends EventEmitter {
	/**
	 * @param {import('puppeteer').Page} page - Puppeteer page
	 * @param {string} soundsBaseUrl 
	 * @param {string} youtubeBaseUrl 
	 * @param {import('./sounds-db-gw')} soundsDbGw 
	 * @param {string} ttsUrl 
	 */
	constructor(page, soundsBaseUrl, youtubeBaseUrl, soundsDbGw, ttsUrl){
		super();
		this.page = page;
		this.soundsBaseUrl = soundsBaseUrl;
		this.youtubeBaseUrl = youtubeBaseUrl;
		this.soundsDbGw = soundsDbGw;
		this.groupName = null;
		/** @type {string[]} */
		this.joinedUsers = [];
		this.ttsUrl = ttsUrl;
		/** @type {function(Buffer): Promise<string>} */
		this.requestCaptchaSolution = null;
		this.reconnectOnUserJoin = false;

		// Functions can be exposed only once to a page!
		this.page.exposeFunction("findChatRoom", (message) => {
			return this.findChatRoom(message);
		});

		this.page.exposeFunction("handleMessage", (room, user, text, rawText) => {
			this.chatHandler.handleMessage(room, user, text, rawText);
		});

		this.page.exposeFunction("joinedUsersChanged", async () => {
			this.voiceChannelUsersChanged();
		});
	}

	getPage(){
		return this.page;
	}

	/**
	 * Initialize page for use.
	 * @param {number} volume 
	 */
	async init(volume){
		try {
			await this.page.waitForSelector(selectors.loading);
		} catch(e){
			console.log(e);
		}

		this.page.evaluate(pageInteractions.initAudio, volume, selectors);

		await this.page.evaluate(pageInteractions.define, "UserInfo", UserInfo.toString());
		await this.page.evaluate(pageInteractions.define, "RoomInfo", RoomInfo.toString());
		await this.page.evaluate(pageInteractions.init);

		if(!this.activityInterval){
			this.activityInterval = setInterval(async () => {
				let connectionTrouble = await this.page.evaluate(pageInteractions.getLoggedOutMessage, selectors);
				if(connectionTrouble)
					this.emit("connectionTrouble", new ConnectionTroubleEvent(connectionTrouble));
			},60000);
		}

		this.chatHandler = new ChatHandler(this);

		this.loggedUser = await this.page.evaluate(pageInteractions.getLoggedUserInfo);
		this.myName = this.loggedUser.name;
	}

	setCaptchaSolver(func){
		this.requestCaptchaSolution = func;
	}

	async login(username, password){
		try {
			if(await this.page.evaluate(pageInteractions.login, username, password, selectors)){
				await this.page.evaluate(pageInteractions.verifyLogin, selectors);
				console.log("Login: Success.");
			} else {
				console.log("Login: Captcha detected, requesting solution.");
				// Deal with captcha
				if(this.requestCaptchaSolution){
					while(true) {
						await this.page.evaluate(pageInteractions.waitForCaptchaImage, selectors);
						let captchaElement = await this.page.$(selectors.loginCaptchaImg);
						let solution = await this.requestCaptchaSolution(await captchaElement.screenshot({type: "png"}));
						console.log("Login: Captcha solution received.");
						await this.page.evaluate(pageInteractions.fillCaptcha, solution, selectors);
						try {
							await this.page.evaluate(pageInteractions.verifyLogin, selectors);
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

	getLoggedUserInfo(){
		return this.loggedUser;
	}

	async sendMessage(group, chatRoom, message){
		await this.chatHandler.sendGroupMessage(group, chatRoom, message);
	}

	async sendDirectMessage(userId, text){
		await this.chatHandler.sendDirectMessage(userId, text);
	}

	async uploadFile(groupName, chatRoom, filename){
		await this.openGroup(groupName, chatRoom);
		let uploadElement = await this.page.$(selectors.fileUpload);
		await uploadElement.uploadFile(filename);
		let btn = await this.page.waitForSelector(selectors.confirmFileUpload);
		await btn.click();
	}

	async textToSpeech(text){
		if(this.ttsUrl){
			text = text.replace("/me", this.myName);
			await this.playSoundUrl(this.ttsUrl + encodeURIComponent(text));
		}
	}

	findChatRoom(groupName){
		return this.page.evaluate(pageInteractions.findChatRoom, groupName);
	}

	getGroups(){
		return this.page.evaluate(pageInteractions.getAllGroups, selectors);
	}

	getVoiceChannels(group){
		return this.page.evaluate(pageInteractions.getAllVoiceRooms, group, selectors);
	}

	async openGroup(group, chatroom = null){
		let groupId = await this.getGroupIdByName(group);
		await this.page.evaluate(pageInteractions.openGroupChatRoom, groupId, chatroom, selectors);
		try {
			await this.page.waitForSelector(selectors.groupChatTab);
		} catch(e){
			console.log(e);
		}
	}

	async getGroupIdByName(name){
		return this.page.evaluate(pageInteractions.getGroupId, name);
	}

	async getGroupMembers(groupId){
		// Group has to be opened for this to work!
		return this.page.evaluate(pageInteractions.getGroupMembers, groupId.toString());
	}

	async getVoiceChannelUsers(){
		return this.page.evaluate(pageInteractions.getVoiceRoomUsers);
	}

	async voiceChannelUsersChanged(){
		let users = (await this.getVoiceChannelUsers()).map(u => u.steamid);
		users = users.filter(u => u != this.loggedUser.steamid); // Remove bot
		if(this.reconnectOnUserJoin){
			let status = await this.getVoiceChannelStatus();
			if(users.length > 0){
				if(status !== "OK"){
					this.rejoinVoiceChat();
					console.log("Rejoin voice.");
				}
			} else {
				// On empty
				this.leaveVoiceChannel();
				console.log("Leave voice on empty.");
			}
		}
		for(let user of this.joinedUsers){
			if(users.indexOf(user) >= 0)
				continue;
			else {
				console.log("user left:", user);
				let sound = await this.soundsDbGw.selectRandomUserSound(user, this.soundsDbGw.SoundType.LEAVE);
				if(sound != null)
					this.playSound(sound);
				else
					console.log("No sound.");
			}
		}
		for(let user of users){
			if(this.joinedUsers.indexOf(user) >= 0)
				continue;
			else {
				console.log("user joined:", user);
				let sound = await this.soundsDbGw.selectRandomUserSound(user, this.soundsDbGw.SoundType.WELCOME);
				if(sound != null)
					this.playSound(sound);
				else
					console.log("No sound.");
			}
		}
		this.joinedUsers = users;
	}
	
	async getActiveVoiceChannel(){
		return this.page.evaluate(pageInteractions.getActiveVoiceRoom, selectors);
	}
	
	async getVoiceChannelStatus(){
		if(!(await this.getActiveVoiceChannel()))
			return "Not in room";
		let message = await this.page.evaluate(pageInteractions.getVoiceStatus, selectors);
		if(message)
			return message;
		return "OK";
	}

	async rejoinVoiceChat(){
		await this.page.evaluate(pageInteractions.rejoinLastVoiceRoom);
		await this.page.waitForSelector(selectors.voiceChannelUsers);
	}

	async leaveVoiceChannel(){
		try {
			await this.page.click(selectors.leaveVoiceBtn);
		} catch(e){
			// Ignore failure
		}
	}
	
	async joinVoiceChannel(group, channel, reconnectOnUserJoin){
		this.groupName = group;
		this.openGroup(group);
		if(typeof(reconnectOnUserJoin) !== "undefined")
			this.reconnectOnUserJoin = reconnectOnUserJoin;

		let groupId = await this.getGroupIdByName(group);
		await this.page.evaluate(pageInteractions.joinVoiceRoom, groupId, channel);
		await this.page.waitForSelector(selectors.voiceChannelUsers);
		await this.page.evaluate(pageInteractions.startJoinedUsersObserver, selectors);

		this.joinedUsers = (await this.getVoiceChannelUsers()).map(u => u.steamid);
		if(reconnectOnUserJoin && this.joinedUsers.length === 0){
			console.log("Leaving empty room on initial join.");
			this.leaveVoiceChannel();
			return;
		}

		const greetingMessages = [
			"Hello, I am BeebBoop and I do beep and boop.",
			"I really like cheese.",
			"Knock, knock."
		];
		setTimeout(async () => {
			try {
				await this.textToSpeech(greetingMessages[Math.round(Math.random()*(greetingMessages.length - 1))]);
			} catch(e){
				console.error(e);
			}
		}, 3000);
	}

	async playSound(soundName){
		await this.playSoundUrl(this.soundsBaseUrl + soundName);
	}
	
	async playSoundUrl(url, checkYt = true){
		if(checkYt){
			console.log("playUrl", url);
			if(ytdl.validateURL(url)){
				console.log("youtube detected");
				let info = await ytdl.getInfo(url, {});
				let format = ytdl.chooseFormat(info.formats, {
					quality: "highestaudio",
					filter: f => f.container === "webm"
				});
				url = format.url;
				console.log(url);
			}
		}
		try {
			await this.page.evaluate(pageInteractions.audioPlayUrl, url);
		} catch(e){
			throw new Error(e.message.replace("Evaluation failed: ", ""));
		}
	}

	resumeSound(){
		return this.page.evaluate(pageInteractions.audioPlay);
	}

	stopSound(){
		return this.page.evaluate(pageInteractions.audioPause);
	}
}

module.exports = SteamChat;