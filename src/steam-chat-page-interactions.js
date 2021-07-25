module.exports = {
	define: (name, source) => {
		window[name] = eval("("+source+")");
	},

	getLoggedOutMessage: (selectors) => {
		// Remove this check for now because bot disconnect from room on purpose.
		//if(document.querySelector(selectors.activeVoice).offsetParent == null)
		//	return "Disconnected from voice room.";
		let element = document.querySelector(selectors.loggedOut);
		if(element)
			return element.innerText;
		else
			return null;
	},

	getLoggedUserInfo: () => {
		return new UserInfo(g_FriendsUIApp.FriendStore.m_self);
	},

	login: (user, pass, selectors) => {
		document.querySelector(selectors.loginUsername).value = user;
		document.querySelector(selectors.loginPassword).value = pass;
		let captcha_input = document.querySelector(selectors.loginCaptcha);
		if(captcha_input.offsetParent != null){
			// Captcha detected
			return false;
		}
		document.querySelector(selectors.loginButton).click();
		return true;
	},

	verifyLogin: (selectors) => {
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
	},

	waitForCaptchaImage: async (selectors) => {
		let img = document.querySelector(selectors.loginCaptchaImg);
		if(!img.complete){
			await new Promise((resolve => {
				img.onload = () => resolve();
			}));
		}
	},

	fillCaptcha: (solution, selectors) => {
		document.querySelector(selectors.loginCaptcha).value = solution;
		document.querySelector(selectors.loginButton).click();
	},

	initAudio: (volume, selectors) => {
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
	},

	init: (userinfoclass, roominfoclass) => {
		window.Notification.permission = "granted";
		window.Notification.requestPermission = function(e){e("granted")};

		// Voice settings
		g_FriendsUIApp.VoiceStore.SetUseEchoCancellation(false);
		g_FriendsUIApp.VoiceStore.SetUseAutoGainControl(true);
		g_FriendsUIApp.VoiceStore.SetUseNoiseCancellation(false);
		g_FriendsUIApp.VoiceStore.SetUseNoiseGateLevel(0);

		// Fake action every 2 minutes so bot won't be "away".
		setInterval(() => {
			g_FriendsUIApp.IdleTracker.OnUserAction();
		}, 120000);
	},

	findChatRoom: (groupName) => {
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
		for(let r of group.m_mapRooms){
			if(r[1].m_rtLastMention > lastMention){
				lastMention = r[1].m_rtLastMention;
				roomId = r[0];
			}
		}
		return {
			groupId, roomId
		}
	},

	getAllGroups: (selectors) => {
		let groupNames = document.querySelectorAll(selectors.groupList + " " + selectors.groupListItem);
		return Array.prototype.map.call(groupNames, (e) => {return e.innerText;});
	},

	getAllVoiceRooms: (group, selectors) => {
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
	},

	openGroupChatRoom: (groupId, chatroom, selectors) => {
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
	},

	getGroupId: (name) => {
		for(var g of g_FriendsUIApp.ChatStore.m_mapChatGroups.values()){
			if(g.name == name){
				return g.GetGroupID();
			}
		}
		return null;
	},

	getGroupMembers: (groupId) => {
		let members = [];
		for(let bucket of g_FriendsUIApp.GroupMemberStore.GetGroupMemberList(groupId)){
			for(let f of bucket.m_rgMembers)
				members.push(new UserInfo(f));
		}
		return members;
	},

	getVoiceRoomUsers: () => {
		let users = [];
		// This won't work when bot leaves room: let voiceChat = g_FriendsUIApp.ChatStore.GetActiveVoiceChat();
		let voiceChat = window.currentVoiceChat;
		for(let m of voiceChat.m_groupVoiceActiveMembers.GetRawMemberList)
			users.push(new UserInfo(m));
		return users;
	},

	getActiveVoiceRoom: (selectors) => {
		let el = document.querySelector(selectors.activeVoiceName);
		return el? el.innerText : null;
	},

	getVoiceStatus: (selectors) => {
		let el = document.querySelector(selectors.connectionStatus);
		return el? el.innerText : null;
	},

	joinVoiceRoom: (groupId, channelName) => {
		let group = g_FriendsUIApp.ChatStore.GetChatRoomGroup(groupId);
		for(let voiceChannel of group.voiceRoomList){
			if(voiceChannel.name == channelName){
				voiceChannel.StartVoiceChat();
				window.currentVoiceChat = voiceChannel;
				break;
			}
		}
	},

	rejoinLastVoiceRoom: () => {
		window.currentVoiceChat.StartVoiceChat();
	},

	startJoinedUsersObserver: (selectors) => {
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
	},

	audioPlayUrl: async (url) => {
		await new Promise((resolve, reject) => {
			let errorHandler = async () => {
				window.audio.removeEventListener("error", errorHandler);
				window.audio.removeEventListener("canplay", canplayHandler);
				try {
					await window.audio.play();
				} catch(exception){
					return reject(exception.message);
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
	},

	audioPlay: () => {
		window.audio.play();
		return true;
	},

	audioPause: () => {
		window.audio.pause();
		return true;
	}
};