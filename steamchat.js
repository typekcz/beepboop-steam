class SteamChat {
	/**
	 * @param {Page} page - Puppeteer page
	 */
	constructor(page){
		this.page = page;

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
	
	joinVoiceChannel(group, channel){
		return this.page.evaluate((groupName, channelName) => {
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
					break;
				}
			}
		}, group, channel);
	}
	
	playSoundUrl(url){
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