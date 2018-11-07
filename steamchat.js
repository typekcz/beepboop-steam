const {VM} = require('vm2');
const https = require('https');

class SteamChat {
	/**
	 * @param {Page} page - Puppeteer page
	 */
	constructor(page, soundsBaseUrl){
		this.page = page;
		this.soundsBaseUrl = soundsBaseUrl;
		this.groupName = null;
		this.joinedUsers = [];

		this.activityInterval = setInterval(() => {
			this.page.mouse.move(Math.random()*100, Math.random()*100+300);
		},60000);
	}

	getPage(){
		return this.page;
	}

	async init(){
		try {
			await this.page.waitForSelector(".main_throbberContainer-exit-active_24VO6");
		} catch(e){
			console.log(e);
		}
		await this.initAudio();

		this.myName = await this.page.evaluate(() => {
			document.hasFocus = function(){return false;};
			return document.querySelector(".currentUserContainer .playerName").innerText;
		});

		await this.page.exposeFunction("handleMessage", (group, message) => {
			return this.handleMessage(group, message);
		});

		await this.page.exposeFunction("findChatRoom", (message) => {
			return this.findChatRoom(message);
		});

		await this.page.evaluate(() => {
			window.Notification = function(text, options){
				this.text = text;
				this.options = options;

				this.addEventListener = async function(type, handler){
					if(type == "click"){
						handler();
						handleMessage(this.text, this.options.body);
					}
				};
				this.close = function(){};
			};
			window.Notification.permission = "granted";
			window.Notification.requestPermission = function(e){e("granted")};
		});
	}
	
	initAudio(){
		return this.page.evaluate(() => {
			window.audioContext = new AudioContext();
			window.mixedAudio = window.audioContext.createMediaStreamDestination();
			window.gainNode = window.audioContext.createGain();
			window.gainNode.gain.value = 0.3;
			window.gainNode.connect(window.mixedAudio);

			function addStream(stream){
				let audioSource = window.audioContext.createMediaStreamSource(stream);
				audioSource.connect(window.gainNode);
			}
			window.addStream = addStream;

			navigator.getUserMedia = function(options, success){
				success(window.mixedAudio.stream);
			};
			
			window.audio = new Audio();
			window.audio.controls = true;
			window.audio.muted = true;
			window.audio.crossOrigin = "annonymous";
			window.audio.oncanplay = ()=>{
				window.addStream(window.audio.captureStream());
				window.audio.play();
			};
		});
	}

	async handleMessage(groupName, message){
		console.log("handlemessage", groupName, message);
		const unknownMessages = [
			"the fuck you want?",
			"I'm not fluent in meatbag language",
			"fuck you too"
		];
		const errorMessages = [
			"nope",
			"418 I'm a teapot",
			"E̴͚̠̰̺͎̘ͫR̮͈͓̆͜R͕̩̩̭̙͘Ȯ͖̜̱̞̜ͮR̉",
			"/me is currently unavailable"
		];
		// g_FriendsUIApp.ChatStore.m_mapChatGroups.get("21961").m_mapRooms.get("84836").SendChatMessage("beep?","beep?","beep?","beep?")
		message = /.*: "(.*)"/.exec(message)[1];
		let response = null;
		if(message.startsWith("@" + this.myName + " ")){
			message = message.substring(this.myName.length + 2);
			let index = message.indexOf(" ");
			if(index < 0)
				index = message.length;
			let command = message.substr(0, index);
			let arg = message.substr(index + 1);
			console.log(">" + message + "<", ">" + command + "<", ">" + arg + "<");
			try {
				switch(command.toLowerCase()){
					case "play":
						await this.playSound(arg);
						break;
					case "playurl":
						await this.playSoundUrl(arg);
						break;
					case "instant":
						await this.playInstant(arg);
						break;
					case "stop":
						await this.stopSound();
						break;
					case "beep":
					case "beep?":
						response = "boop";
						break;
					case "eval":
						const vm = new VM({
							wrapper: "none"
						});
						let result = vm.run(arg);
						response = "/code " + JSON.stringify(result);
						break;
					default:
						response = unknownMessages[Math.round(Math.random()*unknownMessages.length - 1)];
						break;
				}
			} catch(e){
				console.log("command error", e.message);
				response = errorMessages[Math.round(Math.random()*errorMessages.length - 1)] + "\n" + e.message;
			}
		}
		console.log("response", response);
		if(response !== null){
			console.log(response);
			await this.page.type("textarea", response);
			await this.page.click("textarea + button");
		}
	}

	async sendMessage(groupName, message){
		let chat = await this.findChatRoom(groupName);
		console.log(chat);
		await this.page.evaluate((chat, message) => {
			g_FriendsUIApp.ChatStore.FindChatRoom(chat.groupId, chat.roomId).SendChatMessage(message);
		}, chat, message);
	}

	findChatRoom(groupName){
		console.log("findChatRoom", groupName);
		return this.page.evaluate((groupName) => {
			let groupId = null;
			let group = null;
			for(g of g_FriendsUIApp.ChatStore.m_mapChatGroups){
				console.log(g[1].name);
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
		return this.page.evaluate(() => {
			let groupNames = document.querySelectorAll(".ChatRoomList .ChatRoomListGroupItem .chatRoomName");
			return Array.prototype.map.call(groupNames, (e) => {return e.innerText;});
		});
	}

	getVoiceChannels(group){
		return this.page.evaluate((group) => {
			for(let g of document.querySelectorAll(".ChatRoomList .ChatRoomListGroupItem")){
				if(g.querySelector(".chatRoomName").innerText == group){
					let voiceRooms = g.querySelector(".ChatRoomListGroupItemChatRooms").firstChild;
					if(voiceRooms.children.length == 0)
						g.querySelector(".openGroupButton").click();
					let channelNames = g.querySelectorAll(".chatRoomVoiceChannel .chatRoomVoiceChannelName");
					return Array.prototype.map.call(channelNames, (e) => {return e.innerText;});
				}
			}
			return [];
		}, group);
	}

	async openGroup(group){
		await this.page.evaluate((groupName) => {
			for(let g of document.querySelectorAll(".ChatRoomList .ChatRoomListGroupItem")){
				let chatGroup = g.querySelector(".chatRoomName");
				if(chatGroup.innerText == groupName){
					chatGroup.click();
					document.activeElement.blur();
				}
			}
		}, group);
		await this.page.waitForSelector("div.chatDialogs div.chatWindow.MultiUserChat.namedGroup");
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
			for(let f of g_FriendsUIApp.GroupMemberStore.GetGroupMemberList(groupId)[0].m_rgMembers)
				members.push({
					name: f.display_name,
					steamid64: f.steamid64
				});
			return members;
		}, groupId.toString());
	}
	
	async joinVoiceChannel(group, channel){
		this.groupName = group;
		this.openGroup(group);
		await this.page.exposeFunction("joinedUsersChanged", (users) => {
			for(let user of this.joinedUsers){
				if(users.indexOf(user) >= 0)
					continue;
				else {
					console.log("user left:", user);
					//this.playSound(user);
				}
			}
			for(let user of users){
				if(this.joinedUsers.indexOf(user) >= 0)
					continue;
				else {
					console.log("user joined:", user);
					this.playSound(user);
				}
			}
			this.joinedUsers = users;
		});
		await this.page.evaluate((groupName, channelName) => {
			for(let g of document.querySelectorAll(".ChatRoomList .ChatRoomListGroupItem")){
				if(g.querySelector(".chatRoomName").innerText == groupName){
					let voiceRooms = g.querySelector(".ChatRoomListGroupItemChatRooms").firstChild;
					if(voiceRooms.children.length == 0)
						g.querySelector(".openGroupButton").click();
					for(let ch of g.querySelectorAll(".chatRoomVoiceChannel")){
						if(ch.querySelector(".chatRoomVoiceChannelName").innerText == channelName){
							ch.click();
							break;
						}
					}

					// Join observer
					setTimeout(() => {
						let usersList = g.querySelector(".VoiceChannelParticipants").firstElementChild;
						window.mutationObserver = new MutationObserver((mutRecords) => {
							window.joinedUsersChanged(
								Array.from(usersList.querySelectorAll(".playerName")).map(e => e.innerText)
							);
						});
						window.mutationObserver.observe(usersList, {childList: true});
					}, 1000);
					break;
				}
			}
		}, group, channel);
	}

	playSound(soundName){
		this.playSoundUrl(this.soundsBaseUrl + soundName);
	}
	
	playSoundUrl(url){
		console.log("playUrl", url);
		return this.page.evaluate((url) => {
			window.audio.src = url;
			return true;
		}, url);
	}

	stopSound(){
		return this.page.evaluate(() => {
			window.audio.pause();
			return true;
		});
	}

	playInstant(search){
		return new Promise((resolve, reject) => {
			let url = "https://www.myinstants.com/search/?name=" + encodeURIComponent(search);
			console.log("instant search url", url);
			https.get(url, (resp) => {
				let data = "";

				resp.on('data', (chunk) => {
					data += chunk;
				});

				resp.on('end', () => {
					let search_regex = /<div class="small-button" onmousedown="play\('([\w\.\/\-_%]*)'\)/;
					let regex_result = search_regex.exec(data);
					if(regex_result == null)
						return reject(new Error("No instant found."));
					this.playSoundUrl("https://www.myinstants.com" + regex_result[1]);
					resolve();
				});
			}).on("error", (err) => {
				console.log("Error: " + err.message);
				reject(err);
			});
		});
	}
}

module.exports = SteamChat;