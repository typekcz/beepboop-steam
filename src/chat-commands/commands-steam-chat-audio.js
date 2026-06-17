//@ts-check

/**
 * 
 * @param {import("../beepboop.js").default} bb
 * @returns {import("../chat-handler.js").ChatCommand[]}
 */
export default function createSteamChatAudioCommands(bb){
	/**
	 * Adds an uploaded sound (by name) or a URL to the queue and reports its
	 * position. Shared by the "play" and "playurl" commands.
	 * @param {import("../chat-command-event.js").default} e
	 */
	async function enqueueAndRespond(e){
		let position;
		if(/^https?:\/\//.test(e.argument))
			position = await bb.steamChatAudio.enqueueSoundUrl(e.argument);
		else
			position = await bb.steamChatAudio.enqueueSound(e.argument);
		if(position === 1)
			e.sendResponse(`Playing "${e.argument}".`, false);
		else
			e.sendResponse(`Queued "${e.argument}" at position ${position}.`, false);
	}

	return [
		{
			command: "play",
			handler: async e => {
				if(e.argument)
					await enqueueAndRespond(e);
				else
					await bb.steamChatAudio.resumeSound();
			},
			argsHelp: "[sound]",
			help: "Adds sound to the queue. Can be uploaded sound name or URL. Resumes previous sound if no argument."
		}, {
			command: "playurl",
			handler: enqueueAndRespond,
			argsHelp: "<URL>",
			help: "Adds sound from URL to the queue, can also be YouTube link."
		}, {
			command: ["queue", "q"],
			handler: e => {
				if(e.argument){
					e.sendResponse(`Use "play" to add sounds to the queue.`, false);
					return;
				}
				let {current, queue} = bb.steamChatAudio.getQueue();
				if(!current && queue.length === 0)
					e.sendResponse("Queue is empty.", false);
				else {
					let lines = [];
					if(current)
						lines.push(`▶ ${current}`);
					queue.forEach((title, i) => lines.push(`${i + 1}. ${title}`));
					e.sendResponse(lines.join("\n"), false);
				}
			},
			help: `Shows the current queue. Use "play" to add sounds.`
		}, {
			command: ["skip", "next"],
			handler: async e => {
				let skipped = await bb.steamChatAudio.skip();
				if(skipped)
					e.sendResponse(`Skipped "${skipped.title}".`, false);
				else
					e.sendResponse("Nothing to skip.", false);
			},
			help: "Skips current sound and plays the next one in the queue."
		}, {
			command: ["clearqueue", "cq"],
			handler: e => {
				let count = bb.steamChatAudio.clearQueue();
				e.sendResponse(`Cleared ${count} sound${count === 1? "": "s"} from the queue.`, false);
			},
			help: "Removes all sounds from the queue. Doesn't stop the current sound."
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