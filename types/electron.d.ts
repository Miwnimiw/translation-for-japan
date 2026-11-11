// Type declarations for Electron API exposed via contextBridge (preload.ts)
// This file is auto-loaded by TypeScript when placed in the types/ directory.

interface ElectronAPI {
  /** Copy text to system clipboard */
  copyToClipboard: (text: string) => Promise<boolean>;

  /** Load desktop settings */
  getSettings: () => Promise<{
    shortcut: string;
    startWithWindows: boolean;
    minimizeToTray: boolean;
  }>;

  /** Save desktop settings */
  saveSettings: (settings: {
    shortcut?: string;
    startWithWindows?: boolean;
    minimizeToTray?: boolean;
  }) => Promise<boolean>;

  /** Open URL in default browser */
  openExternal: (url: string) => Promise<void>;

  /** Trigger native screen capture overlay */
  triggerCapture: () => Promise<void>;

  /** Get current platform ("win32" | "darwin" | "linux") */
  getPlatform: () => Promise<string>;

  /**
   * Listen for OCR image ready (sent from screen capture overlay).
   * Returns a cleanup function to remove the listener.
   */
  onOcrImageReady: (callback: (dataURL: string) => void) => () => void;

  /** True when running inside Electron */
  isElectron: true;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

