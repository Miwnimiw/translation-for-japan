# 言葉 Kotoba — Japanese & English → Thai Learning App

A full-stack Next.js app that translates Japanese and English into Thai using the
**Google Gemini API**, explains vocabulary the way a language teacher would (readings,
kanji breakdowns, usage notes, natural example sentences), reads text out of images
(OCR), and lets you save words and review them as flashcards — all stored locally in
your browser.

## 1. Tech stack

- **Next.js 14 (App Router) + React 18 + TypeScript**
- **Tailwind CSS**
- **Google Gemini API** (`@google/generative-ai`, model `gemini-2.0-flash`) — called
  only from server-side API routes
- **Lucide Icons**
- **localStorage** for vocabulary, saved text, flashcards and settings (no backend DB)

## 2. Setup

### Requirements
- Node.js 18.18+ (Node 20 LTS recommended)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Install & run

```bash
npm install
cp .env.local.example .env.local
# open .env.local and paste your real key:
#   GEMINI_API_KEY=AIza...
npm run dev
```

Open http://localhost:3000.

### API key security

- The key lives **only** in `.env.local` (git-ignored) and is read with
  `process.env.GEMINI_API_KEY` inside server-only files: `lib/gemini.ts` and the three
  route handlers under `app/api/*/route.ts`.
- It is **never** sent to the browser: it is not prefixed `NEXT_PUBLIC_`, not imported
  into any `"use client"` component, and the Settings page only shows a connectivity
  status (`connected` / `disconnected`), never the key value.
- All client → server calls go through `/api/translate`, `/api/ocr`, and `/api/status`,
  which validate input before calling Gemini.

## 3. Architecture

```
app/
  layout.tsx            Root shell: fonts, theme bootstrap, sidebar
  page.tsx               Home / Dashboard
  translation/page.tsx   Translation UI
  ocr/page.tsx            Text Extractor + OCR UI
  saved/page.tsx          Saved Text browser
  flashcards/page.tsx     Flashcard review
  settings/page.tsx       Settings
  api/
    translate/route.ts   POST { text, language } -> TranslationResult (JSON)
    ocr/route.ts          POST FormData(image) -> { text }
    status/route.ts       GET -> { connected }

components/
  Sidebar.tsx            Left nav (desktop) / bottom nav (mobile)
  ResultCard.tsx         Renders a TranslationResult (meanings, kanji, examples, related words)
  SaveModal.tsx          "Translation Completed" confirm popup (Save Text / Add to Flashcards / Reject)
  FlashcardView.tsx      Flip card (front/back)

lib/
  gemini.ts              Gemini client, system instruction, JSON schema, parsing/validation
  storage.ts              localStorage CRUD for vocabulary / savedText / flashcards / settings
  types.ts                 Shared TypeScript types
  id.ts                    Unique ID generator
```

### Data flow

1. User submits text (typed, pasted, or OCR-extracted) from Translation or OCR page.
2. Client calls `POST /api/translate` with `{ text, language }`.
3. The route calls `lib/gemini.ts#translateText`, which sends a **system instruction**
   (an expert JP/EN teacher writing for a Thai learner) plus a **strict JSON schema**
   to Gemini (`responseMimeType: "application/json"`), so the model is constrained to
   return structured data — not free text.
4. The response is parsed and defensively validated (`parseModelJson`) before being
   sent back to the client; malformed JSON or missing fields produce a clear Thai
   error message instead of crashing the UI.
5. The result renders in `ResultCard`. The user decides what to keep — **nothing is
   saved automatically**. They can:
   - **Save Vocabulary** — stores the full entry in `vocabulary`
   - **Add to Flashcards** — also creates a linked `flashcard` entry
   - **Save Text** (via the post-translation popup) — stores the original text + result
     in `savedText`
   - **Reject** — closes the popup, saves nothing, and never deletes existing data

### Data relationships & integrity

Deleting a `VocabularyEntry` does **not** delete flashcards that were created from it —
`deleteVocabulary` in `lib/storage.ts` detaches the link (`flashcard.vocabularyId =
null`) instead, so review history and progress are preserved even if the source word is
removed.

## 4. Features checklist

- [x] Translation page: language toggle (auto/Japanese/English), text or selection
      translation, Translate / Clear / Copy, loading + error states, empty-input guard
- [x] Japanese output: reading (furigana/hiragana used in context, not per-kanji),
      meanings ordered by frequency, usage/register notes, kanji breakdown, compound
      "related words" with their own breakdown + examples, natural example sentences
      with hiragana + Thai translation
- [x] English output: part of speech, meaning(s) by context, synonyms/related words,
      example sentence + Thai translation
- [x] Text Extractor mode (paste/type/edit) and OCR mode (image upload, JPG/JPEG/PNG/WEBP,
      preview, Gemini multimodal extraction, editable result) — kept as a separate step
      from translation, with an explicit "Translate this text?" confirmation popup
      (Translate / Cancel / Edit Text)
- [x] Save system: Save Text / Save Vocabulary / Add to Flashcards / Reject, always
      user-initiated
- [x] Saved Text page: list, search, filter by language, open full detail, edit, delete,
      copy, add to flashcards — persisted in localStorage across refreshes/restarts
- [x] Flashcards: flip front/back, Next/Previous, Shuffle, Show/Hide Furigana, Mark as
      Known, Delete, progress bar + counts, category filter (Japanese/English/All)
- [x] Dashboard: counts, recent vocabulary, quick links
- [x] Settings: default language, light/dark theme, Gemini connection check (key never
      shown), clear-all-data with confirmation
- [x] Responsive (mobile bottom nav / desktop sidebar), light & dark mode

## 5. Testing it yourself

This environment can't run `npm`/a dev server or hit the real Gemini API, so please
verify locally:

```bash
npm run dev
```

Manual pass:
1. **Translation** — try a Japanese word that's usually part of a compound (e.g. 離発),
   a plain English word, and a full sentence; confirm meanings/readings/examples render,
   Copy and Clear work, and an empty submit is blocked.
2. **OCR** — upload a photo of Japanese or English text; confirm extraction, that it
   does *not* auto-translate, that you can edit the text, and that the confirm popup's
   three buttons behave correctly.
3. **Save flow** — save a word, add a flashcard, save a text; reject one result and
   confirm nothing was written (check the Saved Text / Flashcards pages).
4. **Saved Text** — search, filter by language, edit, delete, reopen a full entry.
5. **Flashcards** — flip, navigate, shuffle, toggle furigana, mark known, delete a card,
   switch category filters; refresh the page and confirm everything persisted.
6. **Settings** — switch theme and language, click "Recheck" on the API status, and
   test "Clear All Data" (with confirmation).
7. Resize to a phone width to check the mobile bottom nav and layout.

If a step fails, check the server console (where `npm run dev` is running) — API
errors are logged there, and the UI always surfaces a Thai-language error message
rather than failing silently.

## 6. Notes / limitations

- Storage is per-browser `localStorage`, not an account-based database — data does not
  sync across devices.
- `gemini-2.0-flash` is used for both text and image (multimodal) calls; swap the model
  name in `lib/gemini.ts` if you want to use a different Gemini model.
- The model is explicitly instructed to say when it's unsure rather than guess; such
  results are flagged with `uncertain: true` and shown with a warning banner in the UI.
