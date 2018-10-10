class SteamChat {
	/**
	 * @param {Page} page - Puppeteer page
	 */
	constructor(page, soundsBaseUrl){
		this.page = page;
		this.soundsBaseUrl = soundsBaseUrl;
		this.groupName = null;

		this.activityInterval = setInterval(() => {
			this.page.mouse.move(Math.random()*100, Math.random()*100);
		},60000);
	}

	getPage(){
		return this.page;
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
				}
			}
		}, group);
		await this.page.waitForSelector("div.chatDialogs div.chatWindow.MultiUserChar.namedGroup");
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
		await this.page.exposeFunction("userJoined", (user) => {
			console.log("user joined:", user);
			this.playSound(user);
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

					setTimeout(() => {
						let usersList = g.querySelector(".VoiceChannelParticipants").firstElementChild;
						window.mutationObserver = new MutationObserver((mutRecords) => {
							for(let mutRecord of mutRecords){
								for(let addedNode of mutRecord.addedNodes){
									window.userJoined(addedNode.querySelector(".playerName").innerText);
								}
							}
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
			window.audio.stop();
			return true;
		});
	}
}

module.exports = SteamChat;