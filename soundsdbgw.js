class SoundsDBGW {
	/**
	 * @param {pgPromise.IMain} db
	 */
	constructor(db){
		this.db = db;
	}

	async init(){
		let res = await this.db.result(
			`SELECT 1
			FROM   information_schema.tables 
			WHERE  table_schema = 'public'
				AND    table_name = 'sound'`
		);
		if(res.rowCount != 1){
			await this.db.none(
				`CREATE TABLE sound(
					name	varchar(50) PRIMARY KEY,
					data	bytea NOT NULL,
					mime	varchar(255) NOT NULL
				)`
			);
		}
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
}

module.exports = SoundsDBGW;