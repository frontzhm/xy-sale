"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { savePhotoBuffer } from "@/lib/storage/save-file";

export type InboundFormState = { error: string } | null;

type LinePayload = {
  skuId?: string;
  productName?: string;
  color?: string;
  size?: string;
  quantity: number;
};

function parseLinesJson(raw: string): { ok: true; lines: LinePayload[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { ok: false, error: "明细格式错误。" };
    const lines: LinePayload[] = [];
    const seenKey = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const skuId = String((item as { skuId?: string }).skuId ?? "").trim();
      const productName = String((item as { productName?: string }).productName ?? "").trim();
      const color = String((item as { color?: string }).color ?? "").trim();
      const size = String((item as { size?: string }).size ?? "").trim();
      const q = Number((item as { quantity?: unknown }).quantity);
      if (!Number.isInteger(q) || q <= 0) continue;
      const canUseSku = !!skuId;
      const canUseName = !!(productName && color);
      if (!canUseSku && !canUseName) continue;
      const key = canUseSku ? `sku:${skuId}` : `name:${productName}\0${color}\0${size}`;
      if (seenKey.has(key)) {
        return { ok: false, error: "同一明细不能重复添加，请合并数量。" };
      }
      seenKey.add(key);
      lines.push({
        skuId: canUseSku ? skuId : undefined,
        productName: canUseName ? productName : undefined,
        color: canUseName ? color : undefined,
        size: canUseName ? size : undefined,
        quantity: q,
      });
    }
    if (lines.length === 0) {
      return { ok: false, error: "请至少添加一行有效的入库明细（衣服名称+颜色+件数）。" };
    }
    return { ok: true, lines };
  } catch {
    return { ok: false, error: "明细格式错误。" };
  }
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

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

async function existsInboundBatch(batchNoRaw: string): Promise<boolean> {
  const target = normalizeBatchNo(batchNoRaw);
  if (!target) return false;
  const rows = await prisma.inboundRecord.findMany({
    where: { note: { contains: "批次" } },
    select: { note: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return rows.some((r) => extractBatchNoFromNote(r.note) === target);
}

async function resolveOrCreateInboundSkuId(args: {
  line: LinePayload;
}): Promise<{ ok: true; skuId: string } | { ok: false; error: string }> {
  const { line } = args;
  if (line.skuId) {
    const sku = await prisma.productSku.findUnique({ where: { id: line.skuId }, select: { id: true } });
    if (!sku) return { ok: false, error: "部分 SKU 不存在，请刷新页面后重试。" };
    return { ok: true, skuId: sku.id };
  }

  const productName = normalizeName(line.productName ?? "");
  const color = normalizeName(line.color ?? "");
  const size = normalizeName(line.size ?? "");
  if (!productName || !color) {
    return { ok: false, error: "明细缺少衣服名称或颜色。" };
  }

  let product = await prisma.product.findFirst({
    where: {
      OR: [{ nameInbound: productName }, { nameManufacturer: productName }],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!product) {
    const m = await prisma.manufacturer.create({ data: { name: productName } });
    product = await prisma.product.create({
      data: {
        code: randomUUID().replace(/-/g, ""),
        nameInbound: productName,
        nameManufacturer: productName,
        manufacturerId: m.id,
      },
      select: { id: true },
    });
  }

  const sku = await prisma.productSku.upsert({
    where: {
      productId_color_size: { productId: product.id, color, size },
    },
    create: { productId: product.id, color, size },
    update: {},
    select: { id: true },
  });
  return { ok: true, skuId: sku.id };
}

async function createInboundCore(formData: FormData): Promise<InboundFormState> {
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw === "" ? null : noteRaw;
  const batchNo = extractBatchNoFromNote(note);
  if (batchNo) {
    const duplicated = await existsInboundBatch(batchNo);
    if (duplicated) {
      return { error: "该批次已登记，请勿重复提交。" };
    }
  }

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

  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  const photoMimeTypeFromUrlRaw = String(formData.get("photoMimeType") ?? "").trim();
  const photoMimeTypeFromUrl = photoMimeTypeFromUrlRaw === "" ? null : photoMimeTypeFromUrlRaw;
  let photos: Array<{ fileName: string; mimeType: string }> = [];
  if (photoUrl) {
    photos = [{ fileName: photoUrl, mimeType: photoMimeTypeFromUrl ?? "application/octet-stream" }];
  } else {
    const files = formData
      .getAll("photo")
      .filter((x): x is File => x instanceof File && x.size > 0);
    if (files.length === 0) {
      return { error: "请上传入库照片。" };
    }
    photos = await Promise.all(
      files.map(async (image) => {
        const buf = Buffer.from(await image.arrayBuffer());
        const saved = await savePhotoBuffer(buf, image.name);
        return { fileName: saved.fileName, mimeType: saved.mimeType };
      }),
    );
  }

  const linesParsed = parseLinesJson(String(formData.get("linesJson") ?? "[]"));
  if (!linesParsed.ok) return { error: linesParsed.error };
  const { lines } = linesParsed;

  const resolved: { skuId: string; quantity: number }[] = [];
  for (const line of lines) {
    const r = await resolveOrCreateInboundSkuId({ line });
    if (!r.ok) return { error: r.error };
    resolved.push({ skuId: r.skuId, quantity: line.quantity });
  }

  try {
    await prisma.$transaction(
      photos.map((p) =>
        prisma.inboundRecord.create({
          data: {
            photoFileName: p.fileName,
            photoMimeType: p.mimeType,
            note,
            recordedAt,
            lines: {
              create: resolved.map((l) => ({
                skuId: l.skuId,
                quantity: l.quantity,
              })),
            },
          },
        }),
      ),
    );
  } catch (e) {
    console.error(e);
    return { error: "保存失败，请稍后重试。" };
  }

  return null;
}

/** 列表页抽屉等：保存后不 redirect */
export async function createInboundInline(formData: FormData): Promise<InboundFormState> {
  const r = await createInboundCore(formData);
  if (r) return r;
  revalidatePath("/inbound");
  return null;
}

export async function deleteInboundInline(
  recordId: string,
): Promise<{ error?: string }> {
  const id = String(recordId ?? "").trim();
  if (!id) return { error: "缺少入库记录 ID。" };

  try {
    await prisma.inboundRecord.delete({
      where: { id },
    });
  } catch (e) {
    console.error(e);
    return { error: "删除失败，请稍后重试。" };
  }

  revalidatePath("/inbound");
  revalidatePath(`/inbound/${id}`);
  revalidatePath(`/inbound/${id}/edit`);
  return {};
}

export async function createInbound(
  _prev: InboundFormState,
  formData: FormData
): Promise<InboundFormState> {
  const r = await createInboundCore(formData);
  if (r) return r;
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

  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  const photoMimeTypeFromUrlRaw = String(formData.get("photoMimeType") ?? "").trim();
  const photoMimeTypeFromUrl = photoMimeTypeFromUrlRaw === "" ? null : photoMimeTypeFromUrlRaw;
  const image = formData.get("photo");
  let photoFileName = existing.photoFileName;
  let photoMimeType = existing.photoMimeType;
  if (photoUrl) {
    photoFileName = photoUrl;
    photoMimeType = photoMimeTypeFromUrl ?? "application/octet-stream";
  } else if (image instanceof File && image.size > 0) {
    const buf = Buffer.from(await image.arrayBuffer());
    const saved = await savePhotoBuffer(buf, image.name);
    photoFileName = saved.fileName;
    photoMimeType = saved.mimeType;
  }

  const linesParsed = parseLinesJson(String(formData.get("linesJson") ?? "[]"));
  if (!linesParsed.ok) return { error: linesParsed.error };
  const { lines } = linesParsed;

  const resolved: { skuId: string; quantity: number }[] = [];
  for (const line of lines) {
    const r = await resolveOrCreateInboundSkuId({ line });
    if (!r.ok) return { error: r.error };
    resolved.push({ skuId: r.skuId, quantity: line.quantity });
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
            create: resolved.map((l) => ({
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
