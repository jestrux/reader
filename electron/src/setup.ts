import type { CapacitorElectronConfig } from "@capacitor-community/electron";
import {
	CapElectronEventEmitter,
	setupCapacitorElectronPlugins,
} from "@capacitor-community/electron";
import chokidar from "chokidar";
import { app, BrowserWindow, nativeImage } from "electron";
import electronIsDev from "electron-is-dev";
import electronServe from "electron-serve";
import windowStateKeeper from "electron-window-state";
import { join } from "path";
import TrayGenerator from "./TrayGenerator";

// Define components for a watcher to detect when the webapp is changed so we can reload in Dev mode.
const reloadWatcher = {
	debouncer: null,
	ready: false,
	watcher: null,
};

export function setupReloadWatcher(
	electronCapacitorApp: ElectronCapacitorApp
): void {
	reloadWatcher.watcher = chokidar
		.watch(join(app.getAppPath(), "app"), {
			ignored: /[/\\]\./,
			persistent: true,
		})
		.on("ready", () => {
			reloadWatcher.ready = true;
		})
		.on("all", (_event, _path) => {
			if (reloadWatcher.ready) {
				clearTimeout(reloadWatcher.debouncer);
				reloadWatcher.debouncer = setTimeout(async () => {
					electronCapacitorApp.getMainWindow().webContents.reload();
					reloadWatcher.ready = false;
					clearTimeout(reloadWatcher.debouncer);
					reloadWatcher.debouncer = null;
					reloadWatcher.watcher = null;
					setupReloadWatcher(electronCapacitorApp);
				}, 1500);
			}
		});
}

// Define our class to manage our app.
export class ElectronCapacitorApp {
	private MainWindow: BrowserWindow | null = null;
	private CapacitorFileConfig: CapacitorElectronConfig;
	private mainWindowState;
	private loadWebApp;
	private customScheme: string;

	constructor(capacitorFileConfig: CapacitorElectronConfig) {
		this.CapacitorFileConfig = capacitorFileConfig;

		this.customScheme =
			this.CapacitorFileConfig.electron?.customUrlScheme ??
			"capacitor-electron";

		// Setup our web app loader, this lets us load apps like react, vue, and angular without changing their build chains.
		this.loadWebApp = electronServe({
			directory: join(app.getAppPath(), "app"),
			scheme: this.customScheme,
		});
	}

	// Helper function to load in the app.
	private async loadMainWindow(thisRef: any) {
		await thisRef.loadWebApp(thisRef.MainWindow);
    const Tray = new TrayGenerator(thisRef.MainWindow);
		Tray.createTray();
	}

	// Expose the mainWindow ref for use outside of the class.
	getMainWindow(): BrowserWindow {
		return this.MainWindow;
	}

	async init(): Promise<void> {
		const icon = nativeImage.createFromPath(
			join(
				app.getAppPath(),
				"assets",
				process.platform === "win32" ? "appIcon.ico" : "appIcon.png"
			)
		);
		this.mainWindowState = windowStateKeeper({
			defaultWidth: 480,
			defaultHeight: 600,
		});
		// Setup preload script path and construct our main window.
		const preloadPath = join(
			app.getAppPath(),
			"build",
			"src",
			"preload.js"
		);

		this.MainWindow = new BrowserWindow({
			icon,
			show: true,
			frame: false,
			fullscreenable: false,
			resizable: false,
			x: this.mainWindowState.x,
			y: this.mainWindowState.y,
			width: 480,
			height: 600,
			// width: this.mainWindowState.width,
			// height: this.mainWindowState.height,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: true,
				preload: preloadPath,
			},
		});

		this.mainWindowState.manage(this.MainWindow);

		this.loadMainWindow(this);

		// Link electron plugins into the system.
		setupCapacitorElectronPlugins();

		// When the web app is loaded we hide the splashscreen if needed and show the mainwindow.
		this.MainWindow.webContents.on("dom-ready", () => {
			setTimeout(() => {
				if (electronIsDev) {
					// this.MainWindow.webContents.openDevTools();
				}

				CapElectronEventEmitter.emit(
					"CAPELECTRON_DeeplinkListenerInitialized",
					""
				);
			}, 400);
		});
	}
}
