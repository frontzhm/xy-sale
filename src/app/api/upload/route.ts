import { NextResponse } from "next/server";

import { parseImageWithMoonshot } from "@/lib/ai/moonshot-image-parse";
import { prisma } from "@/lib/prisma";
import { uploadImageToOss } from "@/lib/storage/oss";

export const runtime = "nodejs";

function normalizeBatchNo(v: string): string {
  return v.trim().replace(/\s+/g, "").toLowerCase();
}

function extractBatchNoFromNote(note: string | null): string | null {
  if (!note) return null;
  const m = note.match(/批次[:：]\s*([^\n\r]+)/);
  if (!m?.[1]) return null;
  const n = normalizeBatchNo(m[1]);
  return n || null;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "缺少 file 字段" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: "文件为空" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "仅支持图片文件上传" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadImageToOss(buf, file.name, file.type || null);
    const modeRaw = String(searchParams.get("mode") ?? form.get("mode") ?? "")
      .trim()
      .toLowerCase();
    const mode = modeRaw === "shipment" ? "shipment" : modeRaw === "inbound" ? "inbound" : null;
    const imageDataUrl = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
    let ai = null;
    let aiError: string | null = null;
    let duplicateShipment: { id: string; recordedAt: string } | null = null;
    let duplicateInbound: { id: string; recordedAt: string } | null = null;
    if (mode) {
      try {
        ai = await parseImageWithMoonshot({
          imageUrl: uploaded.url,
          imageDataUrl,
          mode,
        });
        if (mode === "shipment") {
          const orderNo = String(ai?.orderNo ?? "").trim();
          if (orderNo) {
            const duplicated = await prisma.shipmentRecord.findFirst({
              where: {
                note: { contains: `单号：${orderNo}` },
              },
              select: { id: true, recordedAt: true },
              orderBy: { createdAt: "desc" },
            });
            if (duplicated) {
              duplicateShipment = {
                id: duplicated.id,
                recordedAt: duplicated.recordedAt.toISOString(),
              };
            }
          }
        }
        if (mode === "inbound") {
          const batchNo = String(ai?.batchNo ?? "").trim();
          if (batchNo) {
            const target = normalizeBatchNo(batchNo);
            const candidates = await prisma.inboundRecord.findMany({
              where: {
                note: { contains: "批次" },
              },
              select: { id: true, recordedAt: true, note: true },
              orderBy: { createdAt: "desc" },
              take: 300,
            });
            const duplicated = candidates.find((r) => extractBatchNoFromNote(r.note) === target);
            if (duplicated) {
              duplicateInbound = {
                id: duplicated.id,
                recordedAt: duplicated.recordedAt.toISOString(),
              };
            }
          }
        }
      } catch (error) {
        console.error("moonshot parse error:", error);
        aiError = error instanceof Error ? error.message : String(error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...uploaded,
        ai,
        aiError,
        duplicateShipment,
        duplicateInbound,
      },
    });
  } catch (error) {
    console.error("upload image error:", error);
    return NextResponse.json({ success: false, error: "上传失败，请稍后重试。" }, { status: 500 });
  }
}
