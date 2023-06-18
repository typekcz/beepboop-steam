# BeepBoop
BeepBoop is sound bot for new Steam chat. He connects to group chat voice channel and plays sounds there.

## Features
 * Plays all Chromium supported audio formats
 * Support for playing YouTube links, also includes plugin for playing videos found by search phrase
 * Search and play sound from [myinstants.com](https://www.myinstants.com/) (plugin)
 * Multiple user welcome and leave sounds (randomly plays one)
 * Only members of Steam group chat can upload sounds.
 * Chat commands.

## Installation

### Prerequisites
 * Install Docker and Docker Compose

### Configuration

BeepBoop needs Steam login credentials to "his" account. You can create new account on Steam without Steam Guard (limited Steam account is sufficient). Put login credentials to **.env** file like this:

```
STEAM_USERNAME=BeepBoop
STEAM_PASSWORD=sUp3rH4rdC0r3p@s5w0rd
```

Configuration can be put to config.json file in the project's root or in environment variable `CONFIG`. You can also specify path to config file through `--config-file <path>` argument or environment variable `CONFIGFILE`.
Example config:
```json
{
	"baseUrl": "http://beepboop.example.com/",
	"steam": {
		"groupName": "Testy Mc Test Face",
		"channelName": "Voicey Mc Voice Face"
	},
	"plugins": [
		"myinstants", "youtubesearch"
	],
	"ttsUrl": "https://example.com/text-to-speech?lang=en&key=xxxxxx&text=",
	"volume": 0.3
}
```
Explanation of some options:

Option | Description
------ | -----------
mode | `"client"` for using Docker image with Steam client, `"web"` for using headless web browser. You don't need to set this if you use supplied docker-compose configs.
baseUrl| URL where web interface will be accessed. This will be http://localhost:8080/ when running locally.
steam.groupName | Name of the Steam group chat. See picture below. Bot's account has to be member of the group chat.
steam.channelName | Name of the voice channel in Steam group chat. See picture below.
volume | For some reason BeepBoop is incredibly loud so I recommend to set volume to 0.4.
ttsUrl | You can provide URL for text to speech. Needs to be URL where text can be appended at the end and which responds with audio.

![Steam group chat](https://i.imgur.com/sh6RMgU.png)

### Run

You have to decide what mode you want to use. Client mode runs whole desktop and Steam client in a container. Web mode just runs headless Chrome with Steam Chat in it. Currently I recommend using web mode, client mode was created because web Steam Chat was broken for a long time, but now it's working again.

When you are ready, you can start it with: `docker-compose -f docker-compose.web.yml up --build`. This will start container for BeepBoop and database container.

On first login, it will be stuck on Steam Guard code, so you need to download some VNC client and connect to localhost:5900 and fill in the Steam Guard code into the login form. If you are running it on server, best way to do this is to setup SSH tunneling for port 5900, because it's only accessible from localhost due to security.

## Usage

Bot will join voice room when there is someone and leave when he is alone in it.

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
**pause** | Same thing as stop.
**play** | (Without argument) resume playing stopped/paused sound.
**beep** | Boop.
**eval** *[3,2,1].sort()* | Safely runs JavaScript code. Don't ask me why.