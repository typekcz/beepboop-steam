var http = require('http');
const puppeteer = require('puppeteer');

http.createServer(async function (req, res) {
	const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
	const page = await browser.newPage();
	await page.goto('https://google.com');
	let img = await page.screenshot({type: "jpeg", encoding: "base64"});
	res.write('<img src="data:image/png;base64,' + img + '">');
	res.end();
	await browser.close();
}).listen(process.env.PORT || 8080); //the server object listens on port 8080