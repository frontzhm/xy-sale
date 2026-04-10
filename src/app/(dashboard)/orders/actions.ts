"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export type OrderFormState = { error: string } | null;

type LinePayload = { skuId: string; quantity: number };

async function assertSkusBelongToManufacturer(
  skuIds: string[],
  manufacturerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const skus = await prisma.productSku.findMany({
    where: { id: { in: skuIds } },
    select: {
      id: true,
      product: { select: { manufacturerId: true } },
    },
  });
  if (skus.length !== skuIds.length) {
    return { ok: false, error: "部分 SKU 不存在，请刷新页面后重试。" };
  }
  for (const s of skus) {
    if (s.product.manufacturerId !== manufacturerId) {
      return {
        ok: false,
        error: "明细中存在不属于所选厂家的款式，请更换厂家或调整明细。",
      };
    }
  }
  return { ok: true };
}

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
      return { ok: false, error: "请至少添加一行有效的订货明细（SKU + 件数）。" };
    }
    return { ok: true, lines };
  } catch {
    return { ok: false, error: "明细格式错误。" };
  }
}

async function createOrderCore(formData: FormData): Promise<OrderFormState> {
  const manufacturerId = String(formData.get("manufacturerId") ?? "").trim();
  if (!manufacturerId) {
    return { error: "请选择订货厂家。" };
  }
  const mfr = await prisma.manufacturer.findUnique({ where: { id: manufacturerId } });
  if (!mfr) {
    return { error: "所选厂家不存在，请刷新页面后重试。" };
  }

  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw === "" ? null : noteRaw;

  const linesParsed = parseLinesJson(String(formData.get("linesJson") ?? "[]"));
  if (!linesParsed.ok) return { error: linesParsed.error };
  const { lines } = linesParsed;

  const skuIds = lines.map((l) => l.skuId);
  const skuCheck = await assertSkusBelongToManufacturer(skuIds, manufacturerId);
  if (!skuCheck.ok) return { error: skuCheck.error };

  try {
    await prisma.order.create({
      data: {
        manufacturerId,
        note,
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

export async function createOrderInline(formData: FormData): Promise<OrderFormState> {
  const r = await createOrderCore(formData);
  if (r) return r;
  revalidatePath("/orders");
  revalidatePath("/reports");
  return null;
}

export async function createOrder(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const r = await createOrderCore(formData);
  if (r) return r;
  revalidatePath("/orders");
  revalidatePath("/reports");
  redirect("/orders");
}

export async function updateOrder(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) {
    return { error: "缺少订货单 ID。" };
  }

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!existing) {
    return { error: "订货单不存在。" };
  }

  const manufacturerId = String(formData.get("manufacturerId") ?? "").trim();
  if (!manufacturerId) {
    return { error: "请选择订货厂家。" };
  }
  const mfr = await prisma.manufacturer.findUnique({ where: { id: manufacturerId } });
  if (!mfr) {
    return { error: "所选厂家不存在，请刷新页面后重试。" };
  }

  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw === "" ? null : noteRaw;

  const linesParsed = parseLinesJson(String(formData.get("linesJson") ?? "[]"));
  if (!linesParsed.ok) return { error: linesParsed.error };
  const { lines } = linesParsed;

  const skuIds = lines.map((l) => l.skuId);
  const skuCheck = await assertSkusBelongToManufacturer(skuIds, manufacturerId);
  if (!skuCheck.ok) return { error: skuCheck.error };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderLine.deleteMany({ where: { orderId } });
      await tx.order.update({
        where: { id: orderId },
        data: {
          manufacturerId,
          note,
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

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/edit`);
  revalidatePath("/reports");
  redirect(`/orders/${orderId}`);
}
