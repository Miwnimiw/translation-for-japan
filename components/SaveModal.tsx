"use client";

import { X } from "lucide-react";

interface SaveModalProps {
  word: string;
  onSaveText: () => void;
  onAddFlashcard: () => void;
  onReject: () => void;
}

export default function SaveModal({ word, onSaveText, onAddFlashcard, onReject }: SaveModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 dark:bg-black/60 px-4 pb-4 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-modal-title"
    >
      <div className="w-full sm:max-w-sm bg-paper dark:bg-paper-dark border border-line dark:border-line-dark rounded-lg shadow-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
              Translation Completed
            </p>
            <h3 id="save-modal-title" className="mt-1 font-display text-lg text-ink dark:text-ink-dark">
              ต้องการบันทึก &ldquo;{word}&rdquo; หรือไม่?
            </h3>
          </div>
          <button
            onClick={onReject}
            aria-label="ปิด"
            className="focus-ring p-1 -mt-1 -mr-1 text-ink-soft hover:text-ink dark:text-ink-dark/60 dark:hover:text-ink-dark rounded"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onSaveText}
            className="focus-ring w-full rounded bg-ai-600 text-white text-sm font-medium py-2.5 hover:bg-ai-700 transition-colors"
          >
            Save Text
          </button>
          <button
            onClick={onAddFlashcard}
            className="focus-ring w-full rounded border border-ai-300 text-ai-700 dark:text-ai-100 dark:border-ai-500 text-sm font-medium py-2.5 hover:bg-ai-50 dark:hover:bg-ai-700/20 transition-colors"
          >
            Add to Flashcards
          </button>
          <button
            onClick={onReject}
            className="focus-ring w-full rounded text-sm text-ink-soft dark:text-ink-dark/60 py-2 hover:text-ink dark:hover:text-ink-dark transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
