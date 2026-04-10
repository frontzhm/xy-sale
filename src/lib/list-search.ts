import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  ManufacturerRollup,
  ProductReconciliationRow,
  SkuReconciliationRow,
} from "@/lib/reports/reconciliation";

export function trimSearchQ(q: string | null | undefined): string {
  return q?.trim() ?? "";
}

/** Prisma `where` 多条件 AND（显式泛型，避免首参收窄类型） */
export function mergeWhereAnd<T>(...parts: (T | undefined)[]): T | undefined {
  const f = parts.filter((x): x is T => x !== undefined);
  if (f.length === 0) return undefined;
  if (f.length === 1) return f[0];
  return { AND: f } as T;
}

export function productListWhereFromQ(q: string): Prisma.ProductWhereInput | undefined {
  const t = trimSearchQ(q);
  if (!t) return undefined;
  return {
    OR: [
      { code: { contains: t } },
      { nameInbound: { contains: t } },
      { nameManufacturer: { contains: t } },
      { manufacturer: { name: { contains: t } } },
    ],
  };
}

/** 衣服档案 ProTable：入库名模糊 + 厂家 id + 材质模糊（AND） */
export function productListWhereFromTableFilters(input: {
  nameInbound?: string | null | undefined;
  manufacturerId?: string | null | undefined;
  material?: string | null | undefined;
}): Prisma.ProductWhereInput | undefined {
  const parts: Prisma.ProductWhereInput[] = [];
  const ni = trimSearchQ(input.nameInbound);
  if (ni) parts.push({ nameInbound: { contains: ni } });
  const mid = trimSearchQ(input.manufacturerId);
  if (mid) parts.push({ manufacturerId: mid });
  const mat = trimSearchQ(input.material);
  if (mat) parts.push({ material: { contains: mat } });
  if (parts.length === 0) return undefined;
  return { AND: parts };
}

export async function orderListWhereFromQ(q: string): Promise<Prisma.OrderWhereInput | undefined> {
  const t = trimSearchQ(q);
  if (!t) return undefined;

  const mfrs = await prisma.manufacturer.findMany({
    where: { name: { contains: t } },
    select: { id: true },
  });
  const mfrIds = mfrs.map((m) => m.id);

  const productOr: Prisma.ProductWhereInput[] = [
    { code: { contains: t } },
    { nameInbound: { contains: t } },
    { nameManufacturer: { contains: t } },
  ];

  return {
    OR: [
      { note: { contains: t } },
      ...(mfrIds.length > 0 ? [{ manufacturerId: { in: mfrIds } }] : []),
      {
        lines: {
          some: {
            sku: {
              product: { OR: productOr },
            },
          },
        },
      },
    ],
  };
}

export function shipmentListWhereFromQ(q: string): Prisma.ShipmentRecordWhereInput | undefined {
  const t = trimSearchQ(q);
  if (!t) return undefined;

  const productOr: Prisma.ProductWhereInput[] = [
    { code: { contains: t } },
    { nameInbound: { contains: t } },
    { nameManufacturer: { contains: t } },
  ];

  return {
    OR: [
      { note: { contains: t } },
      { manufacturer: { name: { contains: t } } },
      {
        lines: {
          some: {
            sku: {
              product: { OR: productOr },
            },
          },
        },
      },
    ],
  };
}

export function inboundListWhereFromQ(q: string): Prisma.InboundRecordWhereInput | undefined {
  const t = trimSearchQ(q);
  if (!t) return undefined;

  const productOr: Prisma.ProductWhereInput[] = [
    { code: { contains: t } },
    { nameInbound: { contains: t } },
    { nameManufacturer: { contains: t } },
  ];

  return {
    OR: [
      { note: { contains: t } },
      {
        lines: {
          some: {
            sku: {
              product: { OR: productOr },
            },
          },
        },
      },
    ],
  };
}

export function filterManufacturerRollupByQ(rows: ManufacturerRollup[], q: string): ManufacturerRollup[] {
  const t = trimSearchQ(q).toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(t));
}

export function filterProductRollupByQ(rows: ProductReconciliationRow[], q: string): ProductReconciliationRow[] {
  const t = trimSearchQ(q).toLowerCase();
  if (!t) return rows;
  return rows.filter((p) => {
    const blob = `${p.manufacturerName} ${p.productCode} ${p.nameInbound} ${p.nameManufacturer}`.toLowerCase();
    return blob.includes(t);
  });
}

export function filterSkuReconciliationRowsByQ(rows: SkuReconciliationRow[], q: string): SkuReconciliationRow[] {
  const t = trimSearchQ(q).toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => {
    const blob = [
      r.manufacturerName,
      r.productCode,
      r.nameInbound,
      r.nameManufacturer,
      r.color,
      r.size,
      ...r.flags,
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(t);
  });
}
