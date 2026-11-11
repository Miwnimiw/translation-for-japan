import { NextRequest, NextResponse } from "next/server";
import {
  GeminiConfigError,
  GeminiTimeoutError,
  GeminiTranslationError,
  translateCore,
  translateText,
} from "@/lib/gemini";
import {
  TranslationErrorResponse,
  TranslationRequestSchema,
  TranslationSuccessResponse,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const errorResponse: TranslationErrorResponse = {
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "คำขอไม่ถูกต้อง (Invalid JSON Body)",
      },
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  // Validate with Zod
  const parseResult = TranslationRequestSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    const errorResponse: TranslationErrorResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: firstIssue?.message || "ข้อมูลคำขอไม่ถูกต้อง",
      },
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const { text, sourceLanguage, targetLanguage, task } = parseResult.data;

  try {
    if (task === "vocabulary") {
      // Phase 2: Detailed vocabulary & teacher explanation
      const vocabResult = await translateText(text, sourceLanguage);
      const successResponse: TranslationSuccessResponse = {
        success: true,
        data: {
          originalText: vocabResult.word || text,
          translatedText: vocabResult.meaning.join(", "),
          sourceLanguage: vocabResult.sourceLanguage,
          targetLanguage: "Thai",
          vocabularyDetails: vocabResult,
        },
        result: vocabResult,
      };
      return NextResponse.json(successResponse);
    }

    // Phase 1: Pure Translation Core
    const translationOutput = await translateCore(text, sourceLanguage, targetLanguage);
    const successResponse: TranslationSuccessResponse = {
      success: true,
      data: {
        originalText: translationOutput.originalText,
        translatedText: translationOutput.translatedText,
        sourceLanguage: translationOutput.sourceLanguage,
        targetLanguage: translationOutput.targetLanguage,
      },
      // Backward-compatible result field for legacy components
      result: {
        sourceLanguage: translationOutput.sourceLanguage,
        word: translationOutput.originalText,
        reading: null,
        meaning: [translationOutput.translatedText],
        explanation: "",
        examples: [],
        relatedWords: [],
      },
    };
    return NextResponse.json(successResponse);
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      console.error("Gemini config error:", err.message);
      const errorResponse: TranslationErrorResponse = {
        success: false,
        error: {
          code: "CONFIG_ERROR",
          message: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตรวจสอบไฟล์ .env.local",
        },
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (err instanceof GeminiTimeoutError) {
      console.error("Gemini timeout error:", err.message);
      const errorResponse: TranslationErrorResponse = {
        success: false,
        error: {
          code: "TIMEOUT",
          message: err.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 504 });
    }

    if (err instanceof GeminiTranslationError) {
      console.error("Gemini translation error:", err.message);
      const errorResponse: TranslationErrorResponse = {
        success: false,
        error: {
          code: "TRANSLATION_FAILED",
          message: err.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 502 });
    }

    console.error("Unexpected translate API error:", err);
    const rawMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    // Provide friendly messages for common Gemini API errors
    let userMessage = `ไม่สามารถแปลข้อความได้: ${rawMessage}`;
    let errorCode = "TRANSLATION_FAILED";

    if (rawMessage.includes("API_KEY_INVALID") || rawMessage.includes("API key not valid")) {
      userMessage = "API Key ของ Gemini ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบใน .env.local";
      errorCode = "INVALID_API_KEY";
    } else if (rawMessage.includes("404") || rawMessage.includes("not found")) {
      userMessage = "ไม่พบโมเดล Gemini ที่ระบุในระบบ กรุณาตรวจสอบค่า GEMINI_MODEL ใน .env.local";
      errorCode = "MODEL_NOT_FOUND";
    } else if (rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("quota")) {
      userMessage = "โควตาการเรียกใช้งาน Gemini API เต็มแล้ว กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";
      errorCode = "QUOTA_EXCEEDED";
    }

    const errorResponse: TranslationErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: userMessage,
      },
    };
    return NextResponse.json(errorResponse, { status: 502 });
  }
}
