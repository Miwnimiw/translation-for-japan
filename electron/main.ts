import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  clipboard,
  screen,
  desktopCapturer,
  shell,
} from "electron";
import * as path from "path";
import * as http from "http";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";

// ─── Constants ────────────────────────────────────────────────────────────────
const NEXT_PORT = 3399;
const NEXT_URL = `http://localhost:${NEXT_PORT}`;
const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");
const ICON_PNG = path.join(__dirname, "icons", "icon.png");

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nextProcess: ChildProcess | null = null;
let isQuitting = false;

// ─── Settings ─────────────────────────────────────────────────────────────────
interface AppSettings {
  shortcut: string;
  startWithWindows: boolean;
  minimizeToTray: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  shortcut: "CommandOrControl+Shift+T",
  startWithWindows: false,
  minimizeToTray: true,
};

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: Partial<AppSettings>): void {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
}

// ─── Next.js Server ───────────────────────────────────────────────────────────
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const nextBin = path.join(
      __dirname,
      "..",
      "node_modules",
      ".bin",
      process.platform === "win32" ? "next.cmd" : "next"
    );

    const env: NodeJS.ProcessEnv = {
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
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          env[key] = val;
        }
      }
    }

    nextProcess = spawn(nextBin, ["start", "-p", String(NEXT_PORT)], {
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
function createMainWindow(): void {
  const settings = loadSettings();

  mainWindow = new BrowserWindow({
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
function createTray(): void {
  let icon: Electron.NativeImage;
  if (fs.existsSync(ICON_PNG)) {
    icon = nativeImage.createFromPath(ICON_PNG).resize({ width: 16, height: 16 });
  } else {
    // Fallback: tiny empty icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Kotoba Translator");

  const contextMenu = Menu.buildFromTemplate([
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
function registerShortcut(): void {
  const settings = loadSettings();
  const shortcut = settings.shortcut || DEFAULT_SETTINGS.shortcut;

  globalShortcut.unregisterAll();

  const ok = globalShortcut.register(shortcut, () => {
    triggerScreenCapture();
  });

  if (!ok) {
    console.warn(`[Kotoba] Could not register shortcut: ${shortcut}`);
  }
}

// ─── Screen Capture Overlay ───────────────────────────────────────────────────
async function triggerScreenCapture(): Promise<void> {
  try {
    // Get all screen sources at full resolution
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor),
      },
    });

    if (!sources.length) return;

    // Use first screen (primary)
    const source = sources[0];
    const imageDataURL = source.thumbnail.toDataURL();

    // Create overlay window
    if (overlayWindow) {
      overlayWindow.close();
      overlayWindow = null;
    }

    // Calculate total bounds across all displays
    const totalBounds = displays.reduce(
      (acc, d) => ({
        x: Math.min(acc.x, d.bounds.x),
        y: Math.min(acc.y, d.bounds.y),
        width: Math.max(acc.width, d.bounds.x + d.bounds.width),
        height: Math.max(acc.height, d.bounds.y + d.bounds.height),
      }),
      { x: 0, y: 0, width: 0, height: 0 }
    );

    overlayWindow = new BrowserWindow({
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
  } catch (err) {
    console.error("[Kotoba] Screen capture error:", err);
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIPC(): void {
  // Overlay → Main: region selected, send cropped image to main window
  ipcMain.on("region-selected", (_event, croppedDataURL: string) => {
    overlayWindow?.close();
    overlayWindow = null;

    // Show main window and send image for OCR
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("ocr-image-ready", croppedDataURL);
  });

  // Overlay → Main: cancelled
  ipcMain.on("overlay-cancel", () => {
    overlayWindow?.close();
    overlayWindow = null;
  });

  // Renderer → Main: copy to clipboard
  ipcMain.handle("copy-to-clipboard", (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  // Renderer → Main: get settings
  ipcMain.handle("get-settings", () => {
    return loadSettings();
  });

  // Renderer → Main: save settings
  ipcMain.handle("save-settings", (_event, settings: Partial<AppSettings>) => {
    saveSettings(settings);
    // Re-register shortcut if changed
    if (settings.shortcut) {
      registerShortcut();
    }
    // Update startup setting
    if (typeof settings.startWithWindows === "boolean") {
      app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
    }
    return true;
  });

  // Renderer → Main: open URL in browser
  ipcMain.handle("open-external", (_event, url: string) => {
    shell.openExternal(url);
  });

  // Renderer → Main: trigger screen capture
  ipcMain.handle("trigger-capture", () => {
    triggerScreenCapture();
  });

  // Renderer → Main: get platform info
  ipcMain.handle("get-platform", () => process.platform);
}

// ─── App Quit ─────────────────────────────────────────────────────────────────
function quitApp(): void {
  isQuitting = true;
  globalShortcut.unregisterAll();
  nextProcess?.kill();
  app.quit();
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log("[Kotoba] Starting Next.js server...");
  try {
    await startNextServer();
    console.log("[Kotoba] Next.js server ready.");
  } catch (err) {
    console.error("[Kotoba] Failed to start Next.js:", err);
  }

  createMainWindow();
  createTray();
  setupIPC();
  registerShortcut();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("window-all-closed", () => {
  // Don't quit on Windows when all windows are closed (tray mode)
  if (process.platform !== "darwin" && isQuitting) {
    quitApp();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  nextProcess?.kill();
  globalShortcut.unregisterAll();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

