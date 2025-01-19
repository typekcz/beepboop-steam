//@ts-check
import ChatHandler from "../chat-handler.js";
import RoomInfo from "../dto/room-info.js";
import UserInfo from "../dto/user-info.js";
import SteamFriendsUiApi from "./steam-friends-ui-api.js";
import Events from "node:events";
import { randomElement, sleep, unpromisify } from "../utils.js";

export default class SteamChatApi extends Events.EventEmitter {
	/**
	 * 
	 * @param {import("../beepboop.js").default} beepboop
	 */
	constructor(beepboop) {
		super();
		this.bb = beepboop;
		this.chatHandler = new ChatHandler(this.bb);
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

		try {
			await this.bb.chatPage?.exposeFunction("handleUsersChanged", (usersBefore, usersAfter) => {
				this.voiceChannelUsersChanged(usersBefore, usersAfter);
			});
		} catch(e){
			// Ignore error when binding already exists
			if(!(e instanceof Error) || e.message.endsWith("already exists"))
				throw e;
		}

		this.chatHandler.init();

		/** @type {UserInfo} */
		this.loggedUser = await this.frame.evaluate(SteamFriendsUiApi.getLoggedUserInfo);
		this.myName = this.loggedUser?.name;

		let g_FriendsUIApp; // Fake for TS check
		await this.frame.evaluate(() => {
			g_FriendsUIApp.SettingsStore.FriendsSettings.bAnimatedAvatars = false;
			g_FriendsUIApp.SettingsStore.FriendsSettings.bDisableEmbedInlining = true;
			g_FriendsUIApp.SettingsStore.FriendsSettings.bDisableRoomEffects = true;
			g_FriendsUIApp.SettingsStore.FriendsSettings.bDisableSpellcheck = true;
			setInterval(() => g_FriendsUIApp.IdleTracker.OnUserAction(), 120000);
		});
	}

	getLoggedUserInfo(){
		return this.loggedUser;
	}

	/**
	 * 
	 * @param {number} accId 
	 * @returns {Promise<UserInfo?>}
	 */
	getUserByAccId(accId){
		// @ts-ignore
		return this.frame.evaluate(SteamFriendsUiApi.getUserByAccId, accId);
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

	/**
	 * Internal
	 * @param {number[]} usersBefore array of account ids
	 * @param {number[]} usersAfter array of account ids
	 */
	async voiceChannelUsersChanged(usersBefore, usersAfter){
		usersBefore = usersBefore.filter(u => u != this.loggedUser?.accountid); // Remove bot
		usersAfter = usersAfter.filter(u => u != this.loggedUser?.accountid); // Remove bot
		if(this.reconnectOnUserJoin){
			let status = await this.getVoiceChannelStatus();
			if(usersAfter.length > 0){
				if(status !== "OK"){
					await this.rejoinVoiceChat();
					console.log("Rejoining voice channel.");
					await sleep(1000); // Wait a sec for voice to join
				}
			} else {
				// On empty
				this.leaveVoiceChannel();
				console.log("Leaving voice channel because it's empty.");
				return;
			}
		}
		// Leaving users
		for(let user of usersBefore.filter(u => !usersAfter.includes(u))){
			let userInfo = await this.getUserByAccId(user);
			if(userInfo){
				console.log("User left:", userInfo.name);
				let sound = await this.bb.soundsDbGw?.selectRandomUserSound(userInfo.steamid, this.bb.soundsDbGw.SoundType.LEAVE);
				if(sound != null)
					this.bb.steamChatAudio.playSound(sound);
			}
		}
		// Joining users
		for(let user of usersAfter.filter(u => !usersBefore.includes(u))){
			let userInfo = await this.getUserByAccId(user);
			if(userInfo){
				console.log("User joined:", userInfo.name);
				let sound = await this.bb.soundsDbGw?.selectRandomUserSound(userInfo.steamid, this.bb.soundsDbGw.SoundType.WELCOME);
				if(sound != null)
					this.bb.steamChatAudio.playSound(sound);
			}
		}
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

		const greetingMessage = randomElement(this.bb.config.messages.greeting);
		setTimeout(unpromisify(async () => {
			try {
				await this.bb.steamChatAudio.textToSpeech(greetingMessage);
			} catch(e){
				console.error(e);
			}
		}), 5000);
	}
}