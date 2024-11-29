//@ts-check
import ytdl from "@distube/ytdl-core";

export default class SteamChatAudio {
	/**
	 * 
	 * @param {import("../beepboop.js").default} beepBoop
	 * @param {string} soundsBaseUrl
	 */
	constructor(beepBoop, soundsBaseUrl) {
		this.bb = beepBoop;
		this.soundsBaseUrl = soundsBaseUrl;
	}

	get frame(){
		let f = this.bb.chatFrame;
		if(!f)
			throw new Error("FriendsUi frame is not available.");
		return f;
	}

	async init(volume = 0.3) {
		let g_FriendsUIApp; // Fake for TS check
		
		await this.frame.evaluate((volume_) => {
			// Voice settings
			g_FriendsUIApp.VoiceStore.SetUseEchoCancellation(false);
			g_FriendsUIApp.VoiceStore.SetUseAutoGainControl(true);
			g_FriendsUIApp.VoiceStore.SetUseNoiseCancellation(false);
			g_FriendsUIApp.VoiceStore.SetUseNoiseGateLevel(0);

			// Fake microphone setup
			let fakeAudio = {
				audioContext: new AudioContext(),
				audio: new Audio()
			};
			fakeAudio.gainNode = fakeAudio.audioContext.createGain();
			fakeAudio.gainNode.gain.value = volume_;

			fakeAudio.addStream = function(stream){
				let audioSource = fakeAudio.audioContext.createMediaStreamSource(stream);
				audioSource.connect(fakeAudio.gainNode);
			}

			fakeAudio.getUserMedia = function(_options, success){
				let mixed = fakeAudio.audioContext.createMediaStreamDestination();
				fakeAudio.gainNode.connect(mixed);
				success(mixed.stream);
			}

			// Audio source
			fakeAudio.audio = new Audio();
			fakeAudio.audio.controls = true;
			fakeAudio.audio.crossOrigin = "annonymous";
			fakeAudio.audio.oncanplay = ()=>{
				// @ts-ignore captureSteam does not exist on HTMLAudioElement?? Yes, it does, shut up.
				fakeAudio.addStream(fakeAudio.audio.captureStream());
				fakeAudio.audio.play();
			};

			// Override getUserMedia API 
			//@ts-ignore
			navigator.getUserMedia = fakeAudio.getUserMedia;
			//@ts-ignore
			navigator.mediaDevices.getUserMedia = fakeAudio.getUserMedia;

			//@ts-ignore
			window.fakeAudio = fakeAudio;
		}, volume);
	}

	async playSound(soundName){
		await this.playSoundUrl(`${this.soundsBaseUrl}/api/sounds/${soundName}`);
	}
	
	/**
	 * 
	 * @param {string} url 
	 * @param {boolean} checkYt 
	 */
	async playSoundUrl(url, checkYt = true){
		console.log("playUrl", url);
		if(checkYt){
			if(ytdl.validateURL(url)){
				console.log("youtube detected");
				let info = await ytdl.getInfo(url, {});
				let format = ytdl.chooseFormat(info.formats, {
					quality: "highestaudio"
				});
				url = format.url;
			}
		}
		// Proxy
		if(!url.startsWith(this.soundsBaseUrl))
			url = `${this.soundsBaseUrl}/api/proxy/${encodeURIComponent(url)}`;
		let fakeAudio; // Fake for TS check
		try {
			await this.frame.evaluate(async (url) => {
				await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
					let errorHandler = async () => {
						fakeAudio.audio.removeEventListener("error", errorHandler);
						fakeAudio.audio.removeEventListener("canplay", canplayHandler);
						try {
							await fakeAudio.audio.play();
						} catch(exception){
							return reject(new Error(exception.message));
						}
						reject(new Error(`Error while loading audio from URL. ${fakeAudio.error.code} ${fakeAudio.error.message}`));
					};
					let canplayHandler = () => {
						fakeAudio.audio.removeEventListener("error", errorHandler);
						fakeAudio.audio.removeEventListener("canplay", canplayHandler);
						resolve();
					};
					fakeAudio.audio.addEventListener("error", errorHandler);
					fakeAudio.audio.addEventListener("canplay", canplayHandler);
					fakeAudio.audio.src = url;
				}));
			}, url);
		} catch(e){
			if(e.message)
				throw new Error(e.message.replace("Evaluation failed: ", ""));
			throw e;
		}
	}

	resumeSound(){
		//@ts-ignore fakeAudio
		return this.frame.evaluate(() => fakeAudio.audio.play());
	}

	stopSound(){
		//@ts-ignore fakeAudio
		return this.frame.evaluate(() => fakeAudio.audio.pause());
	}

	async textToSpeech(text){
		if(this.bb.config.ttsUrl){
			text = text.replace("/me", this.bb.steamChat.myName);
			await this.bb.steamChatAudio.playSoundUrl(this.bb.config.ttsUrl + encodeURIComponent(text));
		}
	}
}
