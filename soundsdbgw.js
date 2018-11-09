const SoundType = {
	WELCOME: 1,
	LEAVE: 2
}

class SoundsDBGW {
	/**
	 * @param {pgPromise.IMain} db
	 */
	constructor(db){
		this.db = db;
	}

	async init(){
		await this.db.none(
			`CREATE TABLE IF NOT EXISTS sound(
				name	varchar(50) PRIMARY KEY,
				data	bytea NOT NULL,
				mime	varchar(255) NOT NULL
			)`
		);
		await this.db.none(
			`CREATE TABLE IF NOT EXISTS user_sound(
				steamid	varchar(50),
				name	varchar(50),
				type	smallint,
				PRIMARY KEY(steamid, name, type),
				FOREIGN KEY(name) REFERENCES sound(name)
			)`
		);
	}

	/**
	 * 
	 * @param {String} name 
	 * @param {Buffer} data 
	 * @param {String} mime 
	 */
	async insert(name, data, mime){
		try {
			await this.db.none("INSERT INTO sound(name, data, mime) VALUES($1, $2, $3)", [name, data, mime]);
			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async selectOne(name){
		try {
			return await this.db.one("SELECT data, mime FROM sound WHERE name = $1", name);
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async selectList(){
		try {
			return (await this.db.any("SELECT name FROM sound")).map(row => row.name);
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async selectRandomUserSound(steamid, type){
		try {
			let sound = await this.db.oneOrNone(
				`SELECT sound.name FROM user_sound INNER JOIN sound ON user_sound.name = sound.name 
				WHERE steamid = $1 AND type = $2
				ORDER BY random() LIMIT 1`,
				[steamid, type]
			);
			return (sound == null ? null : sound.name);
		} catch(e){
			console.error(e);
			return null;
		}
	}

	async insertUserSound(steamid, sound, type){
		try {
			await this.db.none("INSERT INTO user_sound(steamid, name, type) VALUES($1, $2, $3)", [steamid, sound, type]);
			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}

	async deleteUserSound(steamid, sound, type){
		try {
			await this.db.none("DELETE FROM user_sound WHERE steamid = $1 AND name = $2 AND type = $3", [steamid, sound, type]);
			return true;
		} catch(e){
			console.error(e);
			return false;
		}
	}
}

SoundsDBGW.prototype.SoundType = SoundsDBGW.SoundType = SoundType;
module.exports = SoundsDBGW;