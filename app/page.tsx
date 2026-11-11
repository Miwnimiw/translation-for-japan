"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Languages, Layers, ArrowRight } from "lucide-react";
import { VocabularyEntry, FlashcardEntry } from "@/lib/types";
import { getVocabulary, getFlashcards } from "@/lib/storage";

export default function DashboardPage() {
  const [vocab, setVocab] = useState<VocabularyEntry[]>([]);
  const [cards, setCards] = useState<FlashcardEntry[]>([]);

  useEffect(() => {
    setVocab(getVocabulary());
    setCards(getFlashcards());
  }, []);

  const knownCount = cards.filter((c) => c.reviewStatus === "known").length;

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink dark:text-ink-dark">おかえりなさい</h1>
        <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-1">
          พร้อมเรียนรู้คำศัพท์ใหม่วันนี้หรือยัง?
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="คำศัพท์ที่บันทึก" value={vocab.length} />
        <StatCard label="Flashcards" value={cards.length} />
        <StatCard label="รู้แล้ว" value={knownCount} />
        <StatCard label="รอทบทวน" value={Math.max(cards.length - knownCount, 0)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        <Link
          href="/translation"
          className="focus-ring group flex items-center justify-between border border-line dark:border-line-dark rounded-lg p-5 hover:border-ai-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-ai-50 dark:bg-ai-700/20 p-2.5 text-ai-600 dark:text-ai-300">
              <Languages size={18} />
            </div>
            <div>
              <p className="font-medium text-ink dark:text-ink-dark">เริ่มแปลภาษา</p>
              <p className="text-xs text-ink-soft dark:text-ink-dark/50">Japanese / English → Thai</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-ink-soft/40 group-hover:text-ai-600 dark:group-hover:text-ai-300 transition-colors" />
        </Link>

        <Link
          href="/flashcards"
          className="focus-ring group flex items-center justify-between border border-line dark:border-line-dark rounded-lg p-5 hover:border-vermilion/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-vermilion/10 p-2.5 text-vermilion">
              <Layers size={18} />
            </div>
            <div>
              <p className="font-medium text-ink dark:text-ink-dark">เริ่มทบทวน Flashcards</p>
              <p className="text-xs text-ink-soft dark:text-ink-dark/50">{cards.length} การ์ดพร้อมทบทวน</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-ink-soft/40 group-hover:text-vermilion transition-colors" />
        </Link>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
            คำศัพท์ที่เพิ่มล่าสุด
          </h2>
          <Link href="/saved" className="text-xs text-ai-600 dark:text-ai-300 hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
        {vocab.length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-ink-dark/50 border border-dashed border-line dark:border-line-dark rounded-lg py-8 text-center">
            ยังไม่มีคำศัพท์ที่บันทึกไว้ ลองแปลคำแรกของคุณดูสิ
          </p>
        ) : (
          <ul className="space-y-1.5">
            {vocab.slice(0, 5).map((v) => (
              <li
                key={v.id}
                className="flex items-baseline gap-3 border border-line dark:border-line-dark rounded px-4 py-2.5"
              >
                <span
                  className={
                    v.sourceLanguage === "Japanese"
                      ? "font-jp text-base text-ink dark:text-ink-dark"
                      : "font-medium text-base text-ink dark:text-ink-dark"
                  }
                >
                  {v.word}
                </span>
                <span className="text-sm text-ink-soft dark:text-ink-dark/60 truncate">
                  {v.meaning[0]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line dark:border-line-dark rounded-lg p-4">
      <p className="font-display text-2xl text-ink dark:text-ink-dark">{value}</p>
      <p className="text-xs text-ink-soft dark:text-ink-dark/50 mt-0.5">{label}</p>
    </div>
  );
}
