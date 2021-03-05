let safeToQuit = false;

const data = JSON.parse(
	document.querySelector("meta[name=data-formdata]").content
);

const snackbar = (message) => {
	document.querySelector(".snackbar")?.remove();

	if (!message) return;

	const snackElement = document.createElement("aside");
	snackElement.innerText = message;
	snackElement.classList.add("snackbar");
	document.body.appendChild(snackElement);

	setTimeout(() => snackElement.remove(), 4000);
};

const genId = () => btoa(Math.random().toString()).substring(0, 4);

const mod = (val, div) => ((Math.abs(Math.floor(val / div) * div) + val) % div);

addEventListener("beforeunload", (event) => {
	if (safeToQuit) return;

	event.preventDefault();
	event.returnValue = "Unsaved changes will be lost";
	return "Unsaved changes will be lost";
});

document.getElementById("update-save").addEventListener("click", () => {
	fetch(location.pathname + location.search, {
		method: "PATCH",
		headers: new Headers({
			"Content-Type": "application/json"
		}),
		body: JSON.stringify({
			title: data.meta.title,
			author: data.meta.author,
			sections: data.sections
		})
	}).then((res) => {
		if (res.ok) {
			snackbar("Saved successfully");
		} else {
			snackbar("Something went wrong");
			console.warn("Server response code " + res.status);
		}
	}).catch((err) => {
		snackbar("Something went wrong");
		console.warn("Error whilst saving: " + err);
	});
});

document.getElementById("update-delete").addEventListener("click", () => {
	if (!confirm("This form and its responses will be permanently deleted. Continue?")) return;

	fetch(location.pathname + location.search, {
		method: "DELETE",
	}).then((res) => {
		if (res.ok) {
			snackbar("Deleted successfully; exiting");

			safeToQuit = true;

			setTimeout(() => {
				location.href = "/";
			}, 2000);
		} else {
			snackbar("Something went wrong");
			console.warn("Server response code " + res.status);
		}
	}).catch((err) => {
		snackbar("Something went wrong");
		console.warn("Error whilst deleting: " + err);
	});
});

document.getElementById("settings-formtitle").addEventListener("change", (e) => {
	data.meta.title = e.currentTarget.value;
});
document.getElementById("settings-formauthor").addEventListener("change", (e) => {
	data.meta.author = e.currentTarget.value;
});

const qeditor = new Vue({
	el: "#section-sections",
	data: {
		...data,
		ready: true
	},
	methods: {
		mvS(sNum, dir) {
			const swapPos = mod(sNum + dir, data.sections.length);
			const swapTmp = data.sections[swapPos];
			data.sections[swapPos] = data.sections[sNum];
			data.sections[sNum] = swapTmp;

			this.$forceUpdate();
		},
		delS(sNum) {
			if (!confirm(`Permanently delete section "${ data.sections[sNum].title }" and all of its questions?`)) return;

			data.sections.splice(sNum, 1);
		},
		addS() {
			data.sections.push({
				title: "New section",
				items: []
			});
		},
		mvQ(sNum, qNum, dir) {
			const items = data.sections[sNum].items;
			const swapPos = mod(qNum + dir, items.length);
			const swapTmp = items[swapPos];
			items[swapPos] = items[qNum];
			items[qNum] = swapTmp;

			this.$forceUpdate();
		},
		delQ(sNum, qNum) {
			if (!confirm(`Permanently delete question "${ data.sections[sNum].items[qNum].title }"?`)) return;

			data.sections[sNum].items.splice(qNum, 1);
		},
		addQ(sNum) {
			data.sections[sNum].items.push({
				title: "New question",
				type: "text",
				required: false,
				id: genId(),
				options: []
			});
		},
		mvO(sNum, qNum, oNum, dir) {
			const items = data.sections[sNum].items[qNum].options;
			const swapPos = mod(oNum + dir, items.length);
			const swapTmp = items[swapPos];
			items[swapPos] = items[oNum];
			items[oNum] = swapTmp;

			this.$forceUpdate();
		},
		delO(sNum, qNum, oNum) {
			data.sections[sNum].items[qNum].options.splice(oNum, 1);
		},
		addO(sNum, qNum) {
			data.sections[sNum].items[qNum].options.push("New option");
		}
	}
});
