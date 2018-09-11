var http = require('http');
const puppeteer = require('puppeteer');

http.createServer(async function (req, res) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto('https://google.com');
	let buf = await page.screenshot({type: "jpeg"});
	res.pipe(buf);
	res.end();
	await browser.close();
}).listen(process.env.PORT || 8080); //the server object listens on port 8080