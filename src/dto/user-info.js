//@ts-check

export default class UserInfo {
	constructor(user){
		/** @type {string} */
		this.name = user.display_name;
		/** @type {string} */
		this.steamid = user.steamid64;
		/** @type {number} */
		this.accountid = user.accountid;
		/** @type {string} */
		this.gamename = user.current_game_name;
		/** @type {string} */
		this.appid = user.persona.m_gameid
	}
}