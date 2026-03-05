import { mkdir } from "node:fs/promises";
import path from "node:path";

export const MAX_POSTER_UPLOAD_BYTES = 8 * 1024 * 1024;

export function getUploadsRootDir() {
  return path.resolve(process.cwd(), "uploads");
}

export function getPosterUploadsDir() {
  return path.join(getUploadsRootDir(), "posters");
}

export async function ensurePosterUploadsDir() {
  await mkdir(getPosterUploadsDir(), { recursive: true });
}

export function isSafePosterFilename(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

export function extFromMimeType(mimeType: string): string | null {
  const normalized = mimeType.toLowerCase().trim();
  switch (normalized) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

export function contentTypeFromPosterExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
