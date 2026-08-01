import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function extensionFor(file: File) {
  const fromName = path.extname(file.name || "").toLowerCase();
  if (fromName) return fromName;
  const fromType = file.type.split("/")[1];
  return fromType ? `.${fromType}` : ".jpg";
}

/** Saves an uploaded image to public/uploads and returns its public URL path, or null if no file was given. */
export async function saveUploadedImage(file: File | null, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("শুধুমাত্র JPG, PNG, WEBP, GIF বা AVIF ইমেজ আপলোড করা যাবে");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("ইমেজের সাইজ সর্বোচ্চ ৮MB হতে পারবে");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "upload";
  const filename = `${safePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extensionFor(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/${filename}`;
}

const ICON_MAX_DIMENSION = 128;

/**
 * Saves an uploaded icon, auto-resizing it to a small fixed size so large phone
 * photos don't hurt page performance. SVGs are passed through unchanged (already vector/tiny).
 */
export async function saveUploadedIcon(file: File | null, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("শুধুমাত্র JPG, PNG, WEBP, GIF বা AVIF ইমেজ আপলোড করা যাবে");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("ইমেজের সাইজ সর্বোচ্চ ৮MB হতে পারবে");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "upload";
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "image/svg+xml") {
    const filename = `${safePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.svg`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    return `/uploads/${filename}`;
  }

  const resized = await sharp(buffer)
    .resize(ICON_MAX_DIMENSION, ICON_MAX_DIMENSION, { fit: "contain", withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const filename = `${safePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
  await writeFile(path.join(UPLOAD_DIR, filename), resized);

  return `/uploads/${filename}`;
}

const AVATAR_MAX_DIMENSION = 400;

/**
 * Saves an uploaded profile photo, cropping it to a square and resizing so
 * large phone photos don't hurt page performance. SVGs are rejected since an
 * avatar must be a raster photo.
 */
export async function saveUploadedAvatar(file: File | null, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type) || file.type === "image/svg+xml") {
    throw new Error("শুধুমাত্র JPG, PNG, WEBP বা GIF ইমেজ আপলোড করা যাবে");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("ইমেজের সাইজ সর্বোচ্চ ৮MB হতে পারবে");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "avatar";
  const buffer = Buffer.from(await file.arrayBuffer());

  const resized = await sharp(buffer)
    .rotate()
    .resize(AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${safePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  await writeFile(path.join(UPLOAD_DIR, filename), resized);

  return `/uploads/${filename}`;
}
