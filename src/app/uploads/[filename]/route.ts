import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/upload";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Single dynamic segment, but guard against a decoded "..", "/", or "\" sneaking in anyway.
  if (!filename || /[\\/]/.test(filename) || filename.includes("..")) {
    return new NextResponse(null, { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return new NextResponse(null, { status: 404 });

    const buffer = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // Filenames embed a timestamp + random suffix and are never reused, so a
        // given URL's content never changes — safe to cache indefinitely.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
