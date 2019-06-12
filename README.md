# BeepBoop
BeepBoop is sound bot for new Steam chat. He connects to group chat voice channel and plays sounds there. Runs on Heroku free plan.

## Features
 * Plays all Chromium supported audio formats
 * Support for playing Youtube links
 * Search and play sound from myinstants.com
 * Multiple user welcome and leave sounds (random)
 * Only members of Steam group chat can upload sounds.
 * Chat commands.

## Configuration
BeepBoop needs Steam login credentials to "his" account. You can create new account on Steam without Steam Guard (limited Steam account is sufficient).
Configuration can be put to config.json file in the project root or in environment variable `CONFIG`. You can also specify custom config filename through `--config-file <path>` or environment variable `CONFIGFILE`.
Example config:
```json
{
	"baseUrl": "http://beepboop/",
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
		"myinstants"
	],
	"volume": 0.15
}
```
Explanation of some options:

Option | Description
------ | -----------
baseUrl| URL where web interface will be accessed.
port | Port for web server. On Heroku this is automaticaly set in environment variable.
steam.username, steam.password | Just create new Steam account (https://store.steampowered.com/join/).
steam.groupName | Name of the Steam group chat. See picture below. Bot's account has to be member of the group chat.
steam.channelName | Name of the voice channel in Steam group chat. See picture below.
db.connection | Connection string for PostgreSQL database. Other DBMSs are not supported.
volume | For some reason BeepBoop is incredibly loud so I recommend to set volume to 0.15.

![Steam group chat](https://i.imgur.com/sh6RMgU.png)

## Instalation
Requires [Node.js](https://nodejs.org/). On Heroku use [Puppeteer buildpack](https://github.com/typekcz/puppeteer-heroku-buildpack).
When all is configured just do:
```
npm install
npm run start
```

### Audio support
Puppeteer downloads its own Chromium which does not contain ffmpeg codec. Some sounds/videos won't work especialy those from Youtube. If you want ffmpeg you your own Chromium installation. On Ubuntu use these packages:
```
chromium-browser chromium-codecs-ffmpeg-extra
```
Then set env. variables so that Puppeteer will you your installed Chromium.
```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=
PUPPETEER_EXECUTABLE_PATH="/usr/lib/chromium-browser/chromium-browser"
```
Buildpack for Heroku linked above is already modified to do this.


## Chat commands
Chat commands can be sent into any Steam chat room that bot can access. All commands starts with bot's name handle, for example:
```
@BeepBoop play engineerremix
```

Command | Description
------- | -----------
**play** *sound* | Plays uploaded sound matching name %1.
**playurl** *http://linktosound.mp3* | Plays passed URL, supports Youtube URLs.
**instant** *get to da choppa* | Searches sounds on [myinstants.com](https://www.myinstants.com/) and plays first result. If you want another result append # followed by number of result you want to play.
**stop** | Stops whatever is playing.
**beep** | Boop.
**eval** *[3,2,1].sort()* | Safely runs JavaScript code. Don't ask me why.

## Known issues
 * It's just wrong...
 * Bot is sometimes logged out of Steam and you have to restart it.
