import { readFile } from "node:fs/promises";
import path from "node:path";

import { PHOTOS_DIR } from "./keys";
import { getStorageRootAbs } from "./save-file";

const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** fileName 为仅存于 DB 的 basename，如 uuid.jpg */
export async function readPhotoFile(fileName: string): Promise<Buffer> {
  const base = path.basename(fileName);
  if (!SAFE_NAME.test(base) || base !== fileName) {
    throw new Error("Invalid file name");
  }
  const abs = path.join(getStorageRootAbs(), PHOTOS_DIR, base);
  return readFile(abs);
}
