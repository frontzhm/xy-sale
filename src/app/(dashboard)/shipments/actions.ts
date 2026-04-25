"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { savePhotoBuffer } from "@/lib/storage/save-file";

export type ShipmentFormState = { error: string } | null;

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
      return { ok: false, error: "请至少添加一行有效的发货明细（SKU + 件数）。" };
    }
    return { ok: true, lines };
  } catch {
    return { ok: false, error: "明细格式错误。" };
  }
}

async function createShipmentCore(formData: FormData): Promise<ShipmentFormState> {
  const manufacturerIdExisting = String(formData.get("manufacturerId") ?? "").trim();
  const newManufacturerName = String(formData.get("newManufacturerName") ?? "").trim();

  let manufacturerId: string | null = manufacturerIdExisting || null;
  if (newManufacturerName) {
    const m = await prisma.manufacturer.create({ data: { name: newManufacturerName } });
    manufacturerId = m.id;
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
    recordedAt = new Date();
  }

  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  const photoMimeTypeFromUrlRaw = String(formData.get("photoMimeType") ?? "").trim();
  const photoMimeTypeFromUrl = photoMimeTypeFromUrlRaw === "" ? null : photoMimeTypeFromUrlRaw;
  let fileName = "";
  let mimeType = "application/octet-stream";
  if (photoUrl) {
    fileName = photoUrl;
    mimeType = photoMimeTypeFromUrl ?? "application/octet-stream";
  } else {
    const image = formData.get("photo");
    if (!(image instanceof File) || image.size === 0) {
      return { error: "请上传发货照片。" };
    }
    const buf = Buffer.from(await image.arrayBuffer());
    const saved = await savePhotoBuffer(buf, image.name);
    fileName = saved.fileName;
    mimeType = saved.mimeType;
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
    await prisma.shipmentRecord.create({
      data: {
        manufacturerId,
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

  return null;
}

export async function createShipmentInline(formData: FormData): Promise<ShipmentFormState> {
  const r = await createShipmentCore(formData);
  if (r) return r;
  revalidatePath("/shipments");
  return null;
}

export async function createShipment(
  _prev: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  const r = await createShipmentCore(formData);
  if (r) return r;
  revalidatePath("/shipments");
  redirect("/shipments");
}

export async function updateShipment(
  _prev: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  const recordId = String(formData.get("recordId") ?? "").trim();
  if (!recordId) {
    return { error: "缺少发货记录 ID。" };
  }

  const existing = await prisma.shipmentRecord.findUnique({
    where: { id: recordId },
    select: { id: true, recordedAt: true, photoFileName: true, photoMimeType: true },
  });
  if (!existing) {
    return { error: "记录不存在。" };
  }

  const manufacturerIdExisting = String(formData.get("manufacturerId") ?? "").trim();
  const newManufacturerName = String(formData.get("newManufacturerName") ?? "").trim();

  let manufacturerId: string | null = manufacturerIdExisting || null;
  if (newManufacturerName) {
    const m = await prisma.manufacturer.create({ data: { name: newManufacturerName } });
    manufacturerId = m.id;
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
      await tx.shipmentLine.deleteMany({ where: { recordId } });
      await tx.shipmentRecord.update({
        where: { id: recordId },
        data: {
          manufacturerId,
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

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${recordId}`);
  revalidatePath(`/shipments/${recordId}/edit`);
  redirect(`/shipments/${recordId}`);
}
