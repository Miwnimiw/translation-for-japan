"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
// ─── Constants ────────────────────────────────────────────────────────────────
const NEXT_PORT = 3399;
const NEXT_URL = `http://localhost:${NEXT_PORT}`;
const SETTINGS_FILE = path.join(electron_1.app.getPath("userData"), "settings.json");
const ICON_PNG = path.join(__dirname, "icons", "icon.png");
// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let overlayWindow = null;
let tray = null;
let nextProcess = null;
let isQuitting = false;
const DEFAULT_SETTINGS = {
    shortcut: "CommandOrControl+Shift+T",
    startWithWindows: false,
    minimizeToTray: true,
};
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        }
    }
    catch {
        // fall through to defaults
    }
    return { ...DEFAULT_SETTINGS };
}
function saveSettings(settings) {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
}
// ─── Next.js Server ───────────────────────────────────────────────────────────
function startNextServer() {
    return new Promise((resolve, reject) => {
        const nextBin = path.join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
        const env = {
            ...process.env,
            PORT: String(NEXT_PORT),
            NODE_ENV: "production",
        };
        // Load .env.local if present (for GEMINI_API_KEY etc.)
        const envLocalPath = path.join(__dirname, "..", ".env.local");
        if (fs.existsSync(envLocalPath)) {
            const lines = fs.readFileSync(envLocalPath, "utf-8").split("\n");
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                const eqIdx = trimmed.indexOf("=");
                if (eqIdx > 0) {
                    const key = trimmed.substring(0, eqIdx).trim();
                    const val = trimmed.substring(eqIdx + 1).trim();
                    env[key] = val;
                }
            }
        }
        nextProcess = (0, child_process_1.spawn)(nextBin, ["start", "-p", String(NEXT_PORT)], {
            cwd: path.join(__dirname, ".."),
            env,
            stdio: "pipe",
        });
        nextProcess.stdout?.on("data", (d) => {
            const msg = d.toString();
            if (msg.includes("started server") || msg.includes("ready")) {
                resolve();
            }
        });
        nextProcess.stderr?.on("data", () => {
            // ignore stderr noise
        });
        nextProcess.on("error", reject);
        // Poll fallback: wait up to 30s for port to open
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            const req = http.get(NEXT_URL, (res) => {
                if (res.statusCode && res.statusCode < 500) {
                    clearInterval(poll);
                    resolve();
                }
            });
            req.on("error", () => {
                /* still starting */
            });
            if (attempts > 60) {
                clearInterval(poll);
                reject(new Error("Next.js server did not start in time"));
            }
        }, 500);
    });
}
// ─── Main Window ──────────────────────────────────────────────────────────────
function createMainWindow() {
    const settings = loadSettings();
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        title: "Kotoba – JP/EN Translator",
        icon: fs.existsSync(ICON_PNG) ? ICON_PNG : undefined,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "preload.js"),
        },
        show: false,
        backgroundColor: "#0f172a",
    });
    mainWindow.loadURL(NEXT_URL);
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });
    mainWindow.on("close", (e) => {
        if (!isQuitting && settings.minimizeToTray) {
            e.preventDefault();
            mainWindow?.hide();
        }
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// ─── System Tray ──────────────────────────────────────────────────────────────
function createTray() {
    let icon;
    if (fs.existsSync(ICON_PNG)) {
        icon = electron_1.nativeImage.createFromPath(ICON_PNG).resize({ width: 16, height: 16 });
    }
    else {
        // Fallback: tiny empty icon
        icon = electron_1.nativeImage.createEmpty();
    }
    tray = new electron_1.Tray(icon);
    tray.setToolTip("Kotoba Translator");
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "เปิดโปรแกรม",
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
        {
            label: "จับข้อความจากหน้าจอ (Ctrl+Shift+T)",
            click: () => triggerScreenCapture(),
        },
        { type: "separator" },
        {
            label: "ออกจากโปรแกรม",
            click: () => quitApp(),
        },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}
// ─── Global Shortcut ──────────────────────────────────────────────────────────
function registerShortcut() {
    const settings = loadSettings();
    const shortcut = settings.shortcut || DEFAULT_SETTINGS.shortcut;
    electron_1.globalShortcut.unregisterAll();
    const ok = electron_1.globalShortcut.register(shortcut, () => {
        triggerScreenCapture();
    });
    if (!ok) {
        console.warn(`[Kotoba] Could not register shortcut: ${shortcut}`);
    }
}
// ─── Screen Capture Overlay ───────────────────────────────────────────────────
async function triggerScreenCapture() {
    try {
        // Get all screen sources at full resolution
        const displays = electron_1.screen.getAllDisplays();
        const primaryDisplay = electron_1.screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.size;
        const scaleFactor = primaryDisplay.scaleFactor;
        const sources = await electron_1.desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: {
                width: Math.round(width * scaleFactor),
                height: Math.round(height * scaleFactor),
            },
        });
        if (!sources.length)
            return;
        // Use first screen (primary)
        const source = sources[0];
        const imageDataURL = source.thumbnail.toDataURL();
        // Create overlay window
        if (overlayWindow) {
            overlayWindow.close();
            overlayWindow = null;
        }
        // Calculate total bounds across all displays
        const totalBounds = displays.reduce((acc, d) => ({
            x: Math.min(acc.x, d.bounds.x),
            y: Math.min(acc.y, d.bounds.y),
            width: Math.max(acc.width, d.bounds.x + d.bounds.width),
            height: Math.max(acc.height, d.bounds.y + d.bounds.height),
        }), { x: 0, y: 0, width: 0, height: 0 });
        overlayWindow = new electron_1.BrowserWindow({
            x: totalBounds.x,
            y: totalBounds.y,
            width: totalBounds.width,
            height: totalBounds.height,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            movable: false,
            fullscreen: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: path.join(__dirname, "overlay-preload.js"),
            },
        });
        overlayWindow.setAlwaysOnTop(true, "screen-saver");
        overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
        overlayWindow.once("ready-to-show", () => {
            overlayWindow?.show();
            overlayWindow?.focus();
            // Send screenshot to overlay
            overlayWindow?.webContents.send("screenshot-ready", imageDataURL);
        });
        overlayWindow.on("closed", () => {
            overlayWindow = null;
        });
    }
    catch (err) {
        console.error("[Kotoba] Screen capture error:", err);
    }
}
// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIPC() {
    // Overlay → Main: region selected, send cropped image to main window
    electron_1.ipcMain.on("region-selected", (_event, croppedDataURL) => {
        overlayWindow?.close();
        overlayWindow = null;
        // Show main window and send image for OCR
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send("ocr-image-ready", croppedDataURL);
    });
    // Overlay → Main: cancelled
    electron_1.ipcMain.on("overlay-cancel", () => {
        overlayWindow?.close();
        overlayWindow = null;
    });
    // Renderer → Main: copy to clipboard
    electron_1.ipcMain.handle("copy-to-clipboard", (_event, text) => {
        electron_1.clipboard.writeText(text);
        return true;
    });
    // Renderer → Main: get settings
    electron_1.ipcMain.handle("get-settings", () => {
        return loadSettings();
    });
    // Renderer → Main: save settings
    electron_1.ipcMain.handle("save-settings", (_event, settings) => {
        saveSettings(settings);
        // Re-register shortcut if changed
        if (settings.shortcut) {
            registerShortcut();
        }
        // Update startup setting
        if (typeof settings.startWithWindows === "boolean") {
            electron_1.app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
        }
        return true;
    });
    // Renderer → Main: open URL in browser
    electron_1.ipcMain.handle("open-external", (_event, url) => {
        electron_1.shell.openExternal(url);
    });
    // Renderer → Main: trigger screen capture
    electron_1.ipcMain.handle("trigger-capture", () => {
        triggerScreenCapture();
    });
    // Renderer → Main: get platform info
    electron_1.ipcMain.handle("get-platform", () => process.platform);
}
// ─── App Quit ─────────────────────────────────────────────────────────────────
function quitApp() {
    isQuitting = true;
    electron_1.globalShortcut.unregisterAll();
    nextProcess?.kill();
    electron_1.app.quit();
}
// ─── App Lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(async () => {
    console.log("[Kotoba] Starting Next.js server...");
    try {
        await startNextServer();
        console.log("[Kotoba] Next.js server ready.");
    }
    catch (err) {
        console.error("[Kotoba] Failed to start Next.js:", err);
    }
    createMainWindow();
    createTray();
    setupIPC();
    registerShortcut();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
        else {
            mainWindow?.show();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    // Don't quit on Windows when all windows are closed (tray mode)
    if (process.platform !== "darwin" && isQuitting) {
        quitApp();
    }
});
electron_1.app.on("before-quit", () => {
    isQuitting = true;
    nextProcess?.kill();
    electron_1.globalShortcut.unregisterAll();
});
electron_1.app.on("will-quit", () => {
    electron_1.globalShortcut.unregisterAll();
});
//# sourceMappingURL=main.js.map