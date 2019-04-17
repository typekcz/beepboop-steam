let db = null;
let storages = new Map();
let updates = [];

async function setUpPersistence(db_){
	db = db_;

	await db.none(
		`CREATE TABLE IF NOT EXISTS storage(
			module	text PRIMARY KEY,
			data	bytea NOT NULL
		)`
	);
}

async function getStorage(moduleName){
	if(db){
		let storage = await db.oneOrNone("SELECT data FROM storage WHERE module = $1", moduleName);
		if(storage)
			return JSON.parse(storage);
	}
	return new Storage(moduleName);
}

async function syncStorage(moduleName){
	if(db && storages.has(moduleName)){
		if(!updates.includes(moduleName)){
			updates.push(moduleName);
			setTimeout(async () => {
				try {
					await db.none("INSERT INTO storage(module, data) VALUES($1, $2, $3) ON CONFLICT UPDATE", [moduleName, JSON.stringify(storages.get(moduleName))]);
				} catch(e){
					console.error(e);
				}
				let i = updates.indexOf(moduleName);
				if(i >= 0)
					updates.splice(i);
			}, 10000);
		}
	}
}

class Storage {
	constructor(moduleName){
		Object.defineProperty(this, "#module", {
			enumerable: false,
			value: moduleName
		});
	}

	setItem(key, value){
		this[key] = String(value);
		syncStorage(this["#module"]);
	}

	getItem(key){
		if(this.hasOwnProperty(key)){
			return this[key];
		}
		return null;
	}

	removeItem(key){
		delete this[key];
		syncStorage(this["#module"]);
	}

	clear(){
		for(let key of Object.keys(this)){
			delete this[key];
		}
		syncStorage(this["#module"]);
	}

	get length(){
		return Object.keys(this).length;
	}

	key(i){
		return Object.keys(this)[i];
	}
}

module.exports = {setUpPersistence, getStorage}