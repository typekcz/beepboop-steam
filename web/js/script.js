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

	let soundContextMenu = new ContextMenu(".soundContextMenu", [
		{
			name: "Add to welcome sounds", 
			fn: (target) => {
				fetch("/api/user/sounds/welcome/" + target.innerText, {
					method: "post",
					headers: {
						Session: localStorage.getItem("authId")
					}
				});
			}
		}, {
			name: "Remove from welcome sounds", 
			fn: (target) => {
				fetch("/api/user/sounds/welcome/" + target.innerText, {
					method: "delete",
					headers: {
						Session: localStorage.getItem("authId")
					}
				});
			}
		}, {
			name: "Add to leave sounds", 
			fn: (target) => {
				fetch("/api/user/sounds/leave/" + target.innerText, {
					method: "post",
					headers: {
						Session: localStorage.getItem("authId")
					}
				});
			}
		}, {
			name: "Remove from leave sounds", 
			fn: (target) => {
				fetch("/api/user/sounds/leave/" + target.innerText, {
					method: "delete",
					headers: {
						Session: localStorage.getItem("authId")
					}
				});
			}
		}
	]);
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
			console.log(res);
			let contentType = res.headers.get("content-type");
			if(!res.ok){
				alert(await res.text());
			} else if(contentType != null && contentType.indexOf("application/json") !== -1){
				eval(await res.text());
			}
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
			btn.classList.add("soundContextMenu");
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
