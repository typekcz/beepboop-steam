window.addEventListener("load", () => {
	listSounds();
	registerAsyncSubmitEvents();
});

function registerAsyncSubmitEvents(){
	for(let form of document.querySelectorAll("form[data-asyncSubmit]")){
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			let form = event.target;
			let data = new FormData(form);
			let headers = {};
			if(form.getAttribute("data-session") != null)
				headers.Session = localStorage.getItem("authId");
			let res = await fetch(form.action, {
				method: form.method,
				body: data,
				headers
			});
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
			btn.addEventListener("click", async (e) => {
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
