import { NextResponse } from "next/server";

import { guessMimeFromExt } from "@/lib/storage/save-file";
import { readPhotoFile } from "@/lib/storage/read-file";

export const runtime = "nodejs";

type Params = { name: string };

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { name } = await context.params;
  const decoded = decodeURIComponent(name);
  try {
    const body = await readPhotoFile(decoded);
    const ext = decoded.includes(".") ? `.${decoded.split(".").pop()}` : "";
    const mime = guessMimeFromExt(ext);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
