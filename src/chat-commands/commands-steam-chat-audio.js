//@ts-check

/**
 * 
 * @param {import("../beepboop.js").default} bb
 * @returns {import("../chat-handler.js").ChatCommand[]}
 */
export default function createSteamChatAudioCommands(bb){
	return [
		{
			command: "play", 
			handler: async e => {
				if(e.argument)
					if(/^https?:\/\//.test(e.argument))
						await bb.steamChatAudio.playSoundUrl(e.argument);
					else
						await bb.steamChatAudio.playSound(e.argument);
				else
					await bb.steamChatAudio.resumeSound();
			},
			argsHelp: "[sound]",
			help: "Plays sound. Can be uploaded sound name or URL. Plays or resumes previous sound if no argument."
		}, {
			command: "playurl", 
			handler: e => bb.steamChatAudio.playSoundUrl(e.argument),
			argsHelp: "<URL>",
			help: "Plays sound from URL, can also be YouTube link."
		}, {
			command: ["stop", "pause"], 
			handler: e => bb.steamChatAudio.stopSound(),
			help: `Stops playing current sound. Can be resumed with "play".`
		}, {
			command: ["say", "tts"], 
			handler: e => bb.steamChatAudio.textToSpeech(e.argument),
			argsHelp: "<text>",
			help: "Reads text with text to speech."
		}
	];
}