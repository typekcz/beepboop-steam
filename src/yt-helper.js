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
			audioQuality: "6"
		};
		this.ytdlpOpts = Object.assign(defaultOpts, config.ytdlp);
	}

	/**
	 * @param {string} link
	 */
	validateUrl(link) {
		// Based on ytdl-core implementation
		// https://github.com/distubejs/ytdl-core/blame/102e7727ca652216bdb63c27f713edb68a316c07/lib/url-utils.js#L26
		const parsed = new URL(link.trim());
		let id = parsed.searchParams.get("v");
		if (validPathDomains.test(link.trim()) && !id) {
			const paths = parsed.pathname.split("/");
			id = parsed.host === "youtu.be" ? paths[1] : paths[2];
		} else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
			return false; // Not a YouTube domain
		}
		if (!id) {
			return false; // No video id found
		}
		return true;
	}

	/**
	 * @param {string} link 
	 * @param {import("express").Response} res 
	 */
	streamToResponse(link, res) {
		this.ytdlp.stream(link, this.ytdlpOpts)
			.filter("audioonly")
			.on("beforeDownload", (info) => {
				res.status(200);
				res.set("Access-Control-Allow-Origin", "*");
				res.set("Content-Type", info.media_type);
			})
			.pipe(res)
			.catch(() => console.error("Error while piping ytdpl stream to HTTP response."));
	}
}
