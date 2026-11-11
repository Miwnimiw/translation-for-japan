import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SourceLanguage, TranslationResult } from "./types";
import {
  ModelTranslationOutput,
  ModelTranslationOutputSchema,
  SourceLanguageChoiceType,
} from "./schemas";

// Server-only. Never import this file from a "use client" component.
const apiKey = process.env.GEMINI_API_KEY;

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
export const DEFAULT_TIMEOUT_MS = 25000; // 25 seconds timeout

export class GeminiConfigError extends Error { }
export class GeminiTimeoutError extends Error { }
export class GeminiTranslationError extends Error { }

export function getClient() {
  const key = process.env.GEMINI_API_KEY || apiKey;
  if (!key) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }
  return new GoogleGenerativeAI(key);
}

export function getGeminiModel(options?: {
  modelName?: string;
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
}) {
  const genAI = getClient();
  return genAI.getGenerativeModel({
    model: options?.modelName || GEMINI_MODEL,
    systemInstruction: options?.systemInstruction,
    generationConfig: options?.generationConfig,
  });
}

/**
 * Execute an async operation with a strict timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  operationName = "Gemini API"
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new GeminiTimeoutError(
          `การเชื่อมต่อไปยัง ${operationName} ใช้เวลานานเกินกำหนด (${timeoutMs / 1000} วินาที)`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// -------------------------------------------------------------
// Phase 1: Pure Translation Core
// -------------------------------------------------------------

const TRANSLATION_SYSTEM_INSTRUCTION = `You are a professional, highly skilled Japanese and English to Thai translator.
Your mission is to provide accurate, natural, and context-appropriate Thai translations for Thai learners and readers.

Rules:
1. Translate faithfully and accurately based on linguistic and situational context.
2. Produce smooth, natural Thai expressions — avoid awkward literal or word-by-word translations when an idiomatic phrasing is more natural.
3. Support all input formats: single words, short phrases, full sentences, multi-sentence paragraphs, and longer passages.
4. If sourceLanguage is set to "auto", automatically identify whether the source text is Japanese or English.
5. If the source is Japanese:
   - Understand nuances of honorifics (Keigo), polite forms (Desu/Masu), and casual speech, conveying the equivalent register in Thai appropriately.
   - Accurately capture nuances of particles and verb conjugations.
6. If the source is English:
   - Handle idioms, phrasal verbs, and tenses accurately in Thai.
7. NEVER return an empty translation string.
8. Output ONLY valid JSON matching the specified schema. No markdown wrapping, no commentary, no quotes around the JSON.`;

const translationResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    originalText: { type: SchemaType.STRING },
    translatedText: { type: SchemaType.STRING },
    sourceLanguage: { type: SchemaType.STRING, enum: ["Japanese", "English"] },
    targetLanguage: { type: SchemaType.STRING, enum: ["Thai"] },
  },
  required: ["originalText", "translatedText", "sourceLanguage", "targetLanguage"],
} as const;

function buildTranslationPrompt(
  text: string,
  sourceLanguage: SourceLanguageChoiceType,
  targetLanguage = "Thai"
): string {
  const langHint =
    sourceLanguage === "auto"
      ? "Auto-detect whether the input text is Japanese or English, and specify in sourceLanguage."
      : `The source text is ${sourceLanguage}. Set sourceLanguage to "${sourceLanguage}".`;

  return `${langHint}
Target language is strictly ${targetLanguage}.

Translate the following input text accurately into natural Thai:
"""
${text}
"""`;
}

/**
 * Phase 1 Core Translation Function
 * Translates Japanese or English text into Thai.
 */
export async function translateCore(
  text: string,
  sourceLanguage: SourceLanguageChoiceType = "auto",
  targetLanguage: "Thai" = "Thai",
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ModelTranslationOutput> {
  const model = getGeminiModel({
    systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: translationResponseSchema as any,
      temperature: 0.2,
    },
  });

  const prompt = buildTranslationPrompt(text, sourceLanguage, targetLanguage);
  const response = await withTimeout(
    model.generateContent(prompt),
    timeoutMs,
    "ระบบแปลภาษา Gemini"
  );

  const raw = response.response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiTranslationError(
      "Gemini ส่งข้อมูลกลับมาในรูปแบบที่ไม่ถูกต้อง (Invalid JSON format)"
    );
  }

  const validation = ModelTranslationOutputSchema.safeParse(parsed);
  if (!validation.success) {
    // If the model missed originalText, patch it from input
    if (parsed && typeof parsed === "object" && "translatedText" in parsed) {
      const p = parsed as Record<string, unknown>;
      const patched = {
        originalText: String(p.originalText || text),
        translatedText: String(p.translatedText || ""),
        sourceLanguage: p.sourceLanguage === "English" ? "English" : "Japanese",
        targetLanguage: "Thai" as const,
      };
      const retryValidation = ModelTranslationOutputSchema.safeParse(patched);
      if (retryValidation.success) {
        return retryValidation.data;
      }
    }
    throw new GeminiTranslationError(
      `ข้อมูลการแปลไม่ครบถ้วน: ${validation.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  return validation.data;
}

// -------------------------------------------------------------
// Phase 2: Vocabulary & Teacher Explanation Schema & Function
// (Preserved for compatibility and vocabulary learning)
// -------------------------------------------------------------

const VOCAB_SYSTEM_INSTRUCTION = `You are an expert Japanese and English language teacher who specializes in explaining vocabulary to Thai-speaking learners.

Your job:
- Act as a patient, precise language teacher for a Thai-speaking student.
- Analyze the meaning of the given word, phrase, or sentence IN CONTEXT — never give an out-of-context, literal-only gloss when context changes the meaning.
- Explain usage naturally, the way a native speaker would actually use it.
- For Japanese: prioritize reading accuracy. Give the reading (furigana/hiragana) for the word AS IT IS ACTUALLY READ in that context — never read kanji character-by-character in isolation if that is not how the compound is pronounced. If the word commonly appears only as part of a compound (not alone), say so explicitly and give real compound examples, breaking down each kanji's contribution to the compound's meaning.
- For English: give part of speech, IPA pronunciation when useful, and synonyms/related words.
- Distinguish literal meaning from contextual/idiomatic meaning when they differ.
- Indicate register when relevant: spoken, formal, written, literary, slang, business, etc.
- Example sentences must be natural, native-sounding sentences — never awkward or artificial constructions.
- If multiple meanings exist, order them from most common to least common.
- NEVER fabricate a meaning, reading, or example you are not confident about. If you are not sure about a reading or meaning, explicitly set "uncertain": true and say so in the "usageNote" field in Thai, rather than guessing.
- All explanations, meanings, and notes must be written in Thai (ภาษาไทย), since the learner is a Thai speaker. Only the target-language word, readings, and example sentences stay in their original language.
- Respond ONLY with JSON matching the provided schema. No markdown, no commentary, no code fences.`;

const vocabResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    sourceLanguage: { type: SchemaType.STRING, enum: ["Japanese", "English"] },
    word: { type: SchemaType.STRING },
    reading: { type: SchemaType.STRING, nullable: true },
    partOfSpeech: { type: SchemaType.STRING, nullable: true },
    meaning: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    explanation: { type: SchemaType.STRING },
    usageNote: { type: SchemaType.STRING, nullable: true },
    uncertain: { type: SchemaType.BOOLEAN, nullable: true },
    kanjiBreakdown: {
      type: SchemaType.ARRAY,
      nullable: true,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          kanji: { type: SchemaType.STRING },
          reading: { type: SchemaType.STRING },
          meaning: { type: SchemaType.STRING },
        },
        required: ["kanji", "reading", "meaning"],
      },
    },
    relatedWords: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          word: { type: SchemaType.STRING },
          reading: { type: SchemaType.STRING, nullable: true },
          meaning: { type: SchemaType.STRING },
          kanjiBreakdown: {
            type: SchemaType.ARRAY,
            nullable: true,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                kanji: { type: SchemaType.STRING },
                reading: { type: SchemaType.STRING },
                meaning: { type: SchemaType.STRING },
              },
              required: ["kanji", "reading", "meaning"],
            },
          },
          examples: {
            type: SchemaType.ARRAY,
            nullable: true,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                original: { type: SchemaType.STRING },
                reading: { type: SchemaType.STRING },
                translation: { type: SchemaType.STRING },
              },
              required: ["original", "reading", "translation"],
            },
          },
        },
        required: ["word", "meaning"],
      },
    },
    examples: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          original: { type: SchemaType.STRING },
          reading: { type: SchemaType.STRING },
          translation: { type: SchemaType.STRING },
        },
        required: ["original", "reading", "translation"],
      },
    },
    grammarPoints: {
      type: SchemaType.ARRAY,
      nullable: true,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          structure: { type: SchemaType.STRING },
          meaning: { type: SchemaType.STRING },
          conditions: { type: SchemaType.STRING, nullable: true },
          comparison: { type: SchemaType.STRING, nullable: true },
          examples: {
            type: SchemaType.ARRAY,
            nullable: true,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                original: { type: SchemaType.STRING },
                reading: { type: SchemaType.STRING },
                translation: { type: SchemaType.STRING },
              },
              required: ["original", "reading", "translation"],
            },
          },
        },
        required: ["structure", "meaning"],
      },
    },
  },
  required: ["sourceLanguage", "word", "meaning", "explanation", "examples", "relatedWords"],
} as const;

function buildVocabPrompt(text: string, language: SourceLanguage | "auto") {
  const languageHint =
    language === "auto"
      ? "Detect whether the input is primarily Japanese or English, and set sourceLanguage accordingly."
      : `The input language is ${language}. Set sourceLanguage to "${language}".`;

  return `${languageHint}

Explain the following text for a Thai-speaking learner, following the system instructions and JSON schema exactly. If the input is a full sentence rather than a single word, treat "word" as the sentence itself, still provide "reading" (full reading for Japanese), and populate "relatedWords" with 2-5 key vocabulary items from the sentence worth learning, each with its own reading, meaning, and kanji breakdown where relevant.

Input text:
"""
${text}
"""`;
}

function parseVocabModelJson(raw: string): TranslationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiTranslationError("Gemini ส่งข้อมูลกลับมาในรูปแบบที่ไม่ถูกต้อง (invalid JSON)");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("word" in parsed) ||
    !("meaning" in parsed)
  ) {
    throw new GeminiTranslationError("Gemini ส่งข้อมูลกลับมาไม่ครบตามรูปแบบที่กำหนด");
  }

  const p = parsed as Record<string, unknown>;
  const result: TranslationResult = {
    sourceLanguage: p.sourceLanguage === "Japanese" ? "Japanese" : "English",
    word: String(p.word ?? ""),
    reading: typeof p.reading === "string" ? p.reading : null,
    partOfSpeech: typeof p.partOfSpeech === "string" ? p.partOfSpeech : null,
    meaning: Array.isArray(p.meaning) ? p.meaning.map(String) : [],
    explanation: typeof p.explanation === "string" ? p.explanation : "",
    usageNote: typeof p.usageNote === "string" ? p.usageNote : null,
    kanjiBreakdown: Array.isArray(p.kanjiBreakdown) ? (p.kanjiBreakdown as any) : undefined,
    relatedWords: Array.isArray(p.relatedWords) ? (p.relatedWords as any) : [],
    examples: Array.isArray(p.examples) ? (p.examples as any) : [],
    grammarPoints: Array.isArray(p.grammarPoints) ? (p.grammarPoints as any) : undefined,
    uncertain: Boolean(p.uncertain),
  };

  if (!result.word || result.meaning.length === 0) {
    throw new GeminiTranslationError("ผลลัพธ์จาก Gemini ไม่สมบูรณ์ ไม่มีคำศัพท์หรือความหมาย");
  }

  return result;
}

export async function translateText(
  text: string,
  language: SourceLanguage | "auto",
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<TranslationResult> {
  const model = getGeminiModel({
    systemInstruction: VOCAB_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: vocabResponseSchema as any,
      temperature: 0.3,
    },
  });

  const prompt = buildVocabPrompt(text, language);
  const result = await withTimeout(
    model.generateContent(prompt),
    timeoutMs,
    "ระบบอธิบายคำศัพท์ Gemini"
  );
  const raw = result.response.text();
  return parseVocabModelJson(raw);
}

// -------------------------------------------------------------
// Phase 3: OCR Text Extraction
// -------------------------------------------------------------

export async function extractTextFromImage(
  base64Data: string,
  mimeType: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const model = getGeminiModel();

  const ocrSystemPrompt = `You are a precision Optical Character Recognition (OCR) engine.
Your task is to transcribe all visible text from the image region with maximum fidelity.

Rules:
1. Accurately transcribe Japanese (Kanji, Hiragana, Katakana), English, and Thai characters.
2. Preserve original line breaks, paragraph structure, spacing, and punctuation marks exactly as they appear.
3. DO NOT translate the text into Thai or any other language.
4. DO NOT summarize, correct, rephrase, or add any notes, headers, or markdown formatting fences.
5. If the image contains no readable text or is unclear, respond with an empty string. Never guess, invent, or hallucinate words.
6. Output ONLY the raw transcribed text.`;

  const result = await withTimeout(
    model.generateContent([
      { text: ocrSystemPrompt },
      { inlineData: { data: base64Data, mimeType } },
    ]),
    timeoutMs,
    "ระบบ OCR Gemini"
  );

  return result.response.text().trim();
}
