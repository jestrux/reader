const { ipcRenderer } = require("electron");

window.addEventListener("open-url", (e) => {
	ipcRenderer.send("open-url", e.detail);
});

window.addEventListener("DOMContentLoaded", () => {
	document.body.classList.add("on-electron");
});
