import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { moderateFile, moderateImage, applyStrike, checkUserRestrictions } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 150 * 1024 * 1024; // 150MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/mov",
  "video/x-msvideo",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
];

// Map MIME type to file extension
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/mov": "mov",
  "video/x-msvideo": "avi",
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const restrictions = await checkUserRestrictions(session.user.id);
    if (restrictions.banned) {
      return NextResponse.json({ error: "Account bannato" }, { status: 403 });
    }

    let fileData: Buffer;
    let detectedType: string;
    let fileName: string;

    // Check if the request is multipart/form-data (FormData) or JSON (legacy base64)
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // --- FormData/multipart upload (preferred for video) ---
      const formData = await req.formData();
      const fileField = formData.get("file");

      if (!fileField || !(fileField instanceof File)) {
        return NextResponse.json({ error: "File mancante" }, { status: 400 });
      }

      detectedType = fileField.type || "application/octet-stream";
      if (!ALLOWED_TYPES.includes(detectedType)) {
        return NextResponse.json({ error: "Tipo di file non supportato" }, { status: 400 });
      }

      if (fileField.size > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: "File troppo grande (max 150MB)" }, { status: 400 });
      }

      const arrayBuffer = await fileField.arrayBuffer();
      fileData = Buffer.from(arrayBuffer);
      fileName = fileField.name;
    } else {
      // --- Legacy JSON/base64 upload (fallback) ---
      const { file: base64File, contentType: jsonContentType } = await req.json();

      if (!base64File || typeof base64File !== "string") {
        return NextResponse.json({ error: "File mancante" }, { status: 400 });
      }

      detectedType = jsonContentType || "image/jpeg";
      if (!ALLOWED_TYPES.includes(detectedType)) {
        return NextResponse.json({ error: "Tipo di file non supportato" }, { status: 400 });
      }

      const base64Data = base64File.replace(/^data:[^;]+;base64,/, "");
      fileData = Buffer.from(base64Data, "base64");

      if (fileData.length > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: "File troppo grande (max 150MB)" }, { status: 400 });
      }

      fileName = `upload.${MIME_TO_EXT[detectedType] || "bin"}`;
    }

    // Determine file extension
    let ext = MIME_TO_EXT[detectedType];
    if (!ext) ext = detectedType.split("/")[1] || "bin";
    if (ext === "quicktime") ext = "mov";

    const filename = `${uuidv4()}.${ext}`;

    // --- Moderation ---
    const keywordModeration = await moderateFile(filename, detectedType);
    if (keywordModeration.flagged) {
      const result = await applyStrike(session.user.id, keywordModeration.reason || "Contenuto inappropriato");
      return NextResponse.json(
        {
          error: "Contenuto non appropriato rilevato",
          reason: keywordModeration.reason,
          strike: result?.strike,
          banned: !!result?.bannedAt,
        },
        { status: 403 }
      );
    }

    // Moderate images with OpenAI before saving
    if (detectedType.startsWith("image/")) {
      const base64ForModeration = fileData.toString("base64");
      const imageModeration = await moderateImage(`data:${detectedType};base64,${base64ForModeration}`);
      if (imageModeration.flagged) {
        const result = await applyStrike(session.user.id, imageModeration.reason || "Immagine inappropriata");
        return NextResponse.json(
          {
            error: "Immagine non appropriata rilevata",
            reason: imageModeration.reason,
            strike: result?.strike,
            banned: !!result?.bannedAt,
          },
          { status: 403 }
        );
      }
    }

    // --- Write file to disk ---
    const publicDir = join(process.cwd(), "public", "uploads");
    const filepath = join(publicDir, filename);

    await writeFile(filepath, fileData);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Errore nell'upload" }, { status: 500 });
  }
}
