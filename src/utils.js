const http = require("http");
const https = require("https");
const url = require("url");

module.exports = {
	request: function (url_, options = {}){
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
};