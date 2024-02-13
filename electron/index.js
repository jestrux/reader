const path = require("path");
const { menubar } = require("menubar");
const { ipcMain, shell } = require("electron");

const mb = menubar({
	icon: path.join(__dirname, "icon.png"),
	dir: path.join(__dirname, "build"),
	browserWindow: {
		width: 480,
		height: 600,
		backgroundColor: "#000000",
		webPreferences: {
			// nodeIntegration: true,
			preload: path.join(__dirname, "preload.js"),
		},
	},
	preloadWindow: true,
});

mb.on("ready", () => {
	console.log("app is ready");
});

ipcMain.on("open-url", (event, url) => {
	shell.openExternal(url);
});
