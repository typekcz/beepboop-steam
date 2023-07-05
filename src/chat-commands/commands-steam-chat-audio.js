//@ts-check

/**
 * 
 * @param {import("../steam-api/steam-chat-audio.js").default} steamChatAudio 
 * @returns {import("../chat-handler.js").ChatCommand[]}
 */
export default function createSteamChatAudioCommands(steamChatAudio){
	return [
		{
			command: "play", 
			handler: async e => {
				if(e.argument)
					if(/^https?:\/\//.test(e.argument))
						await steamChatAudio.playSoundUrl(e.argument);
					else
						await steamChatAudio.playSound(e.argument);
				else
					await steamChatAudio.resumeSound();
			},
			argsHelp: "[sound]",
			help: "Plays sound. Can be uploaded sound name or URL. Plays or resumes previous sound if no argument."
		}, {
			command: "playurl", 
			handler: e => steamChatAudio.playSoundUrl(e.argument),
			argsHelp: "<URL>",
			help: "Plays sound from URL, can also be YouTube link."
		}, {
			command: ["stop", "pause"], 
			handler: e => steamChatAudio.stopSound(),
			help: `Stops playing current sound. Can be resumed with "play".`
		}, {
			command: ["say", "tts"], 
			handler: e => steamChatAudio.textToSpeech(e.argument),
			argsHelp: "<text>",
			help: "Reads text with text to speech."
		}
	];
}