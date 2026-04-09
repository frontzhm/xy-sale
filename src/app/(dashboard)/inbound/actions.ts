"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { savePhotoBuffer } from "@/lib/storage/save-file";

export type InboundFormState = { error: string } | null;

type LinePayload = { skuId: string; quantity: number };

function parseLinesJson(raw: string): { ok: true; lines: LinePayload[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { ok: false, error: "明细格式错误。" };
    const lines: LinePayload[] = [];
    const seenSku = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const skuId = String((item as { skuId?: string }).skuId ?? "").trim();
      const q = Number((item as { quantity?: unknown }).quantity);
      if (!skuId || !Number.isInteger(q) || q <= 0) continue;
      if (seenSku.has(skuId)) {
        return { ok: false, error: "同一 SKU 不能重复添加，请合并数量。" };
      }
      seenSku.add(skuId);
      lines.push({ skuId, quantity: q });
    }
    if (lines.length === 0) {
      return { ok: false, error: "请至少添加一行有效的入库明细（SKU + 件数）。" };
    }
    return { ok: true, lines };
  } catch {
    return { ok: false, error: "明细格式错误。" };
  }
}

export async function createInbound(
  _prev: InboundFormState,
  formData: FormData
): Promise<InboundFormState> {
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw === "" ? null : noteRaw;

  const recordedAtRaw = String(formData.get("recordedAt") ?? "").trim();
  let recordedAt: Date;
  if (recordedAtRaw) {
    const d = new Date(recordedAtRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "登记时间格式无效。" };
    }
    recordedAt = d;
  } else {
    recordedAt = new Date();
  }

  const image = formData.get("photo");
  if (!(image instanceof File) || image.size === 0) {
    return { error: "请上传入库照片。" };
  }

  const buf = Buffer.from(await image.arrayBuffer());
  const { fileName, mimeType } = await savePhotoBuffer(buf, image.name);

  const linesParsed = parseLinesJson(String(formData.get("linesJson") ?? "[]"));
  if (!linesParsed.ok) return { error: linesParsed.error };
  const { lines } = linesParsed;

  const skuIds = lines.map((l) => l.skuId);
  const skus = await prisma.productSku.findMany({
    where: { id: { in: skuIds } },
    select: { id: true },
  });
  if (skus.length !== skuIds.length) {
    return { error: "部分 SKU 不存在，请刷新页面后重试。" };
  }

  try {
    await prisma.inboundRecord.create({
      data: {
        photoFileName: fileName,
        photoMimeType: mimeType,
        note,
        recordedAt,
        lines: {
          create: lines.map((l) => ({
            skuId: l.skuId,
            quantity: l.quantity,
          })),
        },
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "保存失败，请稍后重试。" };
  }

  revalidatePath("/inbound");
  redirect("/inbound");
}

export async function updateInbound(
  _prev: InboundFormState,
  formData: FormData
): Promise<InboundFormState> {
  const recordId = String(formData.get("recordId") ?? "").trim();
  if (!recordId) {
    return { error: "缺少入库记录 ID。" };
  }

  const existing = await prisma.inboundRecord.findUnique({
    where: { id: recordId },
    select: { id: true, recordedAt: true, photoFileName: true, photoMimeType: true },
  });
  if (!existing) {
    return { error: "记录不存在。" };
  }

  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw === "" ? null : noteRaw;

  const recordedAtRaw = String(formData.get("recordedAt") ?? "").trim();
  let recordedAt: Date;
  if (recordedAtRaw) {
    const d = new Date(recordedAtRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "登记时间格式无效。" };
    }
    recordedAt = d;
  } else {
    recordedAt = existing.recordedAt;
  }

  const image = formData.get("photo");
  let photoFileName = existing.photoFileName;
  let photoMimeType = existing.photoMimeType;
  if (image instanceof File && image.size > 0) {
    const buf = Buffer.from(await image.arrayBuffer());
    const saved = await savePhotoBuffer(buf, image.name);
    photoFileName = saved.fileName;
    photoMimeType = saved.mimeType;
  }

  const linesParsed = parseLinesJson(String(formData.get("linesJson") ?? "[]"));
  if (!linesParsed.ok) return { error: linesParsed.error };
  const { lines } = linesParsed;

  const skuIds = lines.map((l) => l.skuId);
  const skus = await prisma.productSku.findMany({
    where: { id: { in: skuIds } },
    select: { id: true },
  });
  if (skus.length !== skuIds.length) {
    return { error: "部分 SKU 不存在，请刷新页面后重试。" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.inboundLine.deleteMany({ where: { recordId } });
      await tx.inboundRecord.update({
        where: { id: recordId },
        data: {
          photoFileName,
          photoMimeType,
          note,
          recordedAt,
          lines: {
            create: lines.map((l) => ({
              skuId: l.skuId,
              quantity: l.quantity,
            })),
          },
        },
      });
    });
  } catch (e) {
    console.error(e);
    return { error: "保存失败，请稍后重试。" };
  }

  revalidatePath("/inbound");
  revalidatePath(`/inbound/${recordId}`);
  revalidatePath(`/inbound/${recordId}/edit`);
  redirect(`/inbound/${recordId}`);
}
