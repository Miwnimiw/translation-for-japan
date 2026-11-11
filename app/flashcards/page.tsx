"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Eye,
  EyeOff,
  CheckCircle2,
  Trash2,
  Layers,
} from "lucide-react";
import FlashcardView from "@/components/FlashcardView";
import { FlashcardEntry } from "@/lib/types";
import { getFlashcards, updateFlashcard, deleteFlashcard } from "@/lib/storage";

type Category = "all" | "Japanese" | "English";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardsPage() {
  const [all, setAll] = useState<FlashcardEntry[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [category, setCategory] = useState<Category>("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);

  useEffect(() => {
    const cards = getFlashcards();
    setAll(cards);
    setOrder(cards.map((c) => c.id));
  }, []);

  const deck = useMemo(() => {
    const byId = new Map(all.map((c) => [c.id, c]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean) as FlashcardEntry[];
    return category === "all" ? ordered : ordered.filter((c) => c.language === category);
  }, [all, order, category]);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setShowFurigana(false);
  }, [category]);

  const current = deck[index] ?? null;
  const knownCount = deck.filter((c) => c.reviewStatus === "known").length;

  function refresh() {
    const cards = getFlashcards();
    setAll(cards);
  }

  function goNext() {
    setFlipped(false);
    setShowFurigana(false);
    setIndex((i) => Math.min(i + 1, deck.length - 1));
  }

  function goPrev() {
    setFlipped(false);
    setShowFurigana(false);
    setIndex((i) => Math.max(i - 1, 0));
  }

  function handleShuffle() {
    setOrder(shuffleArray(all.map((c) => c.id)));
    setIndex(0);
    setFlipped(false);
    setShowFurigana(false);
  }

  function handleMarkKnown() {
    if (!current) return;
    const next = current.reviewStatus === "known" ? "new" : "known";
    updateFlashcard(current.id, { reviewStatus: next });
    refresh();
  }

  function handleDelete() {
    if (!current) return;
    deleteFlashcard(current.id);
    refresh();
    setOrder((o) => o.filter((id) => id !== current.id));
    setFlipped(false);
    setShowFurigana(false);
    setIndex((i) => Math.max(0, Math.min(i, deck.length - 2)));
  }

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink dark:text-ink-dark">Flashcards</h1>
          <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-1">
            {deck.length > 0
              ? `การ์ด ${index + 1} / ${deck.length} · รู้แล้ว ${knownCount} ใบ`
              : "ยังไม่มีการ์ดในหมวดนี้"}
          </p>
        </div>
        <button
          onClick={handleShuffle}
          disabled={deck.length < 2}
          className="focus-ring inline-flex items-center gap-1.5 text-sm text-ai-700 dark:text-ai-200 border border-ai-300 dark:border-ai-500 rounded px-3 py-1.5 hover:bg-ai-50 dark:hover:bg-ai-700/20 disabled:opacity-40 transition-colors"
        >
          <Shuffle size={14} /> Shuffle
        </button>
      </header>

      <div className="flex gap-1.5 mb-5">
        {(["all", "Japanese", "English"] as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`focus-ring text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors ${
              category === c
                ? "bg-ai-600 border-ai-600 text-white"
                : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
            }`}
          >
            {c === "all" ? "All Vocabulary" : c}
          </button>
        ))}
      </div>

      {deck.length > 0 && (
        <div className="h-1.5 w-full bg-line dark:bg-line-dark rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-ai-600 transition-all"
            style={{ width: `${((index + 1) / deck.length) * 100}%` }}
          />
        </div>
      )}

      {current ? (
        <>
          <FlashcardView
            card={current}
            flipped={flipped}
            showFurigana={showFurigana}
            onFlip={() => setFlipped((f) => !f)}
          />

          <div className="flex items-center justify-between mt-5">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="focus-ring inline-flex items-center gap-1 text-sm text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark disabled:opacity-30 px-2 py-2"
            >
              <ChevronLeft size={18} /> Previous
            </button>

            <div className="flex items-center gap-1.5">
              {current.language === "Japanese" && (
                <button
                  onClick={() => setShowFurigana((s) => !s)}
                  className="focus-ring inline-flex items-center gap-1 text-xs text-ai-700 dark:text-ai-200 border border-ai-300 dark:border-ai-500 rounded px-2.5 py-1.5 hover:bg-ai-50 dark:hover:bg-ai-700/20"
                >
                  {showFurigana ? <EyeOff size={13} /> : <Eye size={13} />}
                  Furigana
                </button>
              )}
              <button
                onClick={handleMarkKnown}
                className={`focus-ring inline-flex items-center gap-1 text-xs rounded px-2.5 py-1.5 border transition-colors ${
                  current.reviewStatus === "known"
                    ? "bg-ai-600 border-ai-600 text-white"
                    : "border-ai-300 dark:border-ai-500 text-ai-700 dark:text-ai-200 hover:bg-ai-50 dark:hover:bg-ai-700/20"
                }`}
              >
                <CheckCircle2 size={13} />
                {current.reviewStatus === "known" ? "Known" : "Mark as Known"}
              </button>
              <button
                onClick={handleDelete}
                aria-label="Delete flashcard"
                className="focus-ring inline-flex items-center gap-1 text-xs text-vermilion border border-vermilion/30 rounded px-2.5 py-1.5 hover:bg-vermilion/10"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <button
              onClick={goNext}
              disabled={index === deck.length - 1}
              className="focus-ring inline-flex items-center gap-1 text-sm text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark disabled:opacity-30 px-2 py-2"
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-line dark:border-line-dark rounded-lg">
          <Layers size={28} className="text-ink-soft/40 dark:text-ink-dark/30 mb-3" />
          <p className="text-sm text-ink-soft dark:text-ink-dark/60">
            ยังไม่มีการ์ดคำศัพท์ในหมวดนี้ ลองบันทึกคำศัพท์จากหน้า Translation ก่อน
          </p>
        </div>
      )}
    </div>
  );
}
