import { z } from "zod";

export const SourceLanguageEnum = z.enum(["Japanese", "English"]);
export type SourceLanguageType = z.infer<typeof SourceLanguageEnum>;

export const SourceLanguageChoiceEnum = z.enum(["Japanese", "English", "auto"]);
export type SourceLanguageChoiceType = z.infer<typeof SourceLanguageChoiceEnum>;

export const TargetLanguageEnum = z.literal("Thai");
export type TargetLanguageType = z.infer<typeof TargetLanguageEnum>;

export const TranslationTaskEnum = z.enum(["translation", "vocabulary"]);
export type TranslationTaskType = z.infer<typeof TranslationTaskEnum>;

/**
 * Request schema for POST /api/translate
 * Supports both new standard contract (sourceLanguage, targetLanguage, task)
 * and backward-compatible legacy payload (language).
 */
export const TranslationRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "กรุณาป้อนข้อความที่ต้องการแปล")
      .max(4000, "ข้อความยาวเกินไป (สูงสุด 4000 ตัวอักษร)"),
    sourceLanguage: SourceLanguageChoiceEnum.optional(),
    language: SourceLanguageChoiceEnum.optional(),
    targetLanguage: TargetLanguageEnum.optional().default("Thai"),
    task: TranslationTaskEnum.optional().default("translation"),
  })
  .transform((val) => ({
    text: val.text,
    sourceLanguage: (val.sourceLanguage ?? val.language ?? "auto") as SourceLanguageChoiceType,
    targetLanguage: val.targetLanguage,
    task: val.task,
  }));

export type TranslationRequestInput = z.input<typeof TranslationRequestSchema>;
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

/**
 * Structured response from Gemini model for translation
 */
export const ModelTranslationOutputSchema = z.object({
  originalText: z.string(),
  translatedText: z.string().min(1, "ผลลัพธ์การแปลว่างเปล่า"),
  sourceLanguage: SourceLanguageEnum,
  targetLanguage: TargetLanguageEnum.default("Thai"),
});

export type ModelTranslationOutput = z.infer<typeof ModelTranslationOutputSchema>;

/**
 * Phase 2: AI Vocabulary & Grammar Schemas
 */
export const KanjiBreakdownSchema = z.object({
  kanji: z.string(),
  reading: z.string(),
  meaning: z.string(),
});
export type KanjiBreakdownType = z.infer<typeof KanjiBreakdownSchema>;

export const ExampleSentenceSchema = z.object({
  original: z.string(),
  reading: z.string().default(""),
  translation: z.string(),
});
export type ExampleSentenceType = z.infer<typeof ExampleSentenceSchema>;

export const RelatedWordSchema = z.object({
  word: z.string(),
  reading: z.string().nullable().optional(),
  meaning: z.string(),
  kanjiBreakdown: z.array(KanjiBreakdownSchema).nullable().optional(),
  examples: z.array(ExampleSentenceSchema).nullable().optional(),
});
export type RelatedWordType = z.infer<typeof RelatedWordSchema>;

export const GrammarPointSchema = z.object({
  structure: z.string(),
  meaning: z.string(),
  conditions: z.string().nullable().optional(),
  examples: z.array(ExampleSentenceSchema).default([]),
  comparison: z.string().nullable().optional(),
});
export type GrammarPointType = z.infer<typeof GrammarPointSchema>;

export const VocabularyResultSchema = z.object({
  sourceLanguage: SourceLanguageEnum,
  word: z.string().min(1, "ไม่มีคำศัพท์"),
  reading: z.string().nullable().optional(),
  partOfSpeech: z.string().nullable().optional(),
  meaning: z.array(z.string()).min(1, "ไม่มีความหมาย"),
  explanation: z.string().default(""),
  usageNote: z.string().nullable().optional(),
  kanjiBreakdown: z.array(KanjiBreakdownSchema).nullable().optional(),
  relatedWords: z.array(RelatedWordSchema).default([]),
  examples: z.array(ExampleSentenceSchema).default([]),
  grammarPoints: z.array(GrammarPointSchema).nullable().optional(),
  uncertain: z.boolean().nullable().optional(),
});
export type VocabularyResultType = z.infer<typeof VocabularyResultSchema>;

/**
 * Standard successful response data contract
 */
export const TranslationDataSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(),
  sourceLanguage: SourceLanguageEnum,
  targetLanguage: TargetLanguageEnum,
  detectedLanguage: SourceLanguageEnum.optional(),
  vocabularyDetails: VocabularyResultSchema.optional(),
});

export type TranslationData = z.infer<typeof TranslationDataSchema>;

export const TranslationSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: TranslationDataSchema,
  // backward-compatibility field for older components expecting { result }
  result: z.unknown().optional(),
});

export type TranslationSuccessResponse = z.infer<typeof TranslationSuccessResponseSchema>;

export const TranslationErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type TranslationErrorResponse = z.infer<typeof TranslationErrorResponseSchema>;

export const TranslationApiResponseSchema = z.union([
  TranslationSuccessResponseSchema,
  TranslationErrorResponseSchema,
]);

export type TranslationApiResponse = z.infer<typeof TranslationApiResponseSchema>;
