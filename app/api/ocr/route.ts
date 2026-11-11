import { NextRequest, NextResponse } from "next/server";
import {
  GeminiConfigError,
  GeminiTimeoutError,
  extractTextFromImage,
} from "@/lib/gemini";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "คำขอไม่ถูกต้อง (ต้องส่งข้อมูลเป็น multipart/form-data)",
        },
        message: "คำขอไม่ถูกต้อง",
      },
      { status: 400 }
    );
  }

  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "MISSING_IMAGE", message: "กรุณาอัปโหลดหรือเลือกรูปภาพ" },
        message: "กรุณาอัปโหลดหรือเลือกรูปภาพ",
      },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNSUPPORTED_TYPE",
          message: "รองรับเฉพาะไฟล์รูปภาพ JPG, JPEG, PNG และ WEBP เท่านั้น",
        },
        message: "รองรับเฉพาะไฟล์รูปภาพ JPG, JPEG, PNG และ WEBP เท่านั้น",
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 8MB)",
        },
        message: "ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 8MB)",
      },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const text = await extractTextFromImage(base64Data, file.type);

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_TEXT_FOUND",
            message: "ไม่พบข้อความที่อ่านได้ในพื้นที่นี้ ข้อความอาจไม่ชัดเจนหรือไม่มีตัวหนังสือ",
          },
          message: "ไม่พบข้อความที่อ่านได้ในพื้นที่นี้",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      text: text.trim(),
    });
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      console.error("Gemini config error:", err.message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFIG_ERROR",
            message: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน .env.local",
          },
          message: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY",
        },
        { status: 500 }
      );
    }

    if (err instanceof GeminiTimeoutError) {
      console.error("Gemini OCR timeout error:", err.message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TIMEOUT",
            message: "การอ่านข้อความจากรูปภาพใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง",
          },
          message: "การเชื่อมต่อไปยังระบบ OCR ใช้เวลานานเกินกำหนด",
        },
        { status: 504 }
      );
    }

    console.error("OCR API error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "OCR_FAILED",
          message: `ไม่สามารถอ่านข้อความจากรูปภาพได้: ${message}`,
        },
        message: `ไม่สามารถอ่านข้อความจากรูปภาพได้: ${message}`,
      },
      { status: 502 }
    );
  }
}
