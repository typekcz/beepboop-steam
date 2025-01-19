//@ts-check
import http from "http";
import https from "https";
import url from "url";

export function request(url_, options = {}){
	return new Promise((resolve, reject) => {
		let parsedUrl = url.parse(url_);
		let provider = null
		if(parsedUrl.protocol == "https:")
			provider = https;
		else if(parsedUrl.protocol == "http:")
			provider = http;
		if(provider == null)
			return reject(new Error("No provider for protocol \"" + parsedUrl.protocol + "\""));

		// For some reason puppeteer messes up https.require function, so it no longer takes url as string
		options = Object.assign(options, parsedUrl);
		
		let request = provider.request(options, (result_) => {
			/** @type {http.IncomingMessage & {body?: any}} */
			let result = result_;
			result.body = [];
			result.on("data", (chunk) => {
				result.body.push(chunk);
			});
			result.on("end", () => {
				result.body = Buffer.concat(result.body);
				resolve(result);
			});
		});
		request.end();
		request.on("error", (/**@type {Error}*/ error) => {
			reject(error);
		});
	});
}

export function sleep(ms){
	return new Promise((resolve, reject) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Handles promise rejection of the function by writing the error to the console.
 * @template {(...args: any[]) => Promise<?>|void} T
 * @param {T} func
 * @returns {(...args: Parameters<T>) => void}
 */
export function unpromisify(func) {
	return function (...args) {
		// @ts-ignore Property 'catch' does not exist on type 'void'.
		func(...args)?.catch(console.error);
	};
}

/**
 * 
 * @template T
 * @param {function():Promise<T>} promise promise generator
 * @param {number} intervalMs time between retries
 * @param {number} maxRetries
 * @param {boolean} silent if true, less messages are printed to console
 * @returns {Promise<T>}
 */
export async function retryPromise(promise, intervalMs = 1000, maxRetries = Number.POSITIVE_INFINITY, silent = false){
	try {
		return await promise();
	} catch(e){
		let lastErrorMessage = e.message;
		if(!silent)
			console.error(e);
		if(maxRetries <= 0)
			throw e;
		if(!silent)
			console.log("Retrying");
		for(let i = 0; i < maxRetries; i++){
			try {
				await sleep(intervalMs);
				let res = await promise();
				process.stdout.write("\n");
				return res;
			} catch(e){
				if(i == maxRetries-1)
					throw e;
				if(e.message !== lastErrorMessage){
					if(!silent){
						console.error(e);
						console.log("Retrying");
					} else {
						console.error(lastErrorMessage);
						console.log("Retrying");
					}
				}
				lastErrorMessage = e.message;
			}
		}
	}
	throw new Error("This should be unreachable code.");
}

/**
 * 
 * @param {number} seconds 
 * @returns {string}
 */
export function formatDuration(seconds) {
	const timeUnits = [
		{unit: 'day', duration: 24 * 60 * 60},
		{unit: 'hour', duration: 60 * 60},
		{unit: 'minute', duration: 60},
		{unit: 'second', duration: 1}
	];
	
	const formattedTime = [];
	for (const { unit, duration } of timeUnits) {
		if (seconds >= duration) {
			const count = Math.floor(seconds / duration);
			seconds %= duration;
			formattedTime.push(`${count} ${unit}${count > 1 ? 's' : ''}`);
		}
	}
	
	return formattedTime.length > 0 ? formattedTime.join(', ') : '0 seconds';
}

/**
 * Returns random element of an array.
 * @template T
 * @param {T[]} array 
 * @returns {T}
 */
export function randomElement(array) {
	return array[Math.round(Math.random()*(array.length - 1))];
}