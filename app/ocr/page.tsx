"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Upload,
  Copy,
  Check,
  ScanText,
  FileText,
  X,
  Camera,
  Layers,
  Sparkles,
  ArrowRight,
  Monitor,
} from "lucide-react";
import ScreenRegionSelector from "@/components/ScreenRegionSelector";
import OcrResultModal from "@/components/OcrResultModal";
import ResultCard from "@/components/ResultCard";
import { TranslationResult, VocabularyEntry, FlashcardEntry, SavedTextEntry } from "@/lib/types";
import { addFlashcard, saveSavedText, saveVocabulary } from "@/lib/storage";
import { generateId } from "@/lib/id";
import { TranslationData } from "@/lib/schemas";

type Mode = "screen" | "upload" | "extractor";

export default function OcrPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("screen");

  // Extracted / typed text
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  // Screen capture & Region Selection states
  const [screenCanvas, setScreenCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Modal popup for OCR result
  const [modalText, setModalText] = useState<string | null>(null);

  // Upload Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direct Translation on this page (if user chooses to translate here)
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translationData, setTranslationData] = useState<TranslationData | null>(null);
  const [vocabResult, setVocabResult] = useState<TranslationResult | null>(null);
  const [savedCard, setSavedCard] = useState(false);
  const [savedTextSuccess, setSavedTextSuccess] = useState(false);

  // Detect Electron environment (client-side only)
  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;

  // -------------------------------------------------------------
  // 1. Screen Capture API Implementation
  // -------------------------------------------------------------

  const startScreenCapture = useCallback(async () => {
    if (isCapturingScreen || isOcrLoading || screenCanvas) return;

    // ── Electron path: use native desktopCapturer overlay ────────
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      setOcrError(null);
      await window.electronAPI.triggerCapture();
      // The overlay will crop the region and fire ocr-image-ready IPC
      // which is handled in the useEffect below.
      return;
    }

    // ── Browser path: getDisplayMedia ────────────────────────────
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setOcrError("เบราว์เซอร์นี้ไม่รองรับ Screen Capture API กรุณาใช้การอัปโหลดรูปภาพแทน");
      return;
    }

    setOcrError(null);
    setIsCapturingScreen(true);

    let stream: MediaStream | null = null;
    try {
      // Prompt screen sharing picker
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: false,
      });

      // Capture single video frame onto an offscreen canvas
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = async () => {
          try {
            await video.play();
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        video.onerror = () => reject(new Error("ไม่สามารถเปิดสตรีมหน้าจอได้"));
      });

      // Brief delay to ensure a crisp frame is rendered
      await new Promise((r) => setTimeout(r, 120));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ไม่สามารถสร้าง Canvas Context ได้");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Stop all tracks immediately so sharing indicator disappears
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;

      // Open selection overlay
      setScreenCanvas(canvas);
    } catch (err) {
      // User cancelled picker dialog or permission denied
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        // Soft cancel, no scary error
      } else {
        const msg = err instanceof Error ? err.message : "ไม่สามารถจับภาพหน้าจอได้";
        setOcrError(msg);
      }
    } finally {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsCapturingScreen(false);
    }
  }, [isCapturingScreen, isOcrLoading, screenCanvas]);

  // -------------------------------------------------------------
  // 1b. Electron IPC listener: ocr-image-ready
  //     Fires when the native overlay sends a cropped dataURL.
  // -------------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.onOcrImageReady) return;

    const cleanup = window.electronAPI.onOcrImageReady(async (dataURL: string) => {
      setIsOcrLoading(true);
      setOcrError(null);

      try {
        // Convert dataURL → Blob → FormData → /api/ocr
        const res = await fetch(dataURL);
        const blob = await res.blob();

        const formData = new FormData();
        formData.append("image", blob, "electron-screen-capture.png");

        const ocrRes = await fetch("/api/ocr", { method: "POST", body: formData });
        const data = await ocrRes.json();

        if (!ocrRes.ok) {
          throw new Error(data.error?.message || data.error || "อ่านข้อความไม่สำเร็จ");
        }

        const extracted = String(data.text || "").trim();
        if (!extracted) {
          throw new Error("ไม่พบข้อความที่อ่านได้ในพื้นที่ที่เลือก กรุณาลองเลือกพื้นที่ใหม่");
        }

        setText(extracted);
        setModalText(extracted);
      } catch (err) {
        setOcrError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอ่านข้อความ");
      } finally {
        setIsOcrLoading(false);
      }
    });

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------
  // 2. Keyboard Shortcut Listener (Ctrl + Shift + E)
  // -------------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        startScreenCapture();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startScreenCapture]);

  // -------------------------------------------------------------
  // 3. OCR Processing with Cropped Region
  // -------------------------------------------------------------

  async function handleRegionSelected(croppedCanvas: HTMLCanvasElement) {
    // Close overlay
    setScreenCanvas(null);
    setIsOcrLoading(true);
    setOcrError(null);

    try {
      // Convert canvas to PNG blob
      const blob = await new Promise<Blob | null>((resolve) =>
        croppedCanvas.toBlob((b) => resolve(b), "image/png")
      );

      if (!blob) throw new Error("ไม่สามารถแปลงภาพสำหรับ OCR ได้");

      const formData = new FormData();
      formData.append("image", blob, "cropped-screen-region.png");

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "อ่านข้อความไม่สำเร็จ");
      }

      const extracted = String(data.text || "").trim();
      if (!extracted) {
        throw new Error("ไม่พบข้อความที่อ่านได้ในพื้นที่ที่เลือก กรุณาลองเลือกพื้นที่ใหม่");
      }

      // Update textarea and open result modal
      setText(extracted);
      setModalText(extracted);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอ่านข้อความ");
    } finally {
      setIsOcrLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 4. Modal Result Actions
  // -------------------------------------------------------------

  function handleModalConfirm(finalText: string) {
    setModalText(null);
    setText(finalText);

    // Save to sessionStorage and navigate to Translation page
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("kotoba.pendingTranslateText", finalText);
    }
    router.push("/translation");
  }

  function handleModalCaptureAgain() {
    setModalText(null);
    startScreenCapture();
  }

  function handleModalCancel() {
    setModalText(null);
  }

  // -------------------------------------------------------------
  // 5. Image File Upload Handlers (Phase 3 requirements)
  // -------------------------------------------------------------

  function handleFileSelect(file: File) {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setOcrError("รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP เท่านั้น");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setOcrError("ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 8MB)");
      return;
    }

    setOcrError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleExtractFromUploadedImage() {
    if (!imageFile) return;
    setIsOcrLoading(true);
    setOcrError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "อ่านข้อความจากรูปภาพไม่สำเร็จ");
      }
      const extracted = String(data.text || "").trim();
      setText(extracted);
      setModalText(extracted);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
    } finally {
      setIsOcrLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 6. Direct Translation on OCR Page
  // -------------------------------------------------------------

  async function runDirectTranslate(forcedLang: "Japanese" | "English" | "auto" = "auto") {
    const trimmed = text.trim();
    if (!trimmed) {
      setTranslateError("ไม่มีข้อความให้แปล กรุณาพิมพ์หรืออ่านข้อความจากภาพก่อน");
      return;
    }

    setTranslating(true);
    setTranslateError(null);
    setTranslationData(null);
    setVocabResult(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          sourceLanguage: forcedLang,
          targetLanguage: "Thai",
          task: "translation",
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message || "แปลข้อความไม่สำเร็จ");
      }

      setTranslationData(body.data as TranslationData);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการแปล");
    } finally {
      setTranslating(false);
    }
  }

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function handleSaveText() {
    if (!translationData) return;
    const entry: SavedTextEntry = {
      id: generateId("text"),
      originalText: translationData.originalText,
      translatedSummary: translationData.translatedText,
      result: vocabResult || {
        sourceLanguage: translationData.sourceLanguage,
        word: translationData.originalText,
        reading: null,
        meaning: [translationData.translatedText],
        explanation: "",
        examples: [],
        relatedWords: [],
      },
      sourceLanguage: translationData.sourceLanguage,
      createdAt: new Date().toISOString(),
    };
    saveSavedText(entry);
    setSavedTextSuccess(true);
    setTimeout(() => setSavedTextSuccess(false), 2000);
  }

  function handleAddFlashcard() {
    if (!translationData) return;
    const vocabId = generateId("vocab");
    saveVocabulary({
      id: vocabId,
      sourceLanguage: translationData.sourceLanguage,
      word: translationData.originalText,
      reading: null,
      meaning: [translationData.translatedText],
      explanation: "",
      examples: [],
      relatedWords: [],
      createdAt: new Date().toISOString(),
    });
    addFlashcard({
      id: generateId("card"),
      vocabularyId: vocabId,
      word: translationData.originalText,
      reading: null,
      meaning: [translationData.translatedText],
      explanation: "",
      examples: [],
      language: translationData.sourceLanguage,
      createdAt: new Date().toISOString(),
      reviewStatus: "new",
    });
    setSavedCard(true);
    setTimeout(() => setSavedCard(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink dark:text-ink-dark">Text Extractor / OCR</h1>
        <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-1">
          จับข้อความจากพื้นที่บนหน้าจอ (Screen Region Capture) หรืออัปโหลดรูปภาพ ก่อนส่งไปแปลภาษา
        </p>
      </header>

      {/* Prominent Screen Capture Action Banner */}
      <div className="mb-6 p-5 rounded-xl border-2 border-ai-300 dark:border-ai-500 bg-gradient-to-r from-ai-50 via-paper to-sky-50 dark:from-ai-700/20 dark:via-paper-dark dark:to-sky-950/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ai-600 text-white">
              <Camera size={12} /> PowerToys Style
            </span>
            <span className="text-xs text-ink-soft dark:text-ink-dark/60">
              ลากครอบข้อความจากพื้นที่ใดก็ได้บนหน้าจอ
            </span>
          </div>
          <h2 className="text-lg font-display font-medium text-ink dark:text-ink-dark mt-1">
            Capture Screen Text
          </h2>
          <p className="text-xs text-ink-soft dark:text-ink-dark/50 mt-0.5">
            {isElectron
              ? "กดปุ่มนี้หรือกด Ctrl+Shift+E จากแอปใดก็ได้ เพื่อเปิด Overlay จับข้อความ"
              : <>
                  กดปุ่มนี้หรือกดคีย์ลัด{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-paper dark:bg-paper-dark border border-line dark:border-line-dark font-mono text-[11px] text-ink dark:text-ink-dark">
                    Ctrl + Shift + E
                  </kbd>{" "}
                  เพื่อเริ่มจับภาพพื้นที่หน้าจอ
                </>
            }
          </p>
        </div>

        <button
          onClick={startScreenCapture}
          disabled={isCapturingScreen || isOcrLoading}
          className="focus-ring whitespace-nowrap inline-flex items-center gap-2 bg-ai-600 hover:bg-ai-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-3 shadow transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isCapturingScreen ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Camera size={16} />
          )}
          <span>Capture Screen Text</span>
          <span className="hidden sm:inline-block text-[11px] opacity-75 bg-white/20 px-1.5 py-0.5 rounded ml-0.5 font-mono">
            Ctrl+Shift+E
          </span>
        </button>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setMode("screen")}
          className={`focus-ring inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-full px-4 py-1.5 border transition-colors ${
            mode === "screen"
              ? "bg-ai-600 border-ai-600 text-white"
              : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
          }`}
        >
          <Monitor size={14} /> Screen Region Capture
        </button>
        <button
          onClick={() => setMode("upload")}
          className={`focus-ring inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-full px-4 py-1.5 border transition-colors ${
            mode === "upload"
              ? "bg-ai-600 border-ai-600 text-white"
              : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
          }`}
        >
          <Upload size={14} /> Upload Image (JPG/PNG)
        </button>
        <button
          onClick={() => setMode("extractor")}
          className={`focus-ring inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-full px-4 py-1.5 border transition-colors ${
            mode === "extractor"
              ? "bg-ai-600 border-ai-600 text-white"
              : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
          }`}
        >
          <FileText size={14} /> Manual Text Extractor
        </button>
      </div>

      {/* Mode 1: Screen Capture Guide */}
      {mode === "screen" && (
        <div className="border border-line dark:border-line-dark rounded-xl p-5 mb-5 bg-paper dark:bg-paper-dark">
          <h3 className="text-sm font-medium text-ink dark:text-ink-dark mb-2 flex items-center gap-2">
            <ScanText size={16} className="text-ai-600 dark:text-ai-300" />
            วิธีใช้งาน Screen Region Capture
          </h3>
          {isElectron ? (
            <ol className="text-xs text-ink-soft dark:text-ink-dark/70 space-y-2 list-decimal list-inside leading-relaxed">
              <li>เปิดแอปหรือเว็บไซต์ที่มีข้อความที่ต้องการ</li>
              <li>
                กดคีย์ลัด{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-ink/5 dark:bg-white/5 border border-line dark:border-line-dark font-mono">
                  Ctrl + Shift + E
                </kbd>{" "}
                จากที่ใดก็ได้ หรือคลิกปุ่ม <strong>&quot;Capture Screen Text&quot;</strong>
              </li>
              <li>
                หน้าจอจะมืดลง ให้<strong>คลิกเมาส์ค้างแล้วลากครอบข้อความ</strong>ที่ต้องการ
              </li>
              <li>
                กดปุ่ม <strong>Capture Text</strong> หรือกด{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-ink/5 dark:bg-white/5 border border-line dark:border-line-dark font-mono">
                  Enter
                </kbd>{" "}
                เพื่ออ่านข้อความด้วย Gemini OCR
              </li>
              <li>ตรวจสอบและแก้ไขข้อความในหน้าต่างผลลัพธ์ แล้วกดยืนยันเพื่อนำไปแปลภาษา</li>
            </ol>
          ) : (
            <ol className="text-xs text-ink-soft dark:text-ink-dark/70 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                คลิกปุ่ม <strong>&quot;Capture Screen Text&quot;</strong> ด้านบน หรือกดคีย์ลัด{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-ink/5 dark:bg-white/5 border border-line dark:border-line-dark font-mono">
                  Ctrl + Shift + E
                </kbd>
              </li>
              <li>เลือกหน้าจอ, หน้าต่างโปรแกรม หรือแท็บที่ต้องการจับภาพ</li>
              <li>
                เมื่อหน้าจอขึ้นกรอบสีดำ ให้<strong>คลิกเมาส์ค้างแล้วลากครอบข้อความ</strong>ภาษาญี่ปุ่นหรืออังกฤษ
              </li>
              <li>
                กดปุ่ม <strong>Capture Text</strong> หรือกด{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-ink/5 dark:bg-white/5 border border-line dark:border-line-dark font-mono">
                  Enter
                </kbd>{" "}
                เพื่ออ่านข้อความด้วย Gemini OCR
              </li>
              <li>ตรวจสอบและแก้ไขข้อความในหน้าต่างผลลัพธ์ แล้วกดยืนยันเพื่อนำไปแปลภาษา</li>
            </ol>
          )}
        </div>
      )}

      {/* Mode 2: File Upload Box */}
      {mode === "upload" && (
        <div className="border border-line dark:border-line-dark rounded-xl p-5 mb-5 bg-paper dark:bg-paper-dark">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          {!imagePreview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelect(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer w-full flex flex-col items-center justify-center gap-2.5 border-2 border-dashed rounded-xl py-10 transition-colors ${
                isDragOver
                  ? "border-ai-500 bg-ai-50/50 dark:bg-ai-700/20 text-ai-600"
                  : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300 hover:text-ai-600"
              }`}
            >
              <Upload size={24} />
              <div className="text-center">
                <span className="text-sm font-medium">
                  คลิกเพื่อเลือกรูปภาพ หรือลากไฟล์มาวางที่นี่
                </span>
                <p className="text-xs text-ink-soft/70 dark:text-ink-dark/40 mt-1">
                  รองรับไฟล์ JPG, JPEG, PNG และ WEBP (ขนาดไม่เกิน 8MB)
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="ตัวอย่างรูปภาพที่อัปโหลด"
                  className="max-h-72 rounded-lg border border-line dark:border-line-dark object-contain"
                />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  aria-label="ลบรูปภาพ"
                  className="focus-ring absolute -top-2 -right-2 bg-paper dark:bg-paper-dark border border-line dark:border-line-dark rounded-full p-1 text-ink-soft hover:text-vermilion shadow"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleExtractFromUploadedImage}
                  disabled={isOcrLoading}
                  className="focus-ring inline-flex items-center gap-1.5 bg-ai-600 hover:bg-ai-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors cursor-pointer"
                >
                  {isOcrLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <ScanText size={15} />
                  )}
                  Extract Text from Image
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="focus-ring text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark px-3 py-2 rounded-lg border border-line dark:border-line-dark"
                >
                  เลือกภาพใหม่
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Animation during OCR */}
      {isOcrLoading && (
        <div className="mb-5 p-4 rounded-xl border border-ai-200 dark:border-ai-700 bg-ai-50 dark:bg-ai-700/20 flex items-center gap-3 text-ai-700 dark:text-ai-200 text-sm animate-pulse">
          <Loader2 size={18} className="animate-spin text-ai-600 dark:text-ai-300" />
          <span>กำลังอ่านข้อความจากพื้นที่ที่เลือก...</span>
        </div>
      )}

      {/* Error Banner */}
      {ocrError && (
        <div className="mb-5 p-4 rounded-xl border border-vermilion/30 bg-vermilion/10 text-vermilion text-sm flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">เกิดข้อผิดพลาดในการอ่านข้อความ</p>
            <p className="text-xs mt-0.5">{ocrError}</p>
          </div>
          <button onClick={() => setOcrError(null)} className="p-1 hover:opacity-80">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Textarea: Review & Edit Extracted Text */}
      <div className="border border-line dark:border-line-dark rounded-xl bg-paper dark:bg-paper-dark overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-line dark:border-line-dark flex items-center justify-between text-xs text-ink-soft dark:text-ink-dark/60">
          <span>ข้อความที่ได้จาก Text Extractor / OCR (สามารถพิมพ์หรือแก้ไขได้ที่นี่)</span>
          <span>{text.length} ตัวอักษร</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ข้อความที่อ่านได้จากหน้าจอหรือรูปภาพจะปรากฏที่นี่... หรือพิมพ์/วางข้อความเพื่อนำไปแปลภาษา"
          rows={7}
          className="focus-ring w-full resize-y bg-transparent px-4 py-3 text-[15px] text-ink dark:text-ink-dark placeholder:text-ink-soft/50 dark:placeholder:text-ink-dark/30 leading-relaxed font-sans"
        />

        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-line dark:border-line-dark bg-ai-50/30 dark:bg-ai-700/5">
          <button
            onClick={() => runDirectTranslate("Japanese")}
            disabled={translating || !text.trim()}
            className="focus-ring inline-flex items-center gap-1.5 bg-ai-600 hover:bg-ai-700 text-white text-xs sm:text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {translating ? <Loader2 size={14} className="animate-spin" /> : <LanguagesIcon />}
            Translation for Japan
          </button>

          <button
            onClick={() => runDirectTranslate("English")}
            disabled={translating || !text.trim()}
            className="focus-ring inline-flex items-center gap-1.5 text-xs sm:text-sm text-ai-700 dark:text-ai-200 border border-ai-300 dark:border-ai-500 rounded-lg px-3.5 py-2 hover:bg-ai-50 dark:hover:bg-ai-700/20 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {translating ? <Loader2 size={14} className="animate-spin" /> : <LanguagesIcon />}
            Translation for English
          </button>

          <div className="flex-1" />

          <button
            onClick={handleCopy}
            disabled={!text}
            className="focus-ring inline-flex items-center gap-1.5 text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark px-2.5 py-2 rounded-lg border border-line dark:border-line-dark disabled:opacity-40"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            Copy Text
          </button>

          <button
            onClick={() => {
              setText("");
              setTranslationData(null);
              setVocabResult(null);
            }}
            disabled={!text}
            className="focus-ring text-xs text-ink-soft dark:text-ink-dark/60 hover:text-vermilion px-2.5 py-2 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Translation Error Banner */}
      {translateError && (
        <div className="mt-4 p-4 rounded-xl border border-vermilion/30 bg-vermilion/10 text-vermilion text-sm">
          {translateError}
        </div>
      )}

      {/* Translation Result Card (if user translates here) */}
      {translationData && (
        <div className="mt-6 border border-line dark:border-line-dark rounded-xl bg-paper dark:bg-paper-dark overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line dark:border-line-dark bg-ai-50/50 dark:bg-ai-700/10">
            <span className="text-xs uppercase tracking-wide font-medium text-ai-700 dark:text-ai-300">
              {translationData.sourceLanguage} → {translationData.targetLanguage}
            </span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(translationData.translatedText);
              }}
              className="focus-ring text-xs text-ink-soft hover:text-ai-600 rounded px-2 py-1"
            >
              Copy Translation
            </button>
          </div>
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs text-ink-soft dark:text-ink-dark/50 mb-1">คำแปลภาษาไทย:</p>
              <p className="text-xl sm:text-2xl text-ink dark:text-ink-dark font-medium leading-relaxed">
                {translationData.translatedText}
              </p>
            </div>
            <div className="pt-3 border-t border-line dark:border-line-dark flex flex-wrap gap-2">
              <button
                onClick={handleSaveText}
                className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-ai-300 dark:border-ai-500 text-ai-700 dark:text-ai-100 px-3.5 py-2 hover:bg-ai-50 dark:hover:bg-ai-700/20"
              >
                {savedTextSuccess ? "บันทึกแล้ว ✓" : "บันทึกข้อความ (Save Text)"}
              </button>
              <button
                onClick={handleAddFlashcard}
                className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-vermilion/40 text-vermilion px-3.5 py-2 hover:bg-vermilion/10"
              >
                {savedCard ? "เพิ่มลง Flashcards แล้ว ✓" : "สร้าง Flashcard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen Region Selection Overlay */}
      {screenCanvas && (
        <ScreenRegionSelector
          sourceCanvas={screenCanvas}
          onConfirm={handleRegionSelected}
          onCancel={() => setScreenCanvas(null)}
        />
      )}

      {/* OCR Result Modal Popup */}
      {modalText !== null && (
        <OcrResultModal
          initialText={modalText}
          onConfirm={handleModalConfirm}
          onCaptureAgain={handleModalCaptureAgain}
          onCancel={handleModalCancel}
        />
      )}
    </div>
  );
}

function LanguagesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}
