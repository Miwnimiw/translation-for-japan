import { contextBridge, ipcRenderer } from "electron";

// ─── Expose safe API to renderer (Next.js pages) ──────────────────────────────
contextBridge.exposeInMainWorld("electronAPI", {
  /** Copy text to system clipboard */
  copyToClipboard: (text: string): Promise<boolean> =>
    ipcRenderer.invoke("copy-to-clipboard", text),

  /** Load desktop settings */
  getSettings: (): Promise<{
    shortcut: string;
    startWithWindows: boolean;
    minimizeToTray: boolean;
  }> => ipcRenderer.invoke("get-settings"),

  /** Save desktop settings */
  saveSettings: (settings: {
    shortcut?: string;
    startWithWindows?: boolean;
    minimizeToTray?: boolean;
  }): Promise<boolean> => ipcRenderer.invoke("save-settings", settings),

  /** Open URL in default browser */
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("open-external", url),

  /** Trigger native screen capture overlay */
  triggerCapture: (): Promise<void> =>
    ipcRenderer.invoke("trigger-capture"),

  /** Get current platform */
  getPlatform: (): Promise<string> =>
    ipcRenderer.invoke("get-platform"),

  /** Listen for OCR image ready (sent from screen capture overlay) */
  onOcrImageReady: (
    callback: (dataURL: string) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dataURL: string) =>
      callback(dataURL);
    ipcRenderer.on("ocr-image-ready", handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener("ocr-image-ready", handler);
  },

  /**
   * Ask the main process to navigate the renderer to a route.
   * The renderer layout listens for the reply via onNavigateTo.
   */
  navigateTo: (routePath: string): Promise<void> =>
    ipcRenderer.invoke("navigate-to", routePath),

  /**
   * Listen for navigation requests pushed from the main process.
   * Returns a cleanup function.
   */
  onNavigateTo: (callback: (routePath: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, routePath: string) =>
      callback(routePath);
    ipcRenderer.on("navigate-to", handler);
    return () => ipcRenderer.removeListener("navigate-to", handler);
  },

  /** Check if running inside Electron */
  isElectron: true as const,
});

