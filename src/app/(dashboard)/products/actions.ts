"use server";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { savePhotoBuffer } from "@/lib/storage/save-file";

/** Prisma 交互式事务内的 client 形态 */
type DbTx = Pick<
  typeof prisma,
  "product" | "productSku" | "orderLine" | "shipmentLine" | "inboundLine" | "manufacturer"
>;

/** 无连字符 UUID，冲突概率可忽略；若撞唯一约束会重试 */
function generateProductCode(): string {
  return randomUUID().replace(/-/g, "");
}

export type ProductFormState = { error: string } | null;

type SkuRefTx = Pick<typeof prisma, "orderLine" | "shipmentLine" | "inboundLine">;

async function skuReferenceCount(tx: SkuRefTx, skuId: string): Promise<number> {
  const [o, s, i] = await Promise.all([
    tx.orderLine.count({ where: { skuId } }),
    tx.shipmentLine.count({ where: { skuId } }),
    tx.inboundLine.count({ where: { skuId } }),
  ]);
  return o + s + i;
}

function parseOptionalDecimal(
  raw: string | null,
  label: string,
): { ok: true; value: Prisma.Decimal | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  try {
    const d = new Prisma.Decimal(s);
    if (d.isNaN()) return { ok: false, error: `${label}格式不正确` };
    return { ok: true, value: d };
  } catch {
    return { ok: false, error: `${label}格式不正确` };
  }
}

type SkuPayload = { id?: string; color: string; size: string };

function parseSkusJson(raw: string): { ok: true; skus: SkuPayload[] } | { ok: false; error: string } {
  try {
    const skus = JSON.parse(raw) as SkuPayload[];
    if (!Array.isArray(skus)) return { ok: false, error: "SKU 数据格式错误。" };
    return { ok: true, skus };
  } catch {
    return { ok: false, error: "SKU 数据格式错误。" };
  }
}

export type NormalizedSkuRow = { id?: string; color: string; size: string };

function normalizeSkuPayloads(
  skus: SkuPayload[],
):
  | { ok: false; error: string }
  | { ok: true; normalized: NormalizedSkuRow[] } {
  const normalized: NormalizedSkuRow[] = skus
    .map((r) => ({
      id: r.id?.trim() || undefined,
      color: String(r.color ?? "").trim(),
      size: String(r.size ?? "").trim(),
    }))
    .filter((r) => r.color && r.size);

  const keySet = new Set<string>();
  for (const r of normalized) {
    const k = `${r.color}\0${r.size}`;
    if (keySet.has(k)) {
      return { ok: false, error: `重复的 SKU：${r.color} / ${r.size}` };
    }
    keySet.add(k);
  }
  return { ok: true, normalized };
}

async function createProductCore(formData: FormData): Promise<ProductFormState> {
  const nameInbound = String(formData.get("nameInbound") ?? "").trim();
  const nameManufacturer = String(formData.get("nameManufacturer") ?? "").trim();
  const materialRaw = String(formData.get("material") ?? "").trim();
  const material = materialRaw === "" ? null : materialRaw;

  const manufacturerIdExisting = String(formData.get("manufacturerId") ?? "").trim();
  const newManufacturerName = String(formData.get("newManufacturerName") ?? "").trim();

  let manufacturerId = manufacturerIdExisting;
  if (newManufacturerName) {
    const m = await prisma.manufacturer.create({ data: { name: newManufacturerName } });
    manufacturerId = m.id;
  }

  if (!manufacturerId) {
    return { error: "请选择已有厂家，或填写新厂家名称。" };
  }

  if (!nameInbound) {
    return { error: "请填写入库登记名称。" };
  }

  const skusParsed = parseSkusJson(String(formData.get("skusJson") ?? "[]"));
  if (!skusParsed.ok) return { error: skusParsed.error };
  const normCreate = normalizeSkuPayloads(skusParsed.skus);
  if (!normCreate.ok) return { error: normCreate.error };
  const { normalized } = normCreate;

  const image = formData.get("image");
  let imageFileName: string | null = null;
  let imageMimeType: string | null = null;
  if (image instanceof File && image.size > 0) {
    const buf = Buffer.from(await image.arrayBuffer());
    const saved = await savePhotoBuffer(buf, image.name);
    imageFileName = saved.fileName;
    imageMimeType = saved.mimeType;
  }

  const costPriceR = parseOptionalDecimal(String(formData.get("costPrice") ?? ""), "成本价");
  if (!costPriceR.ok) return { error: costPriceR.error };
  const wholesalePriceR = parseOptionalDecimal(String(formData.get("wholesalePrice") ?? ""), "批发价");
  if (!wholesalePriceR.ok) return { error: wholesalePriceR.error };
  const retailPriceR = parseOptionalDecimal(String(formData.get("retailPrice") ?? ""), "零售价");
  if (!retailPriceR.ok) return { error: retailPriceR.error };
  const costPrice = costPriceR.value;
  const wholesalePrice = wholesalePriceR.value;
  const retailPrice = retailPriceR.value;

  let saved = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateProductCode();
    try {
      await prisma.$transaction(async (tx: DbTx) => {
        await tx.product.create({
          data: {
            code,
            nameInbound,
            nameManufacturer,
            material,
            costPrice,
            wholesalePrice,
            retailPrice,
            imageFileName,
            imageMimeType,
            manufacturerId,
            ...(normalized.length > 0
              ? {
                  skus: {
                    create: normalized.map((r) => ({ color: r.color, size: r.size })),
                  },
                }
              : {}),
          },
        });
      });
      saved = true;
      break;
    } catch (e: unknown) {
      const isUnique =
        e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
      if (isUnique && attempt < 7) continue;
      console.error(e);
      return { error: "保存失败，请稍后重试。" };
    }
  }

  if (!saved) {
    return { error: "保存时与已有档案冲突，请重试。" };
  }

  return null;
}

/** 列表页抽屉等场景：保存后不 redirect，仅刷新数据 */
export async function createProductInline(formData: FormData): Promise<ProductFormState> {
  const r = await createProductCore(formData);
  if (r) return r;
  revalidatePath("/products");
  return null;
}

export async function deleteProductInline(
  productId: string,
): Promise<{ error?: string }> {
  const id = String(productId ?? "").trim();
  if (!id) return { error: "缺少档案 ID。" };

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      skus: { select: { id: true } },
    },
  });
  if (!product) return { error: "档案不存在。" };

  const skuIds = product.skus.map((s) => s.id);
  if (skuIds.length > 0) {
    const [o, s, i] = await Promise.all([
      prisma.orderLine.count({ where: { skuId: { in: skuIds } } }),
      prisma.shipmentLine.count({ where: { skuId: { in: skuIds } } }),
      prisma.inboundLine.count({ where: { skuId: { in: skuIds } } }),
    ]);
    if (o + s + i > 0) {
      return { error: "该档案已有订货/发货/入库记录引用，暂不可删除。" };
    }
  }

  try {
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    return { error: "删除失败，请稍后重试。" };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath(`/products/${id}/edit`);
  return {};
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const r = await createProductCore(formData);
  if (r) return r;
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) {
    return { error: "缺少档案 ID。" };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) {
    return { error: "档案不存在。" };
  }

  const nameInbound = String(formData.get("nameInbound") ?? "").trim();
  const nameManufacturer = String(formData.get("nameManufacturer") ?? "").trim();
  const materialRaw = String(formData.get("material") ?? "").trim();
  const material = materialRaw === "" ? null : materialRaw;

  const manufacturerIdExisting = String(formData.get("manufacturerId") ?? "").trim();
  const newManufacturerName = String(formData.get("newManufacturerName") ?? "").trim();

  let manufacturerId = manufacturerIdExisting;
  if (newManufacturerName) {
    const m = await prisma.manufacturer.create({ data: { name: newManufacturerName } });
    manufacturerId = m.id;
  }

  if (!manufacturerId) {
    return { error: "请选择已有厂家，或填写新厂家名称。" };
  }

  if (!nameInbound) {
    return { error: "请填写入库登记名称。" };
  }

  const skusParsed = parseSkusJson(String(formData.get("skusJson") ?? "[]"));
  if (!skusParsed.ok) return { error: skusParsed.error };
  const norm = normalizeSkuPayloads(skusParsed.skus);
  if (!norm.ok) return { error: norm.error };
  const { normalized } = norm;

  const image = formData.get("image");
  let imageFileName: string | null | undefined = undefined;
  let imageMimeType: string | null | undefined = undefined;
  if (image instanceof File && image.size > 0) {
    const buf = Buffer.from(await image.arrayBuffer());
    const saved = await savePhotoBuffer(buf, image.name);
    imageFileName = saved.fileName;
    imageMimeType = saved.mimeType;
  }

  const costPriceR = parseOptionalDecimal(String(formData.get("costPrice") ?? ""), "成本价");
  if (!costPriceR.ok) return { error: costPriceR.error };
  const wholesalePriceR = parseOptionalDecimal(String(formData.get("wholesalePrice") ?? ""), "批发价");
  if (!wholesalePriceR.ok) return { error: wholesalePriceR.error };
  const retailPriceR = parseOptionalDecimal(String(formData.get("retailPrice") ?? ""), "零售价");
  if (!retailPriceR.ok) return { error: retailPriceR.error };
  const costPrice = costPriceR.value;
  const wholesalePrice = wholesalePriceR.value;
  const retailPrice = retailPriceR.value;

  try {
    await prisma.$transaction(async (tx: DbTx) => {
      const existingSkus = await tx.productSku.findMany({
        where: { productId },
        select: { id: true },
      });
      const existingIds = new Set<string>(existingSkus.map((s: { id: string }) => s.id));

      const formSkuIds = new Set<string>(
        normalized.filter((r) => r.id && existingIds.has(r.id)).map((r) => r.id!),
      );

      for (const id of existingIds) {
        if (formSkuIds.has(id)) continue;
        const refs = await skuReferenceCount(tx, id);
        if (refs > 0) {
          throw new Error("SKU_REFERENCED");
        }
        await tx.productSku.delete({ where: { id } });
      }

      for (const row of normalized) {
        if (row.id && existingIds.has(row.id)) {
          await tx.productSku.update({
            where: { id: row.id },
            data: { color: row.color, size: row.size },
          });
        } else {
          await tx.productSku.create({
            data: {
              productId,
              color: row.color,
              size: row.size,
            },
          });
        }
      }

      const updateData: Prisma.ProductUpdateInput = {
        nameInbound,
        nameManufacturer,
        material,
        costPrice,
        wholesalePrice,
        retailPrice,
        manufacturer: { connect: { id: manufacturerId } },
      };
      if (imageFileName !== undefined) {
        updateData.imageFileName = imageFileName;
        updateData.imageMimeType = imageMimeType ?? null;
      }

      await tx.product.update({
        where: { id: productId },
        data: updateData,
      });
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "SKU_REFERENCED") {
      return { error: "部分 SKU 已被订货/发货/入库单据引用，无法从档案中删除。可修改颜色尺码，或保留该行。" };
    }
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return { error: "SKU 颜色+尺码组合与现有记录冲突。" };
    }
    console.error(e);
    return { error: "保存失败，请稍后重试。" };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
  redirect(`/products/${productId}`);
}
