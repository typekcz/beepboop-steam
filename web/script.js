window.addEventListener("load", async () => {
	let authId = localStorage.getItem("authId");
	if(authId){
		let res = await fetch("/api/steam/check", {
			headers: {
				Session: authId
			}
		});
		if(!res.ok){
			localStorage.removeItem("authId");
		} else {
			document.body.classList.toggle("logged", true);
		}
	}
	listSounds();
	registerAsyncSubmitEvents();
});

window.addEventListener("storage", (e) => {
	if(e.key == "authId"){
		if(e.newValue){
			document.body.classList.toggle("logged", true);
		} else {
			document.body.classList.toggle("logged", false);
		}
	}
});

function registerAsyncSubmitEvents(){
	for(let form of document.querySelectorAll("form[data-asyncSubmit]")){
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			let form = event.target;
			let options = {
				method: form.method
			};
			if(form.method.toUpperCase() != "GET")
				options.body = new FormData(form);
			if(form.getAttribute("data-session") != null)
				options.headers = {Session: localStorage.getItem("authId")};
			let res = await fetch(form.action, options);
			if(!res.ok){
				alert(await res.text());
			} else if(res.headers.get("content-type").indexOf("application/json") !== -1){
				eval(await res.text());
			}
			console.log(res);
		});
	}
}

async function listSounds(){
	try {
		let res = await fetch("/api/sounds");
		let sounds = await res.json();
		if(!(sounds instanceof Array))
			throw new TypeError("Received data aren't Array.");
		let soundsElement = document.getElementById("sounds");
		for(let sound of sounds){
			let btn = document.createElement("button");
			btn.innerText = sound;
			btn.addEventListener("click", async () => {
				let res = await fetch("/api/sounds/" + encodeURIComponent(sound) + "/play", {
					method: "POST"
				});
				console.log(res);
			});
			soundsElement.appendChild(btn);
		}
	} catch(e){
		console.log(e);
	}
}
