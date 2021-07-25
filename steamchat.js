const https = require('https');
const EventEmitter = require('events');
const ytdl = require("ytdl-core");
const UserInfo = require("./userinfo");
const RoomInfo = require("./roominfo");
const ChatHandler = require("./chathandler");

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
	 * @param {Page} page - Puppeteer page
	 */
	constructor(page, soundsBaseUrl, youtubeBaseUrl, soundsDbGw, ttsUrl){
		super();
		this.page = page;
		this.soundsBaseUrl = soundsBaseUrl;
		this.youtubeBaseUrl = youtubeBaseUrl;
		this.soundsDbGw = soundsDbGw;
		this.groupName = null;
		this.joinedUsers = [];
		this.ttsUrl = ttsUrl;
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

	async init(volume){
		try {
			await this.page.waitForSelector(selectors.loading);
		} catch(e){
			console.log(e);
		}
		await this.initAudio(volume);

		await this.page.evaluate((userinfoclass, roominfoclass) => {
			window.UserInfo = eval("("+userinfoclass+")");
			window.RoomInfo = eval("("+roominfoclass+")");

			window.Notification.permission = "granted";
			window.Notification.requestPermission = function(e){e("granted")};

			// Voice settings
			g_FriendsUIApp.VoiceStore.SetUseEchoCancellation(false);
			g_FriendsUIApp.VoiceStore.SetUseAutoGainControl(true);
			g_FriendsUIApp.VoiceStore.SetUseNoiseCancellation(false);
			g_FriendsUIApp.VoiceStore.SetUseNoiseGateLevel(0);

			setInterval(() => {
				g_FriendsUIApp.IdleTracker.OnUserAction();
			}, 120000);
		}, UserInfo.toString(), RoomInfo.toString());

		if(!this.activityInterval){
			this.activityInterval = setInterval(async () => {
				let connectionTrouble = await this.page.evaluate((selectors) => {
					// Remove this check for now because bot disconnect from room on purpose.
					//if(document.querySelector(selectors.activeVoice).offsetParent == null)
					//	return "Disconnected from voice room.";
					let element = document.querySelector(selectors.loggedOut);
					if(element)
						return element.innerText;
					else
						return null;
				}, selectors);
				if(connectionTrouble)
					this.emit("connectionTrouble", new ConnectionTroubleEvent(connectionTrouble));
			},60000);
		}

		this.chatHandler = new ChatHandler(this);

		this.loggedUser = await this.page.evaluate(() => {
			return new UserInfo(g_FriendsUIApp.FriendStore.m_self);
		});
		this.myName = this.loggedUser.name;
	}
	
	initAudio(volume){
		return this.page.evaluate((volume, selectors) => {
			window.audioContext = new AudioContext();
			window.gainNode = window.audioContext.createGain();
			window.gainNode.gain.value = volume;

			function addStream(stream){
				let audioSource = window.audioContext.createMediaStreamSource(stream);
				audioSource.connect(window.gainNode);
			}
			window.addStream = addStream;

			navigator.getUserMedia = function(options, success){
				let mixed = window.audioContext.createMediaStreamDestination();
				window.gainNode.connect(mixed);
				success(mixed.stream);
			};
			
			window.audio = new Audio();
			window.audio.controls = true;
			window.audio.crossOrigin = "annonymous";
			window.audio.oncanplay = ()=>{
				window.addStream(window.audio.captureStream());
				window.audio.play();
			};
			document.querySelector(selectors.audioElementContainer).appendChild(window.audio);

			window.say = function(text){
				let utter = new SpeechSynthesisUtterance(text);
				utter.voice = window.speechSynthesis.getVoices();
				utter.rate = 1.3;
				utter.pitch = 0.3;
				window.speechSynthesis.speak(utter);
			}
		}, volume, selectors);
	}

	setCaptchaSolver(func){
		this.requestCaptchaSolution = func;
	}

	async login(username, password){
		try {
			if(await this.page.evaluate((user, pass, selectors) => {
				document.querySelector(selectors.loginUsername).value = user;
				document.querySelector(selectors.loginPassword).value = pass;
				let captcha_input = document.querySelector(selectors.loginCaptcha);
				if(captcha_input.offsetParent != null){
					// Captcha detected
					return false;
				}
				document.querySelector(selectors.loginButton).click();
				return true;
			}, username, password, selectors)){
				await this.page.evaluate((selectors) => {
					return new Promise((resolve, reject) => {
						let checkInt = setInterval(() => {
							if(document.querySelector(selectors.loginError).offsetParent != null){
								clearInterval(checkInt);
								reject(new Error("Login failed."));
							}
						}, 200);
						window.addEventListener("beforeunload", () => {
							clearInterval(checkInt);
							resolve();
						});
					});
				}, selectors);
				console.log("Login: Success.");
			} else {
				console.log("Login: Captcha detected, requesting solution.");
				// Deal with captcha
				if(this.requestCaptchaSolution){
					while(true) {
						await this.page.evaluate(async (selectors) => {
							let img = document.querySelector(selectors.loginCaptchaImg);
							if(!img.complete){
								await new Promise((resolve => {
									img.onload = () => resolve();
								}));
							}
						}, selectors);
						let captchaElement = await this.page.$(selectors.loginCaptchaImg);
						let solution = await this.requestCaptchaSolution(await captchaElement.screenshot({type: "png"}));
						console.log("Login: Captcha solution received.");
						await this.page.evaluate((solution, selectors) => {
							document.querySelector(selectors.loginCaptcha).value = solution;
							document.querySelector(selectors.loginButton).click();
						}, solution, selectors);
						try {
							await this.page.evaluate(selectors => {
								return new Promise((resolve, reject) => {
									let checkInt = setInterval(() => {
										if(document.querySelector(selectors.loginError).offsetParent != null){
											clearInterval(checkInt);
											reject(new Error("Login failed."));
										}
									}, 200);
									window.addEventListener("beforeunload", () => {
										clearInterval(checkInt);
										resolve();
									});
								});
							}, selectors);
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
		return this.page.evaluate((groupName) => {
			let groupId = null;
			let group = null;
			for(let g of g_FriendsUIApp.ChatStore.m_mapChatGroups){
				if(g[1].name == groupName){
					groupId = g[0];
					group = g[1];
					break;
				}
			}
			if(group == null)
				return null;

			let lastMention = 0;
			let roomId = null;
			let room = null;
			for(let r of group.m_mapRooms){
				if(r[1].m_rtLastMention > lastMention){
					lastMention = r[1].m_rtLastMention;
					roomId = r[0];
					room = r[1];
				}
			}
			return {
				groupId, roomId
			}
		}, groupName);
	}

	getGroups(){
		return this.page.evaluate((selectors) => {
			let groupNames = document.querySelectorAll(selectors.groupList + " " + selectors.groupListItem);
			return Array.prototype.map.call(groupNames, (e) => {return e.innerText;});
		}, selectors);
	}

	getVoiceChannels(group){
		return this.page.evaluate((group, selectors) => {
			for(let g of document.querySelectorAll(selectors.groupList)){
				if(g.querySelector(selectors.groupListItem).innerText == group){
					let voiceRooms = g.querySelector(selectors.groupListItemChatroomList).firstChild;
					if(voiceRooms.children.length == 0)
						g.querySelector(selectors.groupListItemOpenBtn).click();
					let channelNames = g.querySelectorAll(selectors.groupListItemVoiceChannel);
					return Array.prototype.map.call(channelNames, (e) => {return e.innerText;});
				}
			}
			return [];
		}, group, selectors);
	}

	async openGroup(group, chatroom = null){
		let groupId = await this.getGroupIdByName(group);
		await this.page.evaluate((groupId, chatroom, selectors) => {
			let group = g_FriendsUIApp.ChatStore.GetChatRoomGroup(groupId);
			let room = group.chatRoomList[0];
			if(chatroom){
				for(let r of group.chatRoomList){
					if(r.m_strName == chatroom){
						room = r;
						break;
					}
				}
			}
			g_FriendsUIApp.UIStore.ShowAndOrActivateChatRoomGroup(room, group, true);
		}, groupId, chatroom, selectors);
		try {
			await this.page.waitForSelector(selectors.groupChatTab);
		} catch(e){
			console.log(e);
		}
	}

	async getGroupIdByName(name){
		return await this.page.evaluate((name) => {
			for(var g of g_FriendsUIApp.ChatStore.m_mapChatGroups.values()){
				if(g.name == name){
					return g.GetGroupID();
				}
			}
			return null;
		}, name);
	}

	async getGroupMembers(groupId){
		// Group has to be opened for this to work!
		return await this.page.evaluate((groupId) => {
			let members = [];
			for(let bucket of g_FriendsUIApp.GroupMemberStore.GetGroupMemberList(groupId)){
				for(let f of bucket.m_rgMembers)
					members.push(new UserInfo(f));
			}
			return members;
		}, groupId.toString());
	}

	async getVoiceChannelUsers(){
		return await this.page.evaluate(() => {
			let users = [];
			//let voiceChat = g_FriendsUIApp.ChatStore.GetActiveVoiceChat(); // This won't work when bot leaves room
			let voiceChat = window.currentVoiceChat;
			for(let m of voiceChat.m_groupVoiceActiveMembers.GetRawMemberList)
				users.push(new UserInfo(m));
			return users;
		});
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
		return await this.page.evaluate((selectors) => {
			let el = document.querySelector(selectors.activeVoiceName);
			return el? el.innerText : null;
		}, selectors);
	}
	
	async getVoiceChannelStatus(){
		if(!(await this.getActiveVoiceChannel()))
			return "Not in room";
		let message = await this.page.evaluate((selectors) => {
			let el = document.querySelector(selectors.connectionStatus);
			return el? el.innerText : null;
		}, selectors);
		if(message)
			return message;
		return "OK";
	}

	async rejoinVoiceChat(){
		await this.page.evaluate(() => {
			window.currentVoiceChat.StartVoiceChat();
		});
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
		await this.page.evaluate((groupId, channelName) => {
			let group = g_FriendsUIApp.ChatStore.GetChatRoomGroup(groupId);
			for(let voiceChannel of group.voiceRoomList){
				if(voiceChannel.name == channelName){
					voiceChannel.StartVoiceChat();
					window.currentVoiceChat = voiceChannel;
					break;
				}
			}
		}, groupId, channel);
		await this.page.waitForSelector(selectors.voiceChannelUsers);
		await this.page.evaluate((selectors) => {
			// Join observer
			if(!window.voiceChannelUsersTimer){
				window.voiceChannelUsersTimer = setTimeout(() => {
					let usersList = document.querySelector(selectors.voiceChannelUsers);
					window.mutationObserver = new MutationObserver((mutRecords) => {
						window.joinedUsersChanged();
					});
					window.mutationObserver.observe(usersList, {childList: true, subtree: true});
				}, 1000);
			}
		}, selectors);

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
			await this.page.evaluate(async (url) => {
				await new Promise((resolve, reject) => {
					let errorHandler = async (e) => {
						window.audio.removeEventListener("error", errorHandler);
						window.audio.removeEventListener("canplay", canplayHandler);
						try {
							await window.audio.play();
						} catch(e){
							return reject(e.message);
						}
						reject("Error while loading audio from URL.");
					};
					let canplayHandler = () => {
						window.audio.removeEventListener("error", errorHandler);
						window.audio.removeEventListener("canplay", canplayHandler);
						resolve();
					};
					window.audio.addEventListener("error", errorHandler);
					window.audio.addEventListener("canplay", canplayHandler);
					window.audio.src = url;
				});
			}, url);
		} catch(e){
			throw new Error(e.message.replace("Evaluation failed: ", ""));
		}
	}

	resumeSound(){
		return this.page.evaluate(() => {
			window.audio.play();
			return true;
		});
	}

	stopSound(){
		return this.page.evaluate(() => {
			window.audio.pause();
			return true;
		});
	}
}

module.exports = SteamChat;