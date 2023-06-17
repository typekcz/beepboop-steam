//@ts-check
import BeepBoop from "./beepboop.js";

/** @type {import("./beepboop.js").default?} */
let beepboop;

export default class Main {
	static async main(args){
		process.on("unhandledRejection", (error, p) => {
			console.error("Unhandled Promise Rejection", p, error);
		});
	
		process.on("SIGINT", Main.shutdown);
		process.on("SIGUSR1", Main.shutdown);
		process.on("SIGUSR2", Main.shutdown);

		// Start
		beepboop = new BeepBoop();
		if(beepboop){
			this.hook_stream(process.stdout, str => beepboop.webApp.appendToLog(str));
			this.hook_stream(process.stderr, str => beepboop.webApp.appendToLog(str));
		}
		await beepboop.init();
	}
	
	// Credit: https://gist.github.com/pguillory/729616/32aa9dd5b5881f6f2719db835424a7cb96dfdfd6
	static hook_stream(stream, callback) {
		stream.write = (function(write) {
			return function(string, encoding, fd) {
				write.apply(stream, arguments);
				callback(string, encoding, fd);
			};
		})(stream.write);
	}

	static async shutdown(){
		console.log("\nShutdown:");
		try {
			await beepboop?.stop();
		} finally {
			process.exit(0);
		}
	}
}