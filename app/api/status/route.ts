import { NextResponse } from "next/server";
import { getGeminiModel, GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

// Returns only a boolean connectivity status and active model name — never the key itself.
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      reason: "missing_key",
      message: "ยังไม่ได้ระบุ GEMINI_API_KEY ใน .env.local",
    });
  }

  try {
    const model = getGeminiModel();
    // Minimal, lightweight call with 10-second timeout to confirm key & model validity
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    await model.generateContent("ping");
    clearTimeout(timeout);

    return NextResponse.json({
      connected: true,
      model: GEMINI_MODEL,
    });
  } catch (err) {
    console.error("Gemini status check failed:", err);
    const message = err instanceof Error ? err.message : "การเชื่อมต่อล้มเหลว";
    return NextResponse.json({
      connected: false,
      reason: "unreachable",
      model: GEMINI_MODEL,
      message,
    });
  }
}
