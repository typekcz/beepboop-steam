export default class FakeWebAudio {
	/**
	 * 
	 * @param {import("puppeteer-core").FrameBase} frame 
	 */
	constructor(frame) {
		this.frame = frame;
	}

	initAudio(volume = 0.3) {
		this.frame.evaluate((volume_) => {
			// Fake microphone setup
			window.fakeAudio = {
				audioContext: new AudioContext(),
				audio: new Audio()
			};
			window.fakeAudio.gainNode = window.fakeAudio.audioContext.createGain();
			window.fakeAudio.gainNode.gain.value = volume_;

			window.fakeAudio.addStream = function(stream){
				let audioSource = window.fakeAudio.audioContext.createMediaStreamSource(stream);
				audioSource.connect(window.fakeAudio.gainNode);
			}

			window.fakeAudio.getUserMedia = function(_options, success){
				let mixed = window.fakeAudio.audioContext.createMediaStreamDestination();
				window.fakeAudio.gainNode.connect(mixed);
				success(mixed.stream);
			}

			// Audio source
			window.fakeAudio.audio = new Audio();
			window.fakeAudio.audio.controls = true;
			window.fakeAudio.audio.crossOrigin = "annonymous";
			window.fakeAudio.audio.oncanplay = ()=>{
				window.fakeAudio.addStream(window.fakeAudio.audio.captureStream());
				window.fakeAudio.audio.play();
			};

			// Override getUserMedia API
			navigator.getUserMedia = getUserMedia;
			navigator.mediaDevices.getUserMedia = getUserMedia;
		}, volume);
	}
}