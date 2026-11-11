"use client";

import { FlashcardEntry } from "@/lib/types";

interface FlashcardViewProps {
  card: FlashcardEntry;
  flipped: boolean;
  showFurigana: boolean;
  onFlip: () => void;
}

export default function FlashcardView({ card, flipped, showFurigana, onFlip }: FlashcardViewProps) {
  const isJP = card.language === "Japanese";

  return (
    <button
      onClick={onFlip}
      className="focus-ring key-flip w-full aspect-[4/3] sm:aspect-[3/2] rounded-lg border border-line dark:border-line-dark bg-paper dark:bg-paper-dark shadow-sm hover:shadow-md transition-shadow text-left"
      style={{ perspective: "1200px" }}
      aria-label={flipped ? "แตะเพื่อดูด้านหน้า" : "แตะเพื่อดูความหมาย"}
    >
      <div className="animate-flip h-full w-full flex flex-col items-center justify-center p-8 text-center">
        {!flipped ? (
          <div>
            {isJP && (
              <p
                className={`font-jp text-sm text-ink-soft dark:text-ink-dark/50 mb-2 transition-opacity ${
                  showFurigana ? "opacity-100" : "opacity-0"
                }`}
              >
                {card.reading || "\u00A0"}
              </p>
            )}
            <p
              className={
                isJP
                  ? "font-jp text-4xl sm:text-5xl text-ink dark:text-ink-dark"
                  : "font-display text-4xl sm:text-5xl text-ink dark:text-ink-dark"
              }
            >
              {card.word}
            </p>
            {!isJP && card.reading && (
              <p className="text-sm text-ink-soft dark:text-ink-dark/50 mt-2">{card.reading}</p>
            )}
            <p className="text-xs text-ink-soft dark:text-ink-dark/40 mt-4">แตะเพื่อดูความหมาย</p>
          </div>
        ) : (
          <div className="max-w-md">
            <ul className="space-y-1">
              {card.meaning.map((m, i) => (
                <li key={i} className="text-xl text-ink dark:text-ink-dark">
                  {m}
                </li>
              ))}
            </ul>
            {card.explanation && (
              <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-3 leading-relaxed">
                {card.explanation}
              </p>
            )}
            {card.examples.length > 0 && (
              <div className="mt-4 text-left border-t border-line dark:border-line-dark pt-3">
                <p className={isJP ? "font-jp text-sm text-ink dark:text-ink-dark" : "text-sm text-ink dark:text-ink-dark"}>
                  {card.examples[0].original}
                </p>
                <p className="text-xs text-vermilion mt-0.5">{card.examples[0].translation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
