//@ts-check

export default class UserInfo {
	constructor(user){
		this.name = user.display_name;
		this.steamid = user.steamid64;
		this.accountid = user.accountid;
		this.gamename = user.current_game_name;
		this.appid = user.persona.m_gameid
	}
}