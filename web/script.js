window.addEventListener("load", () => {
	for(let form of document.querySelectorAll("form[data-asyncSubmit]")){
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			let form = event.target;
			let data = {};
			for(let input of form){
				if(input.name)
					data[input.name] = input.value;
			}
			let res = await fetch(form.action, {
				method: form.method,
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(data)
			});
			console.log(res);
		});
	}
});
