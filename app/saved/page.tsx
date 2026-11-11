"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, Trash2, Copy, Check, Layers, Pencil, X, ChevronRight,
  Sparkles, Loader2, BookmarkPlus,
} from "lucide-react";
import ResultCard from "@/components/ResultCard";
import { SavedTextEntry, FlashcardEntry, SourceLanguage, TranslationResult } from "@/lib/types";
import {
  getSavedTexts,
  deleteSavedText,
  updateSavedText,
  addFlashcard,
  saveVocabulary,
} from "@/lib/storage";
import { generateId } from "@/lib/id";

type LangFilter = "all" | SourceLanguage;

export default function SavedTextPage() {
  const [entries, setEntries] = useState<SavedTextEntry[]>([]);
  const [query, setQuery] = useState("");
  const [langFilter, setLangFilter] = useState<LangFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // ── Deep Analysis State ──────────────────────────────────────────────────
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<TranslationResult | null>(null);
  const [deepAnalysisLoading, setDeepAnalysisLoading] = useState(false);
  const [deepAnalysisError, setDeepAnalysisError] = useState<string | null>(null);
  const [deepAnalysisSavedVocab, setDeepAnalysisSavedVocab] = useState(false);
  const [deepAnalysisSavedCard, setDeepAnalysisSavedCard] = useState(false);

  useEffect(() => {
    setEntries(getSavedTexts());
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (langFilter !== "all" && e.sourceLanguage !== langFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.result.word.toLowerCase().includes(q) ||
        e.originalText.toLowerCase().includes(q) ||
        e.translatedSummary.toLowerCase().includes(q)
      );
    });
  }, [entries, query, langFilter]);

  function handleDelete(id: string) {
    deleteSavedText(id);
    setEntries(getSavedTexts());
    setConfirmDeleteId(null);
    if (openId === id) setOpenId(null);
  }

  function startEdit(entry: SavedTextEntry) {
    setEditingId(entry.id);
    setEditDraft(entry.originalText);
  }

  function saveEdit(id: string) {
    updateSavedText(id, { originalText: editDraft });
    setEntries(getSavedTexts());
    setEditingId(null);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  function handleAddFlashcard(entry: SavedTextEntry) {
    const r = entry.result;
    const vocab = {
      id: generateId("vocab"),
      sourceLanguage: r.sourceLanguage,
      word: r.word,
      reading: r.reading,
      meaning: r.meaning,
      explanation: r.explanation,
      usageNote: r.usageNote,
      examples: r.examples,
      relatedWords: r.relatedWords,
      createdAt: new Date().toISOString(),
    };
    saveVocabulary(vocab);
    const card: FlashcardEntry = {
      id: generateId("card"),
      vocabularyId: vocab.id,
      word: vocab.word,
      reading: vocab.reading,
      meaning: vocab.meaning,
      explanation: vocab.explanation,
      examples: vocab.examples,
      language: vocab.sourceLanguage,
      createdAt: new Date().toISOString(),
      reviewStatus: "new",
    };
    addFlashcard(card);
    setJustAddedId(entry.id);
    setTimeout(() => setJustAddedId((cur) => (cur === entry.id ? null : cur)), 1500);
  }

  const openEntry = entries.find((e) => e.id === openId) || null;

  // ── Deep Analysis: reset when modal opens a different entry ─────────────
  useEffect(() => {
    setDeepAnalysisResult(null);
    setDeepAnalysisError(null);
    setDeepAnalysisLoading(false);
    setDeepAnalysisSavedVocab(false);
    setDeepAnalysisSavedCard(false);
  }, [openId]);

  async function handleDeepAnalysis(entry: SavedTextEntry) {
    setDeepAnalysisLoading(true);
    setDeepAnalysisResult(null);
    setDeepAnalysisError(null);
    setDeepAnalysisSavedVocab(false);
    setDeepAnalysisSavedCard(false);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: entry.originalText,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: "Thai",
          task: "vocabulary",
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message || "ไม่สามารถวิเคราะห์ข้อความได้");
      }
      const result = (body.data?.vocabularyDetails || body.result) as TranslationResult;
      setDeepAnalysisResult(result);
    } catch (err) {
      setDeepAnalysisError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์");
    } finally {
      setDeepAnalysisLoading(false);
    }
  }

  function handleDeepAnalysisSaveVocab() {
    if (!deepAnalysisResult) return;
    saveVocabulary({
      id: generateId("vocab"),
      sourceLanguage: deepAnalysisResult.sourceLanguage,
      word: deepAnalysisResult.word,
      reading: deepAnalysisResult.reading,
      meaning: deepAnalysisResult.meaning,
      explanation: deepAnalysisResult.explanation,
      usageNote: deepAnalysisResult.usageNote,
      examples: deepAnalysisResult.examples,
      relatedWords: deepAnalysisResult.relatedWords,
      createdAt: new Date().toISOString(),
    });
    setDeepAnalysisSavedVocab(true);
  }

  function handleDeepAnalysisAddFlashcard() {
    if (!deepAnalysisResult) return;
    const vocabId = generateId("vocab");
    saveVocabulary({
      id: vocabId,
      sourceLanguage: deepAnalysisResult.sourceLanguage,
      word: deepAnalysisResult.word,
      reading: deepAnalysisResult.reading,
      meaning: deepAnalysisResult.meaning,
      explanation: deepAnalysisResult.explanation,
      usageNote: deepAnalysisResult.usageNote,
      examples: deepAnalysisResult.examples,
      relatedWords: deepAnalysisResult.relatedWords,
      createdAt: new Date().toISOString(),
    });
    addFlashcard({
      id: generateId("card"),
      vocabularyId: vocabId,
      word: deepAnalysisResult.word,
      reading: deepAnalysisResult.reading,
      meaning: deepAnalysisResult.meaning,
      explanation: deepAnalysisResult.explanation,
      examples: deepAnalysisResult.examples,
      language: deepAnalysisResult.sourceLanguage,
      createdAt: new Date().toISOString(),
      reviewStatus: "new",
    });
    setDeepAnalysisSavedVocab(true);
    setDeepAnalysisSavedCard(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink dark:text-ink-dark">Saved Text</h1>
        <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-1">
          ข้อความและคำศัพท์ที่คุณบันทึกไว้ ({entries.length} รายการ)
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft dark:text-ink-dark/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาคำศัพท์หรือข้อความ..."
            className="focus-ring w-full border border-line dark:border-line-dark rounded bg-transparent pl-9 pr-3 py-2 text-sm text-ink dark:text-ink-dark placeholder:text-ink-soft/50 dark:placeholder:text-ink-dark/30"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "Japanese", "English"] as LangFilter[]).map((l) => (
            <button
              key={l}
              onClick={() => setLangFilter(l)}
              className={`focus-ring text-xs font-medium rounded-full px-3 py-2 border transition-colors ${
                langFilter === l
                  ? "bg-ai-600 border-ai-600 text-white"
                  : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
              }`}
            >
              {l === "all" ? "All" : l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-dark/50 py-10 text-center">
          {entries.length === 0 ? "ยังไม่มีข้อความที่บันทึกไว้" : "ไม่พบรายการที่ตรงกับการค้นหา"}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <li key={entry.id} className="border border-line dark:border-line-dark rounded-lg">
              {editingId === entry.id ? (
                <div className="p-4">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    className="focus-ring w-full border border-line dark:border-line-dark rounded bg-transparent px-3 py-2 text-sm text-ink dark:text-ink-dark"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveEdit(entry.id)}
                      className="focus-ring text-xs font-medium bg-ai-600 text-white rounded px-3 py-1.5 hover:bg-ai-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="focus-ring text-xs text-ink-soft dark:text-ink-dark/60 rounded px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => setOpenId(entry.id)}
                    className="focus-ring flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={
                          entry.sourceLanguage === "Japanese"
                            ? "font-jp text-base text-ink dark:text-ink-dark"
                            : "font-medium text-base text-ink dark:text-ink-dark"
                        }
                      >
                        {entry.originalText}
                      </span>
                      {entry.sourceLanguage === "Japanese" &&
                        (entry.reading || entry.result?.reading) &&
                        (entry.reading || entry.result?.reading) !== entry.originalText && (
                          <span className="font-jp text-xs text-ink-soft dark:text-ink-dark/50">
                            {entry.reading || entry.result?.reading}
                          </span>
                        )}
                      <span className="text-[10px] uppercase text-ai-600 dark:text-ai-300 shrink-0">
                        {entry.sourceLanguage}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft dark:text-ink-dark/60 truncate mt-0.5">
                      {entry.translatedSummary}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopy(entry.originalText)}
                      aria-label="Copy"
                      className="focus-ring p-1.5 text-ink-soft hover:text-ai-600 dark:text-ink-dark/50 dark:hover:text-ai-300 rounded"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => handleAddFlashcard(entry)}
                      aria-label="Add to Flashcards"
                      className={`focus-ring p-1.5 rounded ${
                        justAddedId === entry.id
                          ? "text-vermilion"
                          : "text-ink-soft hover:text-vermilion dark:text-ink-dark/50"
                      }`}
                    >
                      {justAddedId === entry.id ? <Check size={15} /> : <Layers size={15} />}
                    </button>
                    <button
                      onClick={() => startEdit(entry)}
                      aria-label="Edit"
                      className="focus-ring p-1.5 text-ink-soft hover:text-ai-600 dark:text-ink-dark/50 dark:hover:text-ai-300 rounded"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(entry.id)}
                      aria-label="Delete"
                      className="focus-ring p-1.5 text-ink-soft hover:text-vermilion dark:text-ink-dark/50 rounded"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={16} className="text-ink-soft/40 dark:text-ink-dark/30" />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {openEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-paper dark:bg-paper-dark rounded-lg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-2 sticky top-0 bg-paper dark:bg-paper-dark border-b border-line dark:border-line-dark">
              <span className="text-xs font-medium text-ink-soft dark:text-ink-dark/60 uppercase tracking-wide">
                รายละเอียดข้อความที่บันทึก
              </span>
              <button
                onClick={() => setOpenId(null)}
                aria-label="ปิด"
                className="focus-ring p-1.5 text-ink-soft hover:text-ink dark:text-ink-dark/60 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pb-4 pt-3 space-y-4">
              {/* Original text info */}
              <div className="rounded-lg bg-ai-50/50 dark:bg-ai-700/10 border border-line dark:border-line-dark px-4 py-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-ink-soft dark:text-ink-dark/50">ข้อความต้นฉบับ:</p>
                  <button
                    onClick={() => handleCopy(openEntry.originalText)}
                    aria-label="Copy"
                    className="focus-ring inline-flex items-center gap-1 text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ai-600 dark:hover:text-ai-300 rounded px-2 py-0.5"
                  >
                    <Copy size={13} />
                    Copy
                  </button>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <span
                    className={
                      openEntry.sourceLanguage === "Japanese"
                        ? "font-jp text-xl sm:text-2xl font-semibold text-ink dark:text-ink-dark"
                        : "text-xl sm:text-2xl font-semibold text-ink dark:text-ink-dark"
                    }
                  >
                    {openEntry.originalText}
                  </span>
                  {openEntry.sourceLanguage === "Japanese" &&
                    (openEntry.reading || openEntry.result?.reading) &&
                    (openEntry.reading || openEntry.result?.reading) !== openEntry.originalText && (
                      <span className="font-jp text-base sm:text-lg text-ink-soft dark:text-ink-dark/60">
                        {openEntry.reading || openEntry.result?.reading}
                      </span>
                    )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-line/60 dark:border-line-dark/60">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-ai-600 dark:text-ai-300 block mb-1">
                    {openEntry.sourceLanguage}
                  </span>
                  <p className="text-base text-ink dark:text-ink-dark font-medium leading-relaxed">
                    {openEntry.translatedSummary}
                  </p>
                </div>
              </div>

              {/* Deep Analysis Button */}
              {!deepAnalysisResult && !deepAnalysisLoading && (
                <button
                  onClick={() => handleDeepAnalysis(openEntry)}
                  className="focus-ring w-full inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg bg-ai-600 text-white px-4 py-2.5 hover:bg-ai-700 transition-colors"
                >
                  <Sparkles size={16} />
                  วิเคราะห์คำศัพท์และไวยากรณ์เชิงลึก
                </button>
              )}

              {/* Loading */}
              {deepAnalysisLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-soft dark:text-ink-dark/60">
                  <Loader2 size={16} className="animate-spin text-ai-600" />
                  กำลังวิเคราะห์ด้วย AI...
                </div>
              )}

              {/* Error */}
              {deepAnalysisError && (
                <div className="text-sm text-vermilion bg-vermilion/10 border border-vermilion/20 rounded-lg p-4">
                  <p className="font-medium">เกิดข้อผิดพลาด</p>
                  <p className="mt-0.5">{deepAnalysisError}</p>
                  <button
                    onClick={() => handleDeepAnalysis(openEntry)}
                    className="mt-2 text-xs underline hover:no-underline"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              )}

              {/* Deep Analysis Result */}
              {deepAnalysisResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
                      การวิเคราะห์คำศัพท์และไวยากรณ์
                    </h3>
                    <button
                      onClick={() => {
                        setDeepAnalysisResult(null);
                        setDeepAnalysisError(null);
                      }}
                      className="focus-ring text-xs text-ink-soft dark:text-ink-dark/40 hover:text-ai-600 flex items-center gap-1"
                    >
                      <Sparkles size={12} /> วิเคราะห์ใหม่
                    </button>
                  </div>
                  <ResultCard
                    result={deepAnalysisResult}
                    onSaveVocabulary={handleDeepAnalysisSaveVocab}
                    onAddFlashcard={handleDeepAnalysisAddFlashcard}
                    savedVocabulary={deepAnalysisSavedVocab}
                    savedFlashcard={deepAnalysisSavedCard}
                  />
                </div>
              )}

              {/* Original ResultCard (existing vocab data) */}
              {!deepAnalysisResult && !deepAnalysisLoading && openEntry.result.meaning.length > 0 && openEntry.result.explanation && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50 mb-2">
                    ข้อมูลคำศัพท์ที่บันทึกไว้
                  </h3>
                  <ResultCard result={openEntry.result} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-paper dark:bg-paper-dark border border-line dark:border-line-dark rounded-lg shadow-xl p-5">
            <h3 className="font-display text-lg text-ink dark:text-ink-dark">ลบรายการนี้?</h3>
            <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-1">
              การลบไม่สามารถย้อนกลับได้
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="focus-ring flex-1 rounded bg-vermilion text-white text-sm font-medium py-2 hover:opacity-90"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="focus-ring flex-1 rounded border border-line dark:border-line-dark text-sm text-ink dark:text-ink-dark py-2 hover:bg-ink/5 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
