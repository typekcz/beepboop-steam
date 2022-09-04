//@ts-check
import ChatHandler from "../chat-handler.js";
import RoomInfo from "../dto/room-info.js";
import UserInfo from "../dto/user-info.js";
import SteamFriendsUiApi from "./steam-friends-ui-api.js";
import EventEmitter from "events";

export default class SteamChatApi extends EventEmitter {
	/**
	 * 
	 * @param {import("../beepboop").default} beepboop
	 */
	constructor(beepboop) {
		super();
		this.bb = beepboop;
		this.joinedUsers = [];
	}

	get frame(){
		let f = this.bb.chatFrame;
		if(!f)
			throw new Error("FriendsUi frame is not available.");
		return f;
	}

	async init(){
		await this.frame.evaluate(SteamFriendsUiApi.define, "UserInfo", UserInfo.toString());
		await this.frame.evaluate(SteamFriendsUiApi.define, "RoomInfo", RoomInfo.toString());

		this.chatHandler = new ChatHandler(this.bb);

		this.loggedUser = await this.frame.evaluate(SteamFriendsUiApi.getLoggedUserInfo);
		this.myName = this.loggedUser.name;

		let g_FriendsUIApp; // Fake for TS check
		this.frame.evaluate(() => setInterval(() => g_FriendsUIApp.IdleTracker.OnUserAction(), 120000));
	}

	getLoggedUserInfo(){
		return this.loggedUser;
	}

	async sendMessage(group, chatRoom, message){
		await this?.chatHandler?.sendGroupMessage(group, chatRoom, message);
	}

	async sendDirectMessage(userId, text){
		await this?.chatHandler?.sendDirectMessage(userId, text);
	}

	findChatRoom(groupName){
		return this.frame.evaluate(SteamFriendsUiApi.findChatRoom, groupName);
	}

	getGroups(){
		return this.frame.evaluate(SteamFriendsUiApi.getGroups);
	}

	getVoiceChannels(groupId){
		return this.frame.evaluate(SteamFriendsUiApi.getVoiceRooms, groupId);
	}

	async getGroupIdByName(name){
		return this.frame.evaluate(SteamFriendsUiApi.getGroupId, name);
	}

	async getGroupMembers(groupId){
		// Group has to be opened for this to work!
		return this.frame.evaluate(SteamFriendsUiApi.getGroupMembers, groupId.toString());
	}

	async getVoiceChannelUsers(){
		return this.frame.evaluate(SteamFriendsUiApi.getVoiceRoomUsers);
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
				let sound = await this.bb.soundsDbGw?.selectRandomUserSound(user, this.bb.soundsDbGw.SoundType.LEAVE);
				if(sound != null)
					this.bb.steamChatAudio.playSound(sound);
				else
					console.log("No sound.");
			}
		}
		for(let user of users){
			if(this.joinedUsers.indexOf(user) >= 0)
				continue;
			else {
				console.log("user joined:", user);
				let sound = await this.bb.soundsDbGw?.selectRandomUserSound(user, this.bb.soundsDbGw.SoundType.WELCOME);
				if(sound != null)
					this.bb.steamChatAudio.playSound(sound);
				else
					console.log("No sound.");
			}
		}
		this.joinedUsers = users;
	}
	
	async getActiveVoiceChannel(){
		return this.frame.evaluate(SteamFriendsUiApi.getActiveVoiceRoom);
	}
	
	async getVoiceChannelStatus(){
		if(!(await this.frame.evaluate(SteamFriendsUiApi.getActiveVoiceRoom)))
			return "Not in room";
		return "OK";
	}

	async rejoinVoiceChat(){
		await this.frame.evaluate(SteamFriendsUiApi.rejoinLastVoiceRoom);
	}

	async leaveVoiceChannel(){
		try {
			await this.frame.evaluate(SteamFriendsUiApi.leaveVoiceRoom);
		} catch(e){
			// Ignore failure
		}
	}
	
	async joinVoiceChannel(group, channel, reconnectOnUserJoin){
		this.groupName = group;
		if(typeof(reconnectOnUserJoin) !== "undefined")
			this.reconnectOnUserJoin = reconnectOnUserJoin;

		let groupId = await this.getGroupIdByName(group);
		await this.frame.evaluate(SteamFriendsUiApi.joinVoiceRoom, groupId, channel);
		//await this.frame.waitForSelector(selectors.voiceChannelUsers);
		//await this.frame.evaluate(SteamFriendsUiApi.startJoinedUsersObserver, selectors);

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
				await this.bb.steamChatAudio.textToSpeech(greetingMessages[Math.round(Math.random()*(greetingMessages.length - 1))]);
			} catch(e){
				console.error(e);
			}
		}, 3000);
	}
}