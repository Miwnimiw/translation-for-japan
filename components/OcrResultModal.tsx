"use client";

import { useState } from "react";
import { Check, Copy, ArrowRight, RotateCcw, X, FileText } from "lucide-react";

interface OcrResultModalProps {
  initialText: string;
  onConfirm: (finalText: string) => void;
  onCaptureAgain: () => void;
  onCancel: () => void;
}

export default function OcrResultModal({
  initialText,
  onConfirm,
  onCaptureAgain,
  onCancel,
}: OcrResultModalProps) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

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

  function handleConfirmClick() {
    onConfirm(text.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
    >
      <div className="w-full max-w-lg bg-paper dark:bg-paper-dark border border-line dark:border-line-dark rounded-xl shadow-2xl p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-ai-50 dark:bg-ai-700/20 text-ai-600 dark:text-ai-300">
              <FileText size={20} />
            </div>
            <div>
              <h2
                id="ocr-modal-title"
                className="font-display text-xl text-ink dark:text-ink-dark"
              >
                Text Extraction Complete
              </h2>
              <p className="text-xs text-ink-soft dark:text-ink-dark/60 mt-0.5">
                ตรวจสอบและแก้ไขข้อความที่อ่านได้ ก่อนส่งไปยังระบบแปลภาษา
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="ปิดหน้าต่าง"
            className="focus-ring p-1 text-ink-soft hover:text-ink dark:text-ink-dark/60 dark:hover:text-ink-dark rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Editable Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-soft dark:text-ink-dark/70">
            ข้อความที่ตรวจจับได้ (สามารถพิมพ์แก้ไขได้):
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="ข้อความที่ตรวจจับได้จะปรากฏที่นี่..."
            className="focus-ring w-full resize-y rounded-lg border border-line dark:border-line-dark bg-transparent px-3.5 py-3 text-sm text-ink dark:text-ink-dark placeholder:text-ink-soft/40 dark:placeholder:text-ink-dark/30 leading-relaxed font-sans"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line dark:border-line-dark">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!text.trim()}
              className="focus-ring inline-flex items-center gap-1.5 text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark border border-line dark:border-line-dark rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={onCaptureAgain}
              className="focus-ring inline-flex items-center gap-1.5 text-xs text-ai-700 dark:text-ai-300 hover:bg-ai-50 dark:hover:bg-ai-700/20 border border-ai-300 dark:border-ai-500 rounded-lg px-3 py-2 transition-colors"
            >
              <RotateCcw size={13} />
              Capture Again
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="focus-ring text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark px-3 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClick}
              disabled={!text.trim()}
              className="focus-ring inline-flex items-center gap-1.5 bg-ai-600 hover:bg-ai-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors shadow-sm"
            >
              <span>Confirm & Translate</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

