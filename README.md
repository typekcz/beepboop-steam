# BeepBoop
BeepBoop is sound bot for new Steam chat. He connects to group chat voice channel and plays sounds there. Can run on Heroku free plan.

## Features
 * Plays all Chromium supported audio formats
 * Support for playing YouTube links, also support search and play with plugin
 * Search and play sound from [myinstants.com](https://www.myinstants.com/) (plugin)
 * Multiple user welcome and leave sounds (randomly plays one)
 * Only members of Steam group chat can upload sounds.
 * Chat commands.

## Installation

### Prerequisities
 * [Node.js](https://nodejs.org/)
 * Chrome/Chromium - For playing non-free codecs (which you probably want) you need to provide Chrome or Chromium browser with proper codecs support.
    * Windows: You can use regular Chrome installation
    * Linux: Install `chromium-browser` and `chromium-codecs-ffmpeg-extra` packages (Debian/Ubuntu) or your distros equivalent
    * [Heroku](https://www.heroku.com/): Use [Puppeteer buildpack](https://github.com/typekcz/puppeteer-heroku-buildpack)
 * Optional: [PostgreSQL database](https://www.postgresql.org/) - You can skip this, but without it you won't be able to upload your own sounds and will be limited to playing only from YouTube and MyInstants.

### Configuring environment variables

You need to set path to Chrome/Chromium that you want to use, otherwise Chromium without extra codecs will be automatically downloaded and used. You can do that by setting [Puppeteer environment variables](https://pptr.dev/#?product=Puppeteer&version=v8.0.0&show=api-environment-variables). Example:

```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=
PUPPETEER_EXECUTABLE_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
```

Heroku build pack sets these for you.

### BeepBoop's configuration

BeepBoop needs Steam login credentials to "his" account. You can create new account on Steam without Steam Guard (limited Steam account is sufficient).
Configuration can be put to config.json file in the project's root or in environment variable `CONFIG`. You can also specify path to config file through `--config-file <path>` argument or environment variable `CONFIGFILE`.
Example config:
```json
{
	"baseUrl": "http://beepboop.example.com/",
	"port": 8080,
	"steam": {
		"userName": "BeepBoop",
		"password": "sUp3rH4rdC0r3p@s5w0rd",
		"groupName": "Testy Mc Test Face",
		"channelName": "Voicey Mc Voice Face"
	},
	"db": {
		"connection": "postgres://beepboop:beepboop@localhost/beepboop"
	},
	"plugins": [
		"myinstants", "youtubesearch"
	],
	"ttsUrl": "https://example.com/text-to-speech?lang=en&key=xxxxxx&text=",
	"volume": 0.15
}
```
Explanation of some options:

Option | Description
------ | -----------
baseUrl| URL where web interface will be accessed. This will be http://localhost:8080/ when running locally.
port | Port for web server. On Heroku this is automaticaly set in environment variable so exclude this on Heroku.
steam.username, steam.password | Just create new Steam account (https://store.steampowered.com/join/).
steam.groupName | Name of the Steam group chat. See picture below. Bot's account has to be member of the group chat.
steam.channelName | Name of the voice channel in Steam group chat. See picture below.
db.connection | Connection string for PostgreSQL database. Other DBMSs are not supported.
volume | For some reason BeepBoop is incredibly loud so I recommend to set volume to 0.4.
ttsUrl | You can provide URL for text to speech. Needs to be URL where text can be appended at the end and which responds with audio.

![Steam group chat](https://i.imgur.com/sh6RMgU.png)

### Run

When you are ready, install npm dependencies `npm install` and then you can start BeepBoop with `npm run start`.

## Instalation
Requires [Node.js](https://nodejs.org/). On Heroku use [Puppeteer buildpack](https://github.com/typekcz/puppeteer-heroku-buildpack).
When all is configured just do:
```
npm install
npm run start
```

## Usage

Bot will join voice room when there is someone and leave when he is alone in it, because Steam doesn't like long idling in empty room.

### Web interface

Open web interface in your browser and see what can it do. This will probably be http://localhost:8080/ when running locally.

### Chat commands
Chat commands can be sent into any Steam chat room that bot can access. All commands starts with bot's name handle, for example:
```
@BeepBoop play engineerremix
```

You can now also send him a direct message that doesn't require the name handle. You can send direct messages even if you are not friends, just click on the bot in the group members list.

Command | Description
------- | -----------
**play** *sound* | Plays uploaded sound matching name %1.
**playurl** *http://example.com/linktosound.mp3* | Plays passed URL, supports Youtube URLs.
**instant** *get to da choppa* | Searches sounds on [myinstants.com](https://www.myinstants.com/) and plays first result. If you want another result append # followed by number of result you want to play.
**youtube** *dramatic* *chipmunk* | Searches videos on YouTube and plays the first one or you can append # and number to play that specific result like with **instant** command.
**stop** | Stops whatever is playing.
**beep** | Boop.
**eval** *[3,2,1].sort()* | Safely runs JavaScript code. Don't ask me why.

## Known issues
 * It's just wrong...
 * Bot is sometimes logged out of Steam or in some weird non-functioning state and you have to restart it.
 * My bot's account had some voice chat ban. He couldn't join voice chat, but other accounts on the same machine were working. This eventually disappeared when I changed it to leave the room when it's empty, but you should keep in mind that Valve can do these things as bots are technically not allowed on Steam, but are usually tolerated.
