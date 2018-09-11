class SteamChat {
	/**
	 * @param {Page} page - Puppeteer page
	 */
	constructor(page){
		this.page = page;
	}
	
	initAudio(){
		return this.page.evaluate(() => {
			window.audioContext = new AudioContext();
			window.mixedAudio = window.audioContext.createMediaStreamDestination();

			function addStream(stream){
				let audioSource = window.audioContext.createMediaStreamSource(stream);
				audioSource.connect(window.mixedAudio);
			}
			window.addStream = addStream

			navigator.getUserMedia = function(options, success, failure){
				success(window.mixedAudio.stream);
			}
			
			window.audio = new Audio();
			window.audio.controls = true;
			window.audio.muted = true;
			window.audio.loop = true;
			window.audio.crossOrigin = "annonymous";
			window.audio.oncanplay = ()=>{
				window.addStream(audio.captureStream());
				window.audio.play();
			}
		});
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
	
	playUrl(url){
		return this.page.evaluate((url) => {
			window.audio.src = url;
		}, url);
	}
}

module.exports = SteamChat;