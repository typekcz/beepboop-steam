//@ts-check
import { YtDlp } from "ytdlp-nodejs";
import config from "./config-loader.js";

const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|live)\/)/;
const validQueryDomains = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
]);

export const ytHelper = new class YtHelper {
	ytdlp = new YtDlp();

	constructor() {
		/** @type {import("ytdlp-nodejs").ArgsOptions} */
		const defaultOpts = {
			format: "bestaudio[ext=webm][abr<=128]/bestaudio[ext=webm]"
		};
		this.ytdlpOpts = Object.assign(defaultOpts, config.ytdlp);
	}

	async init() {
		const result = await this.ytdlp.updateYtDlpAsync();
		console.info(`yt-dlp is ready (${result.version ?? "version unknown"}).`);
	}

	/**
	 * @param {string} link
	 */
	validateUrl(link) {
		// Based on ytdl-core implementation
		// https://github.com/distubejs/ytdl-core/blame/102e7727ca652216bdb63c27f713edb68a316c07/lib/url-utils.js#L26
		let parsed;
		try {
			parsed = new URL(link.trim());
		} catch {
			return false;
		}
		let id = parsed.searchParams.get("v");
		if (validPathDomains.test(link.trim()) && !id) {
			const paths = parsed.pathname.split("/");
			id = parsed.host === "youtu.be" ? paths[1] : paths[2];
		} else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
			return false; // Not a YouTube domain
		}
		return Boolean(id);
	}

	/**
	 * @param {string} link 
	 * @param {import("express").Response} res 
	 */
	async streamToResponse(link, res) {
		const audioStream = this.ytdlp.stream(link, this.ytdlpOpts)
			.getStream();
		res.status(200);
		res.set("Access-Control-Allow-Origin", "*");
		res.type("audio/webm");
		audioStream.on("error", /** @param {Error} error */ error => {
			console.error("Error while streaming YouTube audio.", error);
			if(!res.headersSent) res.status(502).end();
			else res.destroy();
		});
		res.on("close", () => {
			if(!res.writableEnded) audioStream.destroy();
		});
		audioStream.pipe(res);
	}

	/**
	 * @param {string} link 
	 */
	getTitle(link) {
		return this.ytdlp.execAsync(link, { print: "title", skipDownload: true })
			.then(result => result.output.trim());
	}
}
