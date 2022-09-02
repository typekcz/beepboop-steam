interface Config {
	port: number;
	mode: "client" | "web";
	baseUrl?: string;
	steam?: {
		userName?: string;
		password?: string;
		groupName?: string;
		channelName?: string;
	},
	db?: {
		connection: string | import("pg-promise/typescript/pg-subset").IConnectionParameters<import("pg-promise/typescript/pg-subset").IClient>
	}
	plugins?: string[];
	ttsUrl?: string;
}