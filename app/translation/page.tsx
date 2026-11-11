"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Trash2,
  Copy,
  Check,
  Languages,
  BookmarkPlus,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import ResultCard from "@/components/ResultCard";
import SaveModal from "@/components/SaveModal";
import {
  SourceLanguage,
  TranslationResult,
  VocabularyEntry,
  FlashcardEntry,
  SavedTextEntry,
} from "@/lib/types";
import { saveVocabulary, addFlashcard, saveSavedText } from "@/lib/storage";
import { generateId } from "@/lib/id";
import { TranslationData } from "@/lib/schemas";

type LangChoice = SourceLanguage | "auto";

export default function TranslationPage() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<LangChoice>("auto");
  const [loading, setLoading] = useState(false);
  const [loadingLang, setLoadingLang] = useState<LangChoice | null>(null);
  const [loadingVocab, setLoadingVocab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1 Translation Data
  const [translation, setTranslation] = useState<TranslationData | null>(null);

  // Phase 2 Vocabulary Explanation (optional deep dive)
  const [vocabResult, setVocabResult] = useState<TranslationResult | null>(null);

  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [savedTextSuccess, setSavedTextSuccess] = useState(false);
  const [savedVocab, setSavedVocab] = useState(false);
  const [savedCard, setSavedCard] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pending = window.sessionStorage.getItem("kotoba.pendingTranslateText");
      if (pending) {
        setText(pending);
        window.sessionStorage.removeItem("kotoba.pendingTranslateText");
      }
    }
  }, []);

  function getSelectedOrFullText(): string {
    const ta = textareaRef.current;
    if (!ta) return text;
    const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd);
    return selected.trim() ? selected : text;
  }

  async function runTranslate(input: string, forcedLang?: LangChoice) {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("กรุณาป้อนข้อความที่ต้องการแปลก่อน");
      return;
    }

    const langToUse = forcedLang || language;
    setLoading(true);
    setLoadingLang(forcedLang || null);
    setError(null);
    setTranslation(null);
    setVocabResult(null);
    setSavedTextSuccess(false);
    setSavedVocab(false);
    setSavedCard(false);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          sourceLanguage: langToUse,
          targetLanguage: "Thai",
          task: "translation",
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        const errorMsg =
          body?.error?.message || body?.error || "ไม่สามารถแปลข้อความได้ กรุณาลองใหม่อีกครั้ง";
        throw new Error(errorMsg);
      }

      setTranslation(body.data as TranslationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
    } finally {
      setLoading(false);
      setLoadingLang(null);
    }
  }

  function handleTranslateJapan() {
    const target = getSelectedOrFullText();
    setLanguage("Japanese");
    runTranslate(target, "Japanese");
  }

  function handleTranslateEnglish() {
    const target = getSelectedOrFullText();
    setLanguage("English");
    runTranslate(target, "English");
  }

  async function runDeepVocabularyExplanation() {
    const targetText = translation?.originalText || text.trim();
    if (!targetText) return;

    setLoadingVocab(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: targetText,
          sourceLanguage: translation?.sourceLanguage || language,
          targetLanguage: "Thai",
          task: "vocabulary",
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message || "ไม่สามารถวิเคราะห์คำศัพท์ได้");
      }

      const result = (body.data?.vocabularyDetails || body.result) as TranslationResult;
      setVocabResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์คำศัพท์");
    } finally {
      setLoadingVocab(false);
    }
  }

  function handleClear() {
    setText("");
    setTranslation(null);
    setVocabResult(null);
    setError(null);
    setShowSaveModal(false);
    setSavedTextSuccess(false);
  }

  async function handleCopyInput() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 1500);
    } catch {
      // ignore
    }
  }

  async function handleCopyOutput() {
    if (!translation?.translatedText) return;
    try {
      await navigator.clipboard.writeText(translation.translatedText);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 1500);
    } catch {
      // ignore
    }
  }

  function handleSaveText() {
    if (!translation) return;

    const dummyResult: TranslationResult = vocabResult || {
      sourceLanguage: translation.sourceLanguage,
      word: translation.originalText,
      reading: null,
      meaning: [translation.translatedText],
      explanation: "",
      examples: [],
      relatedWords: [],
    };

    const entry: SavedTextEntry = {
      id: generateId("text"),
      originalText: translation.originalText,
      translatedSummary: translation.translatedText,
      result: dummyResult,
      sourceLanguage: translation.sourceLanguage,
      createdAt: new Date().toISOString(),
    };

    saveSavedText(entry);
    setSavedTextSuccess(true);
    setTimeout(() => setSavedTextSuccess(false), 2000);
  }

  function vocabularyFromTranslation(t: TranslationData): VocabularyEntry {
    return {
      id: generateId("vocab"),
      sourceLanguage: t.sourceLanguage,
      word: t.originalText,
      reading: null,
      meaning: [t.translatedText],
      explanation: `แปลจาก ${t.sourceLanguage} เป็นไทย`,
      examples: [],
      relatedWords: [],
      createdAt: new Date().toISOString(),
    };
  }

  function handleAddFlashcardFromTranslation() {
    if (!translation) return;
    const vocab = vocabularyFromTranslation(translation);
    saveVocabulary(vocab);

    const card: FlashcardEntry = {
      id: generateId("card"),
      vocabularyId: vocab.id,
      word: vocab.word,
      reading: null,
      meaning: [translation.translatedText],
      explanation: "",
      examples: [],
      language: vocab.sourceLanguage,
      createdAt: new Date().toISOString(),
      reviewStatus: "new",
    };

    addFlashcard(card);
    setSavedCard(true);
    setTimeout(() => setSavedCard(false), 2000);
  }

  function handleSaveVocabResult() {
    if (!vocabResult) return;
    saveVocabulary({
      id: generateId("vocab"),
      sourceLanguage: vocabResult.sourceLanguage,
      word: vocabResult.word,
      reading: vocabResult.reading,
      meaning: vocabResult.meaning,
      explanation: vocabResult.explanation,
      usageNote: vocabResult.usageNote,
      examples: vocabResult.examples,
      relatedWords: vocabResult.relatedWords,
      createdAt: new Date().toISOString(),
    });
    setSavedVocab(true);
  }

  function handleAddFlashcardFromVocabResult() {
    if (!vocabResult) return;
    const vocabId = generateId("vocab");
    saveVocabulary({
      id: vocabId,
      sourceLanguage: vocabResult.sourceLanguage,
      word: vocabResult.word,
      reading: vocabResult.reading,
      meaning: vocabResult.meaning,
      explanation: vocabResult.explanation,
      usageNote: vocabResult.usageNote,
      examples: vocabResult.examples,
      relatedWords: vocabResult.relatedWords,
      createdAt: new Date().toISOString(),
    });

    addFlashcard({
      id: generateId("card"),
      vocabularyId: vocabId,
      word: vocabResult.word,
      reading: vocabResult.reading,
      meaning: vocabResult.meaning,
      explanation: vocabResult.explanation,
      examples: vocabResult.examples,
      language: vocabResult.sourceLanguage,
      createdAt: new Date().toISOString(),
      reviewStatus: "new",
    });
    setSavedVocab(true);
    setSavedCard(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink dark:text-ink-dark">Translation</h1>
        <p className="text-sm text-ink-soft dark:text-ink-dark/60 mt-1">
          แปลภาษาญี่ปุ่นและอังกฤษเป็นภาษาไทย พร้อมระบบวิเคราะห์คำศัพท์และไวยากรณ์
        </p>
      </header>

      {/* Language Selection */}
      <div className="flex gap-2 mb-3">
        {(["auto", "Japanese", "English"] as LangChoice[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`focus-ring text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors ${
              language === lang
                ? "bg-ai-600 border-ai-600 text-white"
                : "border-line dark:border-line-dark text-ink-soft dark:text-ink-dark/60 hover:border-ai-300"
            }`}
          >
            {lang === "auto" ? "ตรวจจับอัตโนมัติ" : lang}
          </button>
        ))}
      </div>

      {/* Input Text Box */}
      <div className="border border-line dark:border-line-dark rounded-lg bg-paper dark:bg-paper-dark">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์หรือวางข้อความภาษาญี่ปุ่น/อังกฤษที่นี่... (สามารถเลือกข้อความบางส่วนเพื่อแปลเฉพาะส่วนที่เลือกได้)"
          rows={5}
          className="focus-ring w-full resize-y bg-transparent px-4 py-3 text-[15px] text-ink dark:text-ink-dark placeholder:text-ink-soft/50 dark:placeholder:text-ink-dark/30 rounded-t-lg"
        />
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-line dark:border-line-dark">
          <button
            onClick={handleTranslateJapan}
            disabled={loading || !text.trim()}
            className="focus-ring inline-flex items-center gap-1.5 bg-ai-600 hover:bg-ai-700 text-white text-sm font-medium rounded px-3.5 py-2 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading && loadingLang === "Japanese" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Languages size={15} />
            )}
            Translation for Japan
          </button>
          <button
            onClick={handleTranslateEnglish}
            disabled={loading || !text.trim()}
            className="focus-ring inline-flex items-center gap-1.5 text-sm text-ai-700 dark:text-ai-200 border border-ai-300 dark:border-ai-500 rounded px-3.5 py-2 hover:bg-ai-50 dark:hover:bg-ai-700/20 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading && loadingLang === "English" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Languages size={15} />
            )}
            Translation for English
          </button>
          <div className="flex-1" />
          <button
            onClick={handleCopyInput}
            disabled={!text}
            className="focus-ring inline-flex items-center gap-1.5 text-sm text-ink-soft dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark px-2 py-2 disabled:opacity-40"
          >
            {copiedInput ? <Check size={15} /> : <Copy size={15} />}
            Copy
          </button>
          <button
            onClick={handleClear}
            disabled={!text && !translation}
            className="focus-ring inline-flex items-center gap-1.5 text-sm text-ink-soft dark:text-ink-dark/60 hover:text-vermilion px-2 py-2 disabled:opacity-40"
          >
            <Trash2 size={15} />
            Clear
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 text-sm text-vermilion bg-vermilion/10 border border-vermilion/20 rounded-lg p-4">
          <p className="font-medium">เกิดข้อผิดพลาด</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && !translation && (
        <div className="mt-6 flex items-center gap-2 text-sm text-ink-soft dark:text-ink-dark/60">
          <Loader2 size={16} className="animate-spin text-ai-600" />
          กำลังแปลข้อความด้วย Gemini...
        </div>
      )}

      {/* Phase 1: Translation Output Display */}
      {translation && (
        <div className="mt-6 border border-line dark:border-line-dark rounded-lg bg-paper dark:bg-paper-dark overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-line dark:border-line-dark bg-ai-50/50 dark:bg-ai-700/10">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide font-medium text-ai-700 dark:text-ai-300">
                {translation.sourceLanguage}
              </span>
              <ArrowRight size={13} className="text-ink-soft dark:text-ink-dark/40" />
              <span className="text-xs uppercase tracking-wide font-medium text-ai-700 dark:text-ai-300">
                {translation.targetLanguage}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyOutput}
                className="focus-ring inline-flex items-center gap-1.5 text-xs text-ink-soft dark:text-ink-dark/60 hover:text-ai-600 dark:hover:text-ai-300 rounded px-2.5 py-1 transition-colors"
              >
                {copiedOutput ? <Check size={13} /> : <Copy size={13} />}
                {copiedOutput ? "Copied" : "Copy Translation"}
              </button>
            </div>
          </div>

          {/* Translation Body */}
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs text-ink-soft dark:text-ink-dark/50 mb-1">คำแปลภาษาไทย:</p>
              <p className="text-xl sm:text-2xl text-ink dark:text-ink-dark font-medium leading-relaxed">
                {translation.translatedText}
              </p>
            </div>

            <div className="pt-3 border-t border-line dark:border-line-dark">
              <p className="text-xs text-ink-soft dark:text-ink-dark/50 mb-1">ข้อความต้นฉบับ:</p>
              <p
                className={
                  translation.sourceLanguage === "Japanese"
                    ? "font-jp text-base text-ink-soft dark:text-ink-dark/80"
                    : "text-base text-ink-soft dark:text-ink-dark/80"
                }
              >
                {translation.originalText}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={handleSaveText}
                className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded border border-ai-300 dark:border-ai-500 text-ai-700 dark:text-ai-100 px-3.5 py-2 hover:bg-ai-50 dark:hover:bg-ai-700/20 transition-colors"
              >
                <BookmarkPlus size={14} />
                {savedTextSuccess ? "บันทึกข้อความแล้ว ✓" : "บันทึกข้อความ (Save Text)"}
              </button>

              <button
                onClick={handleAddFlashcardFromTranslation}
                className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded border border-vermilion/40 text-vermilion px-3.5 py-2 hover:bg-vermilion/10 transition-colors"
              >
                <Layers size={14} />
                {savedCard ? "เพิ่มลง Flashcards แล้ว ✓" : "สร้าง Flashcard"}
              </button>

              <button
                onClick={runDeepVocabularyExplanation}
                disabled={loadingVocab || !!vocabResult}
                className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium rounded bg-ai-600 text-white px-3.5 py-2 hover:bg-ai-700 disabled:opacity-50 transition-colors"
              >
                {loadingVocab ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {vocabResult
                  ? "วิเคราะห์คำศัพท์เรียบร้อย"
                  : "วิเคราะห์คำศัพท์และไวยากรณ์เชิงลึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Vocabulary & Grammar Result (When requested) */}
      {vocabResult && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wide text-ink-soft dark:text-ink-dark/50">
              การวิเคราะห์คำศัพท์และไวยากรณ์ (Detailed Breakdown)
            </h2>
          </div>
          <ResultCard
            result={vocabResult}
            onSaveVocabulary={handleSaveVocabResult}
            onAddFlashcard={handleAddFlashcardFromVocabResult}
            savedVocabulary={savedVocab}
            savedFlashcard={savedCard}
          />
        </div>
      )}

      {showSaveModal && translation && (
        <SaveModal
          word={translation.originalText}
          onSaveText={handleSaveText}
          onAddFlashcard={handleAddFlashcardFromTranslation}
          onReject={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
