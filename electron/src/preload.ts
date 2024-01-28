require("./rt/electron-rt");
//////////////////////////////
// User Defined Preload scripts below
// console.log('User Preload!');

const { ipcRenderer } = require("electron");

window.addEventListener("open-url", (e) => {
    console.log("Open url: ", e);
	ipcRenderer.send("open-url", e.detail);
});

window.addEventListener("DOMContentLoaded", () => {
	document.body.classList.add("on-electron");
});
