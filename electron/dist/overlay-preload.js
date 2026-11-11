"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Overlay preload: exposes minimal API for the selection overlay window
electron_1.contextBridge.exposeInMainWorld("overlayAPI", {
    /** Send cropped region image back to main process */
    sendRegion: (croppedDataURL) => {
        electron_1.ipcRenderer.send("region-selected", croppedDataURL);
    },
    /** Cancel overlay */
    cancel: () => {
        electron_1.ipcRenderer.send("overlay-cancel");
    },
    /** Listen for the screenshot to be ready */
    onScreenshotReady: (callback) => {
        electron_1.ipcRenderer.once("screenshot-ready", (_event, dataURL) => callback(dataURL));
    },
});
//# sourceMappingURL=overlay-preload.js.map