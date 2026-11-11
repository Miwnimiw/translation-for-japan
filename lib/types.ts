export type SourceLanguage = "Japanese" | "English";

export interface KanjiBreakdown {
  kanji: string;
  reading: string;
  meaning: string;
}

export interface ExampleSentence {
  original: string;
  reading: string; // hiragana for JP, same as original (or phonetic) for EN
  translation: string; // Thai
}

export interface RelatedWord {
  word: string;
  reading?: string | null;
  meaning: string;
  kanjiBreakdown?: KanjiBreakdown[] | null;
  examples?: ExampleSentence[] | null;
}

export interface GrammarPoint {
  structure: string; // e.g. "V-て + いる" or "have been + V-ing"
  meaning: string; // Meaning in Thai
  conditions?: string | null; // Usage conditions / rules
  examples: ExampleSentence[]; // Natural example sentences
  comparison?: string | null; // Similar grammar comparison / nuances
}

/** Normalized shape returned for vocabulary and teacher explanations. */
export interface TranslationResult {
  sourceLanguage: SourceLanguage;
  word: string;
  reading: string | null; // furigana/hiragana for JP, IPA for EN (nullable if unsure)
  partOfSpeech?: string | null; // e.g. "คำนาม", "คำกริยา", "noun", "verb"
  meaning: string[]; // Thai meanings, most common first
  explanation: string; // Thai explanation of usage/context
  usageNote?: string | null; // register, compound-word note, formality, uncertainty note
  kanjiBreakdown?: KanjiBreakdown[]; // JP only, when word contains kanji
  relatedWords: RelatedWord[];
  examples: ExampleSentence[];
  grammarPoints?: GrammarPoint[]; // Grammar explanation points when applicable
  uncertain?: boolean; // true if the model flagged low confidence
}

export interface VocabularyEntry {
  id: string;
  sourceLanguage: SourceLanguage;
  word: string;
  reading: string | null;
  partOfSpeech?: string | null;
  meaning: string[];
  explanation: string;
  usageNote?: string | null;
  examples: ExampleSentence[];
  relatedWords: RelatedWord[];
  grammarPoints?: GrammarPoint[];
  createdAt: string; // ISO date
}

export interface SavedTextEntry {
  id: string;
  originalText: string;
  reading?: string | null; // Contextual Hiragana reading for Japanese text
  translatedSummary: string; // short Thai summary/translation of the whole text
  result: TranslationResult;
  sourceLanguage: SourceLanguage;
  createdAt: string;
}

export type ReviewStatus = "new" | "known";

export interface FlashcardEntry {
  id: string;
  vocabularyId: string | null; // null if the linked vocabulary was deleted
  word: string;
  reading: string | null;
  meaning: string[];
  explanation: string;
  examples: ExampleSentence[];
  language: SourceLanguage;
  createdAt: string;
  reviewStatus: ReviewStatus;
}

export interface AppSettings {
  defaultLanguage: SourceLanguage;
  theme: "light" | "dark";
}
