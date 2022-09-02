let volume = 0.3;

// Fake microphone setup
window.audioContext = new AudioContext();
window.gainNode = window.audioContext.createGain();
window.gainNode.gain.value = volume;

function addStream(stream){
	let audioSource = window.audioContext.createMediaStreamSource(stream);
	audioSource.connect(window.gainNode);
}
window.addStream = addStream;

function getUserMedia(options, success){
	console.log("BeepBoop getUserMedia");
	let mixed = window.audioContext.createMediaStreamDestination();
	window.gainNode.connect(mixed);
	success(mixed.stream);
}

function enumerateDevices(){
	console.log("BeepBoop enumerateDevices");
}

navigator.getUserMedia = getUserMedia;
navigator.mediaDevices.getUserMedia = getUserMedia;
navigator.mediaDevices.enumerateDevices = enumerateDevices;

// Audio source
window.audio = new Audio();
window.audio.controls = true;
window.audio.crossOrigin = "annonymous";
window.audio.oncanplay = ()=>{
	window.addStream(window.audio.captureStream());
	window.audio.play();
};
window.audio.style = "position: absolute; top: 0; z-index: 1;";
document.body.appendChild(window.audio);