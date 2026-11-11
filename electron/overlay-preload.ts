import { contextBridge, ipcRenderer } from "electron";

// Overlay preload: exposes minimal API for the selection overlay window
contextBridge.exposeInMainWorld("overlayAPI", {
  /** Send cropped region image back to main process */
  sendRegion: (croppedDataURL: string): void => {
    ipcRenderer.send("region-selected", croppedDataURL);
  },

  /** Cancel overlay */
  cancel: (): void => {
    ipcRenderer.send("overlay-cancel");
  },

  /** Listen for the screenshot to be ready */
  onScreenshotReady: (callback: (dataURL: string) => void): void => {
    ipcRenderer.once(
      "screenshot-ready",
      (_event: Electron.IpcRendererEvent, dataURL: string) => callback(dataURL)
    );
  },
});

