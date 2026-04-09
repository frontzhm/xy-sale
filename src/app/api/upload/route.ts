import { NextResponse } from "next/server";

import { savePhotoBuffer } from "@/lib/storage/save-file";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const { fileName, mimeType } = await savePhotoBuffer(buf, file.name);
  return NextResponse.json({ fileName, mimeType });
}
