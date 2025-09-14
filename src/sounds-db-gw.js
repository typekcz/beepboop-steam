//@ts-check

const SoundType = {
	WELCOME: 1,
	LEAVE: 2
}

export default class SoundsDbGw {
	/**
	 * @param {import("pg-promise").IDatabase<{}, import("pg-promise/typescript/pg-subset.js").IClient>} db
	 */
	constructor(db){
		this.db = db;
		this.initPromise = null;
		this.isInitialized = false;
	}

	async init(){
		if(this.isInitialized) return;
		if(this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
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
				this.isInitialized = true;
			} catch(e){
				console.error(e.message);
			} finally {
				this.initPromise = null;
			}
		})();
	}

	/**
	 * 
	 * @param {String} name 
	 * @param {Buffer} data 
	 * @param {String} mime 
	 */
	async insert(name, data, mime){
		try {
			await this.init();
			await this.db.none("INSERT INTO sound(name, data, mime) VALUES($1, $2, $3) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, mime = EXCLUDED.mime", [name, data, mime]);
			return true;
		} catch(e){
			console.error(e.message);
			return false;
		}
	}

	async selectOne(name){
		try {
			await this.init();
			return await this.db.one("SELECT data, mime FROM sound WHERE name = $1", name);
		} catch(e){
			console.error(e.message);
			return null;
		}
	}

	async selectList(){
		try {
			await this.init();
			return (await this.db.any("SELECT name FROM sound ORDER BY name ASC")).map(row => row.name);
		} catch(e){
			console.error(e.message);
			return null;
		}
	}

	/**
	 * 
	 * @param {string} steamid 
	 * @param {number} type 
	 * @returns 
	 */
	async selectUserSounds(steamid, type){
		try {
			await this.init();
			let sounds = await this.db.any(
				`SELECT sound.name FROM user_sound INNER JOIN sound ON user_sound.name = sound.name 
				WHERE steamid = $1 AND type = $2`,
				[steamid, type]
			);
			return sounds.map(s => s.name);
		} catch(e){
			console.error(e.message);
			return null;
		}
	}

	/**
	 * 
	 * @param {string} steamid 
	 * @param {number} type 
	 * @returns 
	 */
	async selectRandomUserSound(steamid, type){
		try {
			await this.init();
			let sound = await this.db.oneOrNone(
				`SELECT sound.name FROM user_sound INNER JOIN sound ON user_sound.name = sound.name 
				WHERE steamid = $1 AND type = $2
				ORDER BY random() LIMIT 1`,
				[steamid, type]
			);
			return (sound == null ? null : sound.name);
		} catch(e){
			console.error(e.message);
			return null;
		}
	}

	async insertUserSound(steamid, sound, type){
		try {
			await this.init();
			let res = await this.db.result("INSERT INTO user_sound(steamid, name, type) VALUES($1, $2, $3)", [steamid, sound, type]);
			return (res.rowCount == 1);
		} catch(e){
			console.error(e.message);
			return false;
		}
	}

	async deleteUserSound(steamid, sound, type){
		try {
			await this.init();
			await this.db.none("DELETE FROM user_sound WHERE steamid = $1 AND name = $2 AND type = $3", [steamid, sound, type]);
			return true;
		} catch(e){
			console.error(e.message);
			return false;
		}
	}
}

SoundsDbGw.prototype.SoundType = SoundsDbGw.SoundType = SoundType;