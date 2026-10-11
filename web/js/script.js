/**
 * Handles promise rejection of the function by writing the error to the console.
 * @template {(...args: any[]) => Promise<?>} T
 * @param {T} func
 * @returns {(...args: Parameters<T>) => void}
 */
function unpromisify(func) {
	return function (...args) {
		func(...args).catch(e => {
			console.error(e);
			alert(`&#9888;&#65039; Error\n${e?.message ?? e}`);
		});
	};
}

window.addEventListener("load", unpromisify(async () => {
	let authId = localStorage.getItem("authId");
	/** @type {Promise<any>[]} */
	const promises = [];
	if(authId){
		let res = await fetch("api/steam/check", {
			headers: {
				Session: authId
			}
		});
		if(!res.ok){
			localStorage.removeItem("authId");
		} else {
			document.body.classList.toggle("logged", true);
			promises.push(
				listUserSounds("welcome"),
				listUserSounds("leave")
			);
		}
	}
	promises.push(listSounds());
	await Promise.all(promises);
	registerAsyncSubmitEvents();
}));

window.addEventListener("storage", unpromisify(async (e) => {
	if(e.key == "authId"){
		if(e.newValue){
			document.body.classList.toggle("logged", true);
			document.getElementById("welcomeSounds").innerHTML = "";
			document.getElementById("leaveSounds").innerHTML = "";
			await Promise.all([
				listUserSounds("welcome"),
				listUserSounds("leave")
			]);
		} else {
			document.body.classList.toggle("logged", false);
		}
	}
}));

function registerAsyncSubmitEvents(){
	for(let form of document.querySelectorAll("form[data-asyncSubmit]")){
		delete form.dataset.asyncsubmit;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			unpromisify(asyncSubmit(event));
		});
	}
}

/**
 * @param {SubmitEvent} event 
 */
async function asyncSubmit(event) {
	let form = event.target;

	let beforeScript = form.dataset.beforesubmit;
	if(beforeScript)
		eval(beforeScript);

	let options = {
		method: form.method
	};
	if(form.method.toUpperCase() != "GET")
		options.body = new FormData(form);
	if(form.dataset.session != null)
		options.headers = {Session: localStorage.getItem("authId")};
	let res = await fetch(form.action, options);
	console.log(res);
	let contentType = res.headers.get("content-type");
	if(!res.ok){
		let responseText = await res.text();
		if(contentType.includes("text/html") && responseText){
			let reres = /<pre>(.*?)<br>/.exec(responseText);
			if(reres)
				responseText = reres[1];
		}
		if(!responseText)
			responseText = res.statusText;
		alert(responseText);
	} else if(contentType?.includes("text/javascript")){
		eval(await res.text());
	}
	
	let afterScript = form.dataset.aftersubmit;
	if(afterScript)
		eval(afterScript);
}

function soundDragStart(event){
	event.dataTransfer.setData("sound", event.target.innerText);
}

function allowDrop(event){
	event.preventDefault();
}

function soundDragDrop(event, type){
	event.preventDefault();
	let sound = event.dataTransfer.getData("sound");
	unpromisify(() => addUserSound(sound, type))();
}

async function listSounds(){
	try {
		let res = await fetch("api/sounds");
		let sounds = await res.json();
		if(!(Array.isArray(sounds)))
			throw new TypeError("Received data aren't Array.");
		let soundsElement = document.getElementById("sounds");
		soundsElement.innerHTML = "";
		for(let sound of sounds){
			let btn = document.createElement("button");
			btn.type = "button";
			btn.draggable = true;
			btn.ondragstart = soundDragStart;
			btn.innerText = sound;
			btn.addEventListener("click", unpromisify(async () => {
				let res = await fetch("api/sounds/" + encodeURIComponent(sound) + "/play", {
					method: "POST"
				});
				console.log(res);
			}));
			soundsElement.appendChild(btn);
		}
	} catch(e){
		console.log(e);
	}
}

async function addUserSound(sound, type, sendToServer = true){
	if(sendToServer){
		let res = await fetch("api/user/sounds/"+type+"/" + sound, {
			method: "post",
			headers: {
				Session: localStorage.getItem("authId")
			}
		});
		if(res.status != 201)
			return;
	}
	let element = document.getElementById(type+"Sounds");
	let span = document.createElement("span");
	span.className = "tag";
	span.innerText = sound;
	span.innerHTML += `<button type="button" onclick="removeUserSound(this, '`+type+`')">🗙</button>`;
	element.appendChild(span);
}

async function listUserSounds(type){
	try {
		let res = await fetch("api/user/sounds/"+type+"/", {
			headers: {
				Session: localStorage.getItem("authId")
			}
		});
		let sounds = await res.json();
		await Promise.all(sounds.map(s => addUserSound(s, type, false)));
	} catch(e){
		console.log(e);
	}
}

function removeUserSound(button, type){
	unpromisify(async () => {
		let sound = button.previousSibling.textContent;
		await fetch("api/user/sounds/"+type+"/" + sound, {
			method: "delete",
			headers: {
				Session: localStorage.getItem("authId")
			}
		});
		button.parentElement.remove();
	})();
}

function sendMessage(message) {
	return fetch("api/messages", {
		method: "post",
		headers: {
			Session: localStorage.getItem("authId")
		},
		body: message
	}).then(r => r.text());
}

function reloadLog() {
	const frame = document.getElementById("log")?.querySelector("iframe");
	if(!frame) return;
	frame.src = `log?t=${Date.now()}`
}

function reloadScreen() {
	const image = document.getElementById("screen")?.querySelector("img");
	if(!image) return;
	image.src = `screen?t=${Date.now()}`
}
