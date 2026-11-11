import {
  AppSettings,
  FlashcardEntry,
  SavedTextEntry,
  VocabularyEntry,
} from "./types";

const KEYS = {
  vocabulary: "kotoba.vocabulary.v1",
  savedText: "kotoba.savedText.v1",
  flashcards: "kotoba.flashcards.v1",
  settings: "kotoba.settings.v1",
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: "Japanese",
  theme: "light",
};

function isBrowser() {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted data should never crash the app — fall back silently.
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Storage write failed", key, err);
  }
}

// ---------- Vocabulary ----------

export function getVocabulary(): VocabularyEntry[] {
  return read<VocabularyEntry[]>(KEYS.vocabulary, []);
}

export function saveVocabulary(entry: VocabularyEntry) {
  const all = getVocabulary();
  write(KEYS.vocabulary, [entry, ...all]);
}

export function updateVocabulary(id: string, patch: Partial<VocabularyEntry>) {
  const all = getVocabulary().map((v) => (v.id === id ? { ...v, ...patch } : v));
  write(KEYS.vocabulary, all);
}

/** Deletes a vocabulary entry. Linked flashcards are kept but detached
 *  (vocabularyId set to null) so review history is never destroyed. */
export function deleteVocabulary(id: string) {
  const all = getVocabulary().filter((v) => v.id !== id);
  write(KEYS.vocabulary, all);

  const cards = getFlashcards().map((c) =>
    c.vocabularyId === id ? { ...c, vocabularyId: null } : c
  );
  write(KEYS.flashcards, cards);
}

// ---------- Saved Text ----------

export function getSavedTexts(): SavedTextEntry[] {
  return read<SavedTextEntry[]>(KEYS.savedText, []);
}

export function saveSavedText(entry: SavedTextEntry) {
  const all = getSavedTexts();
  write(KEYS.savedText, [entry, ...all]);
}

export function deleteSavedText(id: string) {
  write(
    KEYS.savedText,
    getSavedTexts().filter((t) => t.id !== id)
  );
}

export function updateSavedText(id: string, patch: Partial<SavedTextEntry>) {
  write(
    KEYS.savedText,
    getSavedTexts().map((t) => (t.id === id ? { ...t, ...patch } : t))
  );
}

// ---------- Flashcards ----------

export function getFlashcards(): FlashcardEntry[] {
  return read<FlashcardEntry[]>(KEYS.flashcards, []);
}

export function addFlashcard(entry: FlashcardEntry) {
  const all = getFlashcards();
  write(KEYS.flashcards, [entry, ...all]);
}

export function deleteFlashcard(id: string) {
  write(
    KEYS.flashcards,
    getFlashcards().filter((c) => c.id !== id)
  );
}

export function updateFlashcard(id: string, patch: Partial<FlashcardEntry>) {
  write(
    KEYS.flashcards,
    getFlashcards().map((c) => (c.id === id ? { ...c, ...patch } : c))
  );
}

// ---------- Settings ----------

export function getSettings(): AppSettings {
  return read<AppSettings>(KEYS.settings, DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings) {
  write(KEYS.settings, settings);
}

// ---------- Danger zone ----------

export function clearAllData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEYS.vocabulary);
  window.localStorage.removeItem(KEYS.savedText);
  window.localStorage.removeItem(KEYS.flashcards);
  // settings are intentionally preserved
}
