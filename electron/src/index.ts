import type { CapacitorElectronConfig } from "@capacitor-community/electron";
import {
	getCapacitorElectronConfig,
	setupElectronDeepLinking,
} from "@capacitor-community/electron";
import { app, ipcMain, shell } from "electron";
import electronIsDev from "electron-is-dev";
import unhandled from "electron-unhandled";
import { autoUpdater } from "electron-updater";

import { ElectronCapacitorApp, setupReloadWatcher } from "./setup";

// Graceful handling of unhandled errors.
// unhandled();

const capacitorFileConfig: CapacitorElectronConfig =
	getCapacitorElectronConfig();

const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
	setupElectronDeepLinking(myCapacitorApp, {
		customProtocol:
			capacitorFileConfig.electron.deepLinkingCustomProtocol ??
			"mycapacitorapp",
	});
}

if (electronIsDev) setupReloadWatcher(myCapacitorApp);

// Run Application
(async () => {
	await app.whenReady();
	await myCapacitorApp.init();
	autoUpdater.checkForUpdatesAndNotify();

	if (app.dock) app.dock.hide();
})();

app.on("window-all-closed", function () {
	if (process.platform !== "darwin") app.quit();
});

// When the dock icon is clicked.
app.on("activate", async function () {
	if (myCapacitorApp.getMainWindow().isDestroyed())
		await myCapacitorApp.init();
});

ipcMain.on("open-url", (event, url) => {
	shell.openExternal(url);
});
