//@ts-check

import { whenArgumentStartWith } from "../utils.js";

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
					await bb.steamChatAudio.playSound(e.argument);
				else
					await bb.steamChatAudio.resumeSound();
			},
			argsHelp: "[sound|URL]",
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
		}, {
			command: ["queue", "q"],
			handler: e => {
				if(!e.argument) { // List queue
					if(bb.steamChatAudio.queue.length == 0) return e.sendResponse("Queue is empty.");
					return e.sendResponse(bb.steamChatAudio.queue.map((item, i) => 
						`${i+1}. ${item.name}\n${item.originalUrl}`
					).join("\n\n"));
				}
				if(e.argument == "clear") {
					bb.steamChatAudio.queueClear();
					return e.sendResponse("Queue cleared.");
				}
				if(e.argument == "next") {
					return bb.steamChatAudio.queueNext();
				}
				if(whenArgumentStartWith(e.argument, "remove ", (position) => {
					const removed = bb.steamChatAudio.queueRemove(Number(position)-1);
					if(removed)
						e.sendResponse(`Removed from queue: ${removed.name} - ${removed.originalUrl}.`);
					else
						e.sendResponse(`Couldn't remove queue item ${position}.`);
				})) return;

				const [, sound, position] = /^(.+?)( \d+)?$/.exec(e.argument);
				let positionNum = Number(position);
				if(positionNum == 0) positionNum = null;
				if(positionNum > 0) positionNum--;
				bb.steamChatAudio.queueAdd(sound, positionNum);
			},
			argsHelp: `[sound|URL|"remove"|"clear"] [add/remove position]`,
			help: `Adds sound to the queue`
		}
	];
}