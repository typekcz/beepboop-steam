//@ts-check
import { getErrorMessage } from "../utils.js";
import { ytHelper } from "../yt-helper.js";

/**
 * @typedef SoundObj
 * @property {string} name
 * @property {string} url
 * @property {string} originalUrl
 * @property {Channel} [suggestedChannel]
*/

/**
 * @typedef FakeAudio
 * @property {AudioContext} audioContext
 * @property {GainNode} gainNode
 * @property {Record<Channel, HTMLAudioElement>} channels
 * @property {(stream: MediaStream) => void} addStream
 * @property {(_options: any, success: (s: MediaStream) => {}) => void} getUserMedia
 */

/** @typedef {"music"|"sounds"} Channel */

export default class SteamChatAudio {
	/**
	 * 
	 * @param {import("../beepboop.js").default} beepBoop
	 * @param {string} soundsBaseUrl
	 */
	constructor(beepBoop, soundsBaseUrl) {
		this.bb = beepBoop;
		this.soundsBaseUrl = soundsBaseUrl;
		/** @type {SoundObj|null} */
		this.nowPlaying = null
		/** @type {SoundObj[]} */
		this.queue = [];
		/** @type {boolean} */
		this.queueLoop = false;
	}

	get frame(){
		let f = this.bb.chatFrame;
		if(!f)
			throw new Error("FriendsUi frame is not available.");
		return f;
	}

	async init(volume = 0.3) {
		/** @type {any} Fake for TS check */
		let g_FriendsUIApp;
		
		await this.bb.chatPage?.exposeFunction("soundEnded", (/** @type {Channel} */ channel) => this.soundEnded(channel));
		await this.frame.evaluate((volume_) => {
			// Voice settings
			g_FriendsUIApp.VoiceStore.SetUseEchoCancellation(false);
			g_FriendsUIApp.VoiceStore.SetUseAutoGainControl(true);
			g_FriendsUIApp.VoiceStore.SetUseNoiseCancellation(false);
			g_FriendsUIApp.VoiceStore.SetUseNoiseGateLevel(0);

			// Fake microphone setup
			const audioContext = new AudioContext();
			/** @type {FakeAudio} */
			let fakeAudio = {
				audioContext,
				gainNode: audioContext.createGain(),
				channels: {
					music: new Audio(),
					sounds: new Audio(),
				},
				/**
				 * @param {MediaStream} stream 
				 */
				addStream(stream) {
					let audioSource = fakeAudio.audioContext.createMediaStreamSource(stream);
					audioSource.connect(fakeAudio.gainNode);
				},
				getUserMedia(_options, success){
					let mixed = fakeAudio.audioContext.createMediaStreamDestination();
					fakeAudio.gainNode.connect(mixed);
					success(mixed.stream);
				}
			};
			fakeAudio.gainNode.gain.value = volume_;

			for(let channel in fakeAudio.channels) {
				const audio = fakeAudio.channels[/** @type {Channel} */(channel)];
				audio.controls = true;
				audio.crossOrigin = "annonymous";

				// Auto play and add stream on src change
				audio.oncanplay = () => {
					// @ts-ignore captureSteam does not exist on HTMLAudioElement?? Yes, it does, shut up.
					fakeAudio.addStream(audio.captureStream());
					audio.play();
				};
				// @ts-ignore
				audio.onended = () => soundEnded(channel);
			}

			// Override getUserMedia API 
			//@ts-ignore
			navigator.getUserMedia = fakeAudio.getUserMedia;
			//@ts-ignore
			navigator.mediaDevices.getUserMedia = fakeAudio.getUserMedia;

			//@ts-ignore
			window.fakeAudio = fakeAudio;
		}, volume);
	}

	/**
	 * @param {string} sound 
	 * @param {boolean} checkYt 
	 * @returns {Promise<SoundObj>}
	 */
	async getSoundObj(sound, checkYt = true) {
		let yt = checkYt && ytHelper.validateUrl(sound);

		if(yt) {
			// YTDL endpoint
			const soundObj = {
				name: "YouTube",
				originalUrl: sound,
				url: `${this.soundsBaseUrl}/api/ytdl/${encodeURIComponent(sound)}`,
				suggestedChannel: "music"
			};
			ytHelper.getTitle(sound)
				.then(name => soundObj.name = name)
				.catch(() => {});
			return soundObj;
		} else if(/^https?:\/\//.test(sound)) {
			// Proxy
			return {
				name: "URL",
				originalUrl: sound,
				url: `${this.soundsBaseUrl}/api/proxy/${encodeURIComponent(sound)}`
			};
		} else {
			return {
				name: sound,
				originalUrl: "",
				url: `${this.soundsBaseUrl}/api/sounds/${sound}`
			};
		}
	}

	/**
	 * @param {string} sound URL or sound name
	 */
	async playSound(sound, { channel = undefined, checkYt = true} = {}){
		const soundObj = await this.getSoundObj(sound, checkYt);
		await this.playSoundObj(soundObj, channel ?? soundObj.suggestedChannel ?? "sounds");
	}
	
	/**
	 * @param {string} sound URL or sound name
	 * @param {boolean} checkYt 
	 */
	async playSoundUrl(sound, checkYt = true){
		await this.playSound(sound, { checkYt });
	}

	/**
	 * @param {SoundObj} sound 
	 * @param {Channel} channel 
	 */
	async playSoundObj(sound, channel) {
		if(channel === "music")
			this.nowPlaying = sound;
		const url = sound.url;

		try {
			await this.frame.evaluate(async (url, channel) => {
				/** @type {HTMLAudioElement} */
				//@ts-ignore
				const audio = fakeAudio.channels[channel];
				if(!audio) throw new Error(`Channel "${channel}" does not exist.`);
				await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
					let errorHandler = async () => {
						audio.removeEventListener("error", errorHandler);
						audio.removeEventListener("canplay", canplayHandler);
						try {
							await audio.play();
						} catch(e){
							const msg = getErrorMessage(e);
							return reject(new Error(`${msg} Code ${audio.error?.code}: ${audio.error?.message}`));
						}
						reject(new Error(`Error while loading audio from URL. Code ${audio.error?.code}: ${audio.error?.message}`));
					};
					let canplayHandler = () => {
						audio.removeEventListener("error", errorHandler);
						audio.removeEventListener("canplay", canplayHandler);
						resolve();
					};
					audio.addEventListener("error", errorHandler);
					audio.addEventListener("canplay", canplayHandler);
					audio.src = url;
				}));
			}, url, channel);
		} catch(e){
			const msg = getErrorMessage(e);
			throw new Error(msg.replace("Evaluation failed: ", ""));
		}
	}

	resumeSound(){
		// Resume only music channel
		//@ts-ignore fakeAudio
		return this.frame.evaluate(() => {
			/** @type {HTMLAudioElement} *///@ts-ignore
			const audio = fakeAudio.channels.music;
			if(audio.duration - audio.currentTime < 0.1) {
				//@ts-ignore
				soundEnded("music");
			} else {
				audio.play();
			}
		});
	}

	stopSound(){
		// Stop all channels
		return this.frame.evaluate(() => {
			/** @type {FakeAudio} *///@ts-ignore
			let fakeAudio = window.fakeAudio;
			for(let channel in fakeAudio.channels) {
				fakeAudio.channels[/** @type {Channel} */(channel)].pause();
			}
		});
	}

	/**
	 * @param {string} text 
	 */
	async textToSpeech(text){
		if(this.bb.config.ttsUrl){
			text = text.replace("/me", this.bb.steamChat.myName ?? "BeepBoop");
			await this.bb.steamChatAudio.playSoundUrl(this.bb.config.ttsUrl + encodeURIComponent(text));
		}
	}

	/**
	 * 
	 * @param {string} channel 
	 * @returns 
	 */
	soundEnded(channel) {
		if(channel !== "music") return;
		this.nowPlaying = null;
		const next = this.queue.shift();
		if(!next) return;
		if(this.queueLoop) this.queue.push(next);
		this.playSoundObj(next, channel);
	}

	/**
	 * 
	 * @param {SoundObj|string} sound 
	 * @param {number|null} [position=-1] 
	 */
	async queueAdd(sound, position = null) {
		if(typeof(sound) == "string") sound = await this.getSoundObj(sound);
		if(position == null) position = this.queue.length;
		this.queue.splice(position, 0, sound);
		if(!this.nowPlaying) this.soundEnded("music");
	}

	queueNext() {
		this.soundEnded("music");
	}

	/**
	 * 
	 * @param {number} position 
	 */
	queueRemove(position) {
		return this.queue.splice(position, 1)[0];
	}

	queueClear() {
		this.queue.splice(0);
	}
}
