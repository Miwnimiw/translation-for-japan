"use client";

import { useState } from "react";
import { Copy, Check, BookmarkPlus, Layers, AlertTriangle } from "lucide-react";
import { TranslationResult } from "@/lib/types";

interface ResultCardProps {
  result: TranslationResult;
  onSaveVocabulary?: () => void;
  onAddFlashcard?: () => void;
  savedVocabulary?: boolean;
  savedFlashcard?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard API unavailable — fail silently, non-critical
        }
      }}
      className="focus-ring inline-flex items-center gap-1.5 text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ai-600 dark:hover:text-ai-300 rounded px-2 py-1"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ExampleBlock({
  original,
  reading,
  translation,
  lang,
}: {
  original: string;
  reading: string;
  translation: string;
  lang: "Japanese" | "English";
}) {
  return (
    <div className="border-l-2 border-ai-100 dark:border-ai-700/50 pl-3 py-0.5">
      <p className={lang === "Japanese" ? "font-jp text-[15px] text-ink dark:text-ink-dark" : "text-[15px] text-ink dark:text-ink-dark"}>
        {original}
      </p>
      {lang === "Japanese" && reading && reading !== original && (
        <p className="font-jp text-xs text-ink-soft dark:text-ink-dark/50 mt-0.5">{reading}</p>
      )}
      <p className="text-sm text-vermilion mt-0.5">{translation}</p>
    </div>
  );
}

export default function ResultCard({
  result,
  onSaveVocabulary,
  onAddFlashcard,
  savedVocabulary,
  savedFlashcard,
}: ResultCardProps) {
  const isJP = result.sourceLanguage === "Japanese";

  return (
    <div className="border border-line dark:border-line-dark rounded-lg bg-paper dark:bg-paper-dark">
      <div className="p-5 sm:p-6 border-b border-line dark:border-line-dark">
        {result.uncertain && (
          <div className="mb-3 flex items-center gap-2 text-xs text-vermilion bg-vermilion/10 rounded px-3 py-2">
            <AlertTriangle size={14} />
            AI ไม่มั่นใจในความหมายหรือคำอ่านของคำนี้ทั้งหมด โปรดตรวจสอบเพิ่มเติม
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-ai-600 dark:text-ai-300">
              {result.sourceLanguage}
              {result.partOfSpeech ? ` · ${result.partOfSpeech}` : ""}
            </span>
            <h2
              className={
                isJP
                  ? "font-jp text-3xl sm:text-4xl text-ink dark:text-ink-dark mt-1"
                  : "font-display text-3xl sm:text-4xl text-ink dark:text-ink-dark mt-1"
              }
            >
              {result.word}
            </h2>
            {result.reading && (
              <p className="font-jp text-sm text-ink-soft dark:text-ink-dark/60 mt-1">{result.reading}</p>
            )}
          </div>
          <CopyButton text={result.word} />
        </div>

        <ul className="mt-3 space-y-1">
          {result.meaning.map((m, i) => (
            <li key={i} className="text-base text-ink dark:text-ink-dark">
              <span className="text-ink-soft dark:text-ink-dark/40 mr-2">{i + 1}.</span>
              {m}
            </li>
          ))}
        </ul>

        {result.explanation && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft dark:text-ink-dark/70">
            {result.explanation}
          </p>
        )}

        {result.usageNote && (
          <p className="mt-2 text-sm text-ai-600 dark:text-ai-300 bg-ai-50 dark:bg-ai-700/20 rounded px-3 py-2">
            {result.usageNote}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onSaveVocabulary}
            disabled={savedVocabulary}
            className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded border border-ai-300 dark:border-ai-500 text-ai-700 dark:text-ai-100 px-3 py-1.5 hover:bg-ai-50 dark:hover:bg-ai-700/20 disabled:opacity-50 disabled:cursor-default transition-colors"
          >
            <BookmarkPlus size={14} />
            {savedVocabulary ? "Saved to Vocabulary" : "Save Vocabulary"}
          </button>
          <button
            onClick={onAddFlashcard}
            disabled={savedFlashcard}
            className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded border border-vermilion/40 text-vermilion px-3 py-1.5 hover:bg-vermilion/10 disabled:opacity-50 disabled:cursor-default transition-colors"
          >
            <Layers size={14} />
            {savedFlashcard ? "Added to Flashcards" : "Add to Flashcards"}
          </button>
        </div>
      </div>

      {result.kanjiBreakdown && result.kanjiBreakdown.length > 0 && (
        <div className="p-5 sm:p-6 border-b border-line dark:border-line-dark">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50 mb-2.5">
            ส่วนประกอบของคันจิ
          </h3>
          <div className="flex flex-wrap gap-3">
            {result.kanjiBreakdown.map((k, i) => (
              <div key={i} className="text-center min-w-[64px]">
                <div className="font-jp text-2xl text-ink dark:text-ink-dark">{k.kanji}</div>
                <div className="font-jp text-xs text-ink-soft dark:text-ink-dark/50">{k.reading}</div>
                <div className="text-xs text-ink-soft dark:text-ink-dark/70 mt-0.5">{k.meaning}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.examples.length > 0 && (
        <div className="p-5 sm:p-6 border-b border-line dark:border-line-dark space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
            ตัวอย่างประโยค
          </h3>
          {result.examples.map((ex, i) => (
            <ExampleBlock key={i} {...ex} lang={result.sourceLanguage} />
          ))}
        </div>
      )}

      {result.grammarPoints && result.grammarPoints.length > 0 && (
        <div className="p-5 sm:p-6 border-b border-line dark:border-line-dark space-y-4">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
            ไวยากรณ์และโครงสร้างประโยค (Grammar Points)
          </h3>
          {result.grammarPoints.map((gp, i) => (
            <div
              key={i}
              className="rounded border border-line dark:border-line-dark p-4 bg-ai-50/30 dark:bg-ai-700/10"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-base font-semibold text-ai-700 dark:text-ai-300">
                  {gp.structure}
                </span>
              </div>
              <p className="text-sm font-medium text-ink dark:text-ink-dark mt-1">
                {gp.meaning}
              </p>
              {gp.conditions && (
                <p className="text-xs text-ink-soft dark:text-ink-dark/70 mt-1">
                  <span className="font-medium">เงื่อนไขการใช้:</span> {gp.conditions}
                </p>
              )}
              {gp.comparison && (
                <p className="text-xs text-vermilion mt-1 bg-vermilion/5 rounded p-2">
                  <span className="font-medium">ข้อเปรียบเทียบ:</span> {gp.comparison}
                </p>
              )}
              {gp.examples && gp.examples.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-line dark:border-line-dark pt-2">
                  {gp.examples.map((ex, j) => (
                    <ExampleBlock key={j} {...ex} lang={result.sourceLanguage} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.relatedWords.length > 0 && (
        <div className="p-5 sm:p-6 space-y-4">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
            คำที่เกี่ยวข้อง / คำประสมที่พบบ่อย
          </h3>
          {result.relatedWords.map((rw, i) => (
            <div key={i} className="rounded border border-line dark:border-line-dark p-4">
              <div className="flex items-baseline gap-2">
                <span className={isJP ? "font-jp text-lg text-ink dark:text-ink-dark" : "font-medium text-ink dark:text-ink-dark"}>
                  {rw.word}
                </span>
                {rw.reading && (
                  <span className="font-jp text-xs text-ink-soft dark:text-ink-dark/50">{rw.reading}</span>
                )}
              </div>
              <p className="text-sm text-ink-soft dark:text-ink-dark/70 mt-0.5">{rw.meaning}</p>

              {rw.kanjiBreakdown && rw.kanjiBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {rw.kanjiBreakdown.map((k, j) => (
                    <span
                      key={j}
                      className="font-jp text-xs text-ai-700 dark:text-ai-200 bg-ai-50 dark:bg-ai-700/20 rounded px-2 py-1"
                    >
                      {k.kanji}（{k.reading}）{k.meaning}
                    </span>
                  ))}
                </div>
              )}

              {rw.examples && rw.examples.length > 0 && (
                <div className="mt-3 space-y-2">
                  {rw.examples.map((ex, j) => (
                    <ExampleBlock key={j} {...ex} lang={result.sourceLanguage} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
