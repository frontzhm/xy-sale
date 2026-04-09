import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PHOTOS_DIR, STORAGE_ROOT } from "./keys";

export function getStorageRootAbs(): string {
  return path.join(process.cwd(), STORAGE_ROOT);
}

export function getPhotosDirAbs(): string {
  return path.join(getStorageRootAbs(), PHOTOS_DIR);
}

/** 返回文件名（仅 basename），文件位于 storage/photos/ */
export async function savePhotoBuffer(
  buffer: Buffer,
  originalName: string
): Promise<{ fileName: string; mimeType: string }> {
  const ext = path.extname(originalName).slice(0, 8) || ".bin";
  const safeExt = /^\.[a-zA-Z0-9]+$/.test(ext) ? ext : ".bin";
  const id = randomUUID();
  const fileName = `${id}${safeExt}`;
  const dir = getPhotosDirAbs();
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, fileName);
  await writeFile(abs, buffer);

  const mimeType = guessMimeFromExt(safeExt);
  return { fileName, mimeType };
}

export function guessMimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".gif") return "image/gif";
  if (e === ".webp") return "image/webp";
  if (e === ".heic") return "image/heic";
  return "application/octet-stream";
}

/** 可选：内容哈希去重（后续接入） */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
