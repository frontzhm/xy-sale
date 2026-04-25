import { randomUUID } from "node:crypto";
import path from "node:path";

import OSS from "ali-oss";

type OssConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function readOssConfig(): OssConfig {
  const region = readEnv("ALIOSS_REGION");
  const bucket = readEnv("ALIOSS_BUCKET");
  const accessKeyId = readEnv("ALIOSS_ACCESS_KEY_ID") ?? readEnv("alioss-accessKeyId");
  const accessKeySecret =
    readEnv("ALIOSS_ACCESS_KEY_SECRET") ?? readEnv("alioss-accessKeySecret");
  const endpoint = readEnv("ALIOSS_ENDPOINT");

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error(
      "OSS env missing: ALIOSS_REGION / ALIOSS_BUCKET / ALIOSS_ACCESS_KEY_ID / ALIOSS_ACCESS_KEY_SECRET",
    );
  }

  return {
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    endpoint,
  };
}

let cachedClient: OSS | null = null;

function getOssClient(): OSS {
  if (cachedClient) return cachedClient;
  const cfg = readOssConfig();
  cachedClient = new OSS({
    region: cfg.region,
    bucket: cfg.bucket,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });
  return cachedClient;
}

function extFromName(fileName: string): string {
  const ext = path.extname(fileName).slice(0, 10).toLowerCase();
  return /^\.[a-z0-9]+$/.test(ext) ? ext : "";
}

function guessImageContentType(ext: string): string {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  return "application/octet-stream";
}

export async function uploadImageToOss(
  buffer: Buffer,
  originalName: string,
  mimeType: string | null | undefined,
): Promise<{ fileName: string; url: string; mimeType: string | null }> {
  const client = getOssClient();
  const ext = extFromName(originalName);
  const rawMime = mimeType?.trim().toLowerCase() ?? "";
  const contentType =
    rawMime.startsWith("image/") && rawMime !== "image/*" ? rawMime : guessImageContentType(ext);
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const fileName = `upload/${y}/${m}/${d}/${randomUUID()}${ext}`;

  const result = await client.put(fileName, buffer, {
    mime: contentType,
    headers: {
      "x-oss-object-acl": "public-read",
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    },
  });

  return {
    fileName,
    url: result.url,
    mimeType: contentType,
  };
}
