"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import { AppSettings } from "@/lib/types";
import { getSettings, saveSettings, clearAllData } from "@/lib/storage";

type ApiStatus = "checking" | "connected" | "disconnected";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({ defaultLanguage: "Japanese", theme: "light" });
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
    checkStatus();
  }, []);

  async function checkStatus() {
    setApiStatus("checking");
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setApiStatus(data.connected ? "connected" : "disconnected");
    } catch {
      setApiStatus("disconnected");
    }
  }

  function persist(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  function setLanguage(lang: AppSettings["defaultLanguage"]) {
    persist({ ...settings, defaultLanguage: lang });
  }

  function setTheme(theme: AppSettings["theme"]) {
    persist({ ...settings, theme });
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  function handleClearData() {
    clearAllData();
    setConfirmClear(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  }

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="font-display text-2xl text-ink dark:text-ink-dark">Settings</h1>
      </header>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50 mb-3">
          ภาษาเริ่มต้น
        </h2>
        <div className="flex gap-2">
          {(["Japanese", "English"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`focus-ring text-sm font-medium rounded-full px-4 py-2 border transition-colors ${
                settings.defaultLanguage === lang
                  ? "bg-ai-600 border-ai-600 text-white"
                  : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50 mb-3">Theme</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("light")}
            className={`focus-ring inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-4 py-2 border transition-colors ${
              settings.theme === "light"
                ? "bg-ai-600 border-ai-600 text-white"
                : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
            }`}
          >
            <Sun size={14} /> Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`focus-ring inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-4 py-2 border transition-colors ${
              settings.theme === "dark"
                ? "bg-ai-600 border-ai-600 text-white"
                : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
            }`}
          >
            <Moon size={14} /> Dark
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50 mb-3">
          Gemini API Configuration
        </h2>
        <div className="border border-line dark:border-line-dark rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {apiStatus === "checking" && (
                <>
                  <Loader2 size={15} className="animate-spin text-ink-soft dark:text-ink-dark/50" />
                  <span className="text-ink-soft dark:text-ink-dark/60">กำลังตรวจสอบการเชื่อมต่อ...</span>
                </>
              )}
              {apiStatus === "connected" && (
                <>
                  <Wifi size={15} className="text-ai-600 dark:text-ai-300" />
                  <span className="text-ink dark:text-ink-dark">เชื่อมต่อ Gemini API สำเร็จ</span>
                </>
              )}
              {apiStatus === "disconnected" && (
                <>
                  <WifiOff size={15} className="text-vermilion" />
                  <span className="text-vermilion">ไม่สามารถเชื่อมต่อ Gemini API ได้</span>
                </>
              )}
            </div>
            <button
              onClick={checkStatus}
              className="focus-ring text-xs text-ai-700 dark:text-ai-200 border border-ai-300 dark:border-ai-500 rounded px-3 py-1.5 hover:bg-ai-50 dark:hover:bg-ai-700/20"
            >
              Recheck
            </button>
          </div>
          <p className="text-xs text-ink-soft dark:text-ink-dark/40 mt-3">
            API Key: <code className="font-mono">GEMINI_API_KEY=••••••••••••</code> (ตั้งค่าใน{" "}
            <code className="font-mono">.env.local</code> ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่แสดงค่าจริงในหน้านี้)
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50 mb-3">
          Data
        </h2>
        <div className="border border-vermilion/30 rounded-lg p-4">
          <p className="text-sm text-ink dark:text-ink-dark">ล้างข้อมูลคำศัพท์ ข้อความที่บันทึก และ Flashcards ทั้งหมด</p>
          <p className="text-xs text-ink-soft dark:text-ink-dark/50 mt-1">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="focus-ring mt-3 text-sm font-medium text-vermilion border border-vermilion/40 rounded px-4 py-2 hover:bg-vermilion/10"
            >
              Clear All Data
            </button>
          ) : (
            <div className="mt-3 flex items-center gap-2 bg-vermilion/10 rounded px-3 py-2.5">
              <AlertTriangle size={15} className="text-vermilion shrink-0" />
              <span className="text-sm text-ink dark:text-ink-dark flex-1">ยืนยันการลบข้อมูลทั้งหมด?</span>
              <button
                onClick={handleClearData}
                className="focus-ring text-xs font-medium bg-vermilion text-white rounded px-3 py-1.5 hover:opacity-90"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="focus-ring text-xs text-ink-soft dark:text-ink-dark/60 rounded px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          )}
          {cleared && <p className="mt-2 text-xs text-ai-600 dark:text-ai-300">ล้างข้อมูลเรียบร้อยแล้ว</p>}
        </div>
      </section>
    </div>
  );
}
