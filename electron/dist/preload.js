"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ─── Expose safe API to renderer (Next.js pages) ──────────────────────────────
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    /** Copy text to system clipboard */
    copyToClipboard: (text) => electron_1.ipcRenderer.invoke("copy-to-clipboard", text),
    /** Load desktop settings */
    getSettings: () => electron_1.ipcRenderer.invoke("get-settings"),
    /** Save desktop settings */
    saveSettings: (settings) => electron_1.ipcRenderer.invoke("save-settings", settings),
    /** Open URL in default browser */
    openExternal: (url) => electron_1.ipcRenderer.invoke("open-external", url),
    /** Trigger native screen capture overlay */
    triggerCapture: () => electron_1.ipcRenderer.invoke("trigger-capture"),
    /** Get current platform */
    getPlatform: () => electron_1.ipcRenderer.invoke("get-platform"),
    /** Listen for OCR image ready (sent from screen capture overlay) */
    onOcrImageReady: (callback) => {
        const handler = (_event, dataURL) => callback(dataURL);
        electron_1.ipcRenderer.on("ocr-image-ready", handler);
        // Return cleanup function
        return () => electron_1.ipcRenderer.removeListener("ocr-image-ready", handler);
    },
    /**
     * Ask the main process to navigate the renderer to a route.
     * The renderer layout listens for the reply via onNavigateTo.
     */
    navigateTo: (routePath) => electron_1.ipcRenderer.invoke("navigate-to", routePath),
    /**
     * Listen for navigation requests pushed from the main process.
     * Returns a cleanup function.
     */
    onNavigateTo: (callback) => {
        const handler = (_event, routePath) => callback(routePath);
        electron_1.ipcRenderer.on("navigate-to", handler);
        return () => electron_1.ipcRenderer.removeListener("navigate-to", handler);
    },
    /** Check if running inside Electron */
    isElectron: true,
});
//# sourceMappingURL=preload.js.map