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
		
		let request = provider.request(options, (result) => {
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
		request.on("error", (error) => {
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
 * 
 * @template T
 * @param {function():Promise<T>} promise 
 * @param {number} intervalMs 
 * @param {number} maxRetries 
 * @returns {Promise<T>}
 */
export async function retryPromise(promise, intervalMs = 1000, maxRetries = Number.POSITIVE_INFINITY){
	try {
		return await promise();
	} catch(e){
		let lastErrorMessage = e.message;
		console.error(e);
		if(maxRetries <= 0)
			throw e;
		process.stdout.write("Retrying");
		for(let i = 0; i < maxRetries; i++){
			process.stdout.write(".");
			try {
				await sleep(intervalMs);
				let res = await promise();
				process.stdout.write("\n");
				return res;
			} catch(e){
				if(i == maxRetries-1)
					throw e;
				if(e.message !== lastErrorMessage){
					console.error(e);
					process.stdout.write("Retrying");
				}
				lastErrorMessage = e.message;
			}
		}
	}
	throw new Error("This should be unreachable code.");
}