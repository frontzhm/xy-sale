import { prisma } from "@/lib/prisma";

function sumMap(rows: { skuId: string; _sum: { quantity: number | null } }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.skuId, r._sum.quantity ?? 0);
  }
  return m;
}

export type ManufacturerRollup = {
  manufacturerId: string;
  name: string;
  ordered: number;
  shipped: number;
  inbound: number;
  /** 订货 − 发货（>0 表示厂家仍欠发） */
  shortageVsShipped: number;
  /** 发货 − 入库（>0 表示在途或未登记入库） */
  inTransit: number;
};

export type SkuReconciliationRow = {
  skuId: string;
  productId: string;
  manufacturerId: string;
  manufacturerName: string;
  productCode: string;
  nameInbound: string;
  nameManufacturer: string;
  color: string;
  size: string;
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  inTransit: number;
  /** 需人工核对的提示 */
  flags: string[];
};

/** 某件衣服下所有 SKU 的订货/发货/入库合计（与 SKU 行加总一致） */
export type ProductReconciliationRow = {
  productId: string;
  manufacturerId: string;
  manufacturerName: string;
  productCode: string;
  nameInbound: string;
  nameManufacturer: string;
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  inTransit: number;
};

export type ProductSkuMovementRow = {
  skuId: string;
  color: string;
  size: string;
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  inTransit: number;
};

export type ProductDetailReconciliation = {
  totals: {
    ordered: number;
    shipped: number;
    inbound: number;
    shortageVsShipped: number;
    inTransit: number;
  };
  skuRows: ProductSkuMovementRow[];
};

function rollupSkuRowsToProducts(skuRows: SkuReconciliationRow[]): ProductReconciliationRow[] {
  const map = new Map<string, ProductReconciliationRow>();
  for (const r of skuRows) {
    let agg = map.get(r.productId);
    if (!agg) {
      agg = {
        productId: r.productId,
        manufacturerId: r.manufacturerId,
        manufacturerName: r.manufacturerName,
        productCode: r.productCode,
        nameInbound: r.nameInbound,
        nameManufacturer: r.nameManufacturer,
        ordered: 0,
        shipped: 0,
        inbound: 0,
        shortageVsShipped: 0,
        inTransit: 0,
      };
      map.set(r.productId, agg);
    }
    agg.ordered += r.ordered;
    agg.shipped += r.shipped;
    agg.inbound += r.inbound;
  }
  for (const agg of map.values()) {
    agg.shortageVsShipped = agg.ordered - agg.shipped;
    agg.inTransit = agg.shipped - agg.inbound;
  }
  return [...map.values()].sort((a, b) => {
    const m = a.manufacturerName.localeCompare(b.manufacturerName, "zh-CN");
    if (m !== 0) return m;
    return a.productCode.localeCompare(b.productCode, "zh-CN");
  });
}

/** 单款档案页：合计 + 各 SKU 订/发/入/欠发/在途 */
export async function getProductDetailReconciliation(productId: string): Promise<ProductDetailReconciliation | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return null;

  const skus = await prisma.productSku.findMany({
    where: { productId },
    orderBy: [{ color: "asc" }, { size: "asc" }],
    select: { id: true, color: true, size: true },
  });

  if (skus.length === 0) {
    return {
      totals: {
        ordered: 0,
        shipped: 0,
        inbound: 0,
        shortageVsShipped: 0,
        inTransit: 0,
      },
      skuRows: [],
    };
  }

  const skuIds = skus.map((s) => s.id);
  const [orderGroups, shipGroups, inboundGroups] = await Promise.all([
    prisma.orderLine.groupBy({
      by: ["skuId"],
      where: { skuId: { in: skuIds } },
      _sum: { quantity: true },
    }),
    prisma.shipmentLine.groupBy({
      by: ["skuId"],
      where: { skuId: { in: skuIds } },
      _sum: { quantity: true },
    }),
    prisma.inboundLine.groupBy({
      by: ["skuId"],
      where: { skuId: { in: skuIds } },
      _sum: { quantity: true },
    }),
  ]);

  const orderMap = sumMap(orderGroups);
  const shipMap = sumMap(shipGroups);
  const inboundMap = sumMap(inboundGroups);

  let orderedSum = 0;
  let shippedSum = 0;
  let inboundSum = 0;

  const skuRows: ProductSkuMovementRow[] = skus.map((s) => {
    const ordered = orderMap.get(s.id) ?? 0;
    const shipped = shipMap.get(s.id) ?? 0;
    const inbound = inboundMap.get(s.id) ?? 0;
    orderedSum += ordered;
    shippedSum += shipped;
    inboundSum += inbound;
    return {
      skuId: s.id,
      color: s.color,
      size: s.size,
      ordered,
      shipped,
      inbound,
      shortageVsShipped: ordered - shipped,
      inTransit: shipped - inbound,
    };
  });

  return {
    totals: {
      ordered: orderedSum,
      shipped: shippedSum,
      inbound: inboundSum,
      shortageVsShipped: orderedSum - shippedSum,
      inTransit: shippedSum - inboundSum,
    },
    skuRows,
  };
}

/** 聚合订货、厂家发货、入库，用于对账 */
export async function getReconciliationReport(): Promise<{
  byManufacturer: ManufacturerRollup[];
  byProduct: ProductReconciliationRow[];
  skuRows: SkuReconciliationRow[];
  attentionRows: SkuReconciliationRow[];
}> {
  const [orderGroups, shipGroups, inboundGroups, manufacturers] = await Promise.all([
    prisma.orderLine.groupBy({ by: ["skuId"], _sum: { quantity: true } }),
    prisma.shipmentLine.groupBy({ by: ["skuId"], _sum: { quantity: true } }),
    prisma.inboundLine.groupBy({ by: ["skuId"], _sum: { quantity: true } }),
    prisma.manufacturer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const orderMap = sumMap(orderGroups);
  const shipMap = sumMap(shipGroups);
  const inboundMap = sumMap(inboundGroups);

  const skuIds = new Set<string>([
    ...orderMap.keys(),
    ...shipMap.keys(),
    ...inboundMap.keys(),
  ]);

  const skus =
    skuIds.size === 0
      ? []
      : await prisma.productSku.findMany({
          where: { id: { in: [...skuIds] } },
          include: {
            product: {
              select: {
                code: true,
                nameInbound: true,
                nameManufacturer: true,
                manufacturerId: true,
                manufacturer: { select: { name: true } },
              },
            },
          },
        });

  const skuById = new Map(skus.map((s) => [s.id, s]));

  const skuRows: SkuReconciliationRow[] = [];
  for (const id of skuIds) {
    const s = skuById.get(id);
    if (!s) continue;

    const ordered = orderMap.get(id) ?? 0;
    const shipped = shipMap.get(id) ?? 0;
    const inbound = inboundMap.get(id) ?? 0;
    const shortageVsShipped = ordered - shipped;
    const inTransit = shipped - inbound;

    const flags: string[] = [];
    if (inbound > shipped) {
      flags.push("入库多于发货");
    }
    if (shipped > 0 && inbound === 0) {
      flags.push("已发货未入库");
    }
    if (ordered > shipped && ordered > 0) {
      flags.push("订货未发足");
    }

    skuRows.push({
      skuId: id,
      productId: s.productId,
      manufacturerId: s.product.manufacturerId,
      manufacturerName: s.product.manufacturer.name,
      productCode: s.product.code,
      nameInbound: s.product.nameInbound,
      nameManufacturer: s.product.nameManufacturer,
      color: s.color,
      size: s.size,
      ordered,
      shipped,
      inbound,
      shortageVsShipped,
      inTransit,
      flags,
    });
  }

  skuRows.sort((a, b) => {
    const m = a.manufacturerName.localeCompare(b.manufacturerName, "zh-CN");
    if (m !== 0) return m;
    return a.productCode.localeCompare(b.productCode) || a.color.localeCompare(b.color);
  });

  const aggByMfr = new Map<string, { ordered: number; shipped: number; inbound: number }>();
  for (const m of manufacturers) {
    aggByMfr.set(m.id, { ordered: 0, shipped: 0, inbound: 0 });
  }
  for (const row of skuRows) {
    const agg = aggByMfr.get(row.manufacturerId);
    if (agg) {
      agg.ordered += row.ordered;
      agg.shipped += row.shipped;
      agg.inbound += row.inbound;
    }
  }

  const byManufacturer: ManufacturerRollup[] = manufacturers.map((m) => {
    const agg = aggByMfr.get(m.id)!;
    return {
      manufacturerId: m.id,
      name: m.name,
      ordered: agg.ordered,
      shipped: agg.shipped,
      inbound: agg.inbound,
      shortageVsShipped: agg.ordered - agg.shipped,
      inTransit: agg.shipped - agg.inbound,
    };
  });

  const attentionRows = skuRows.filter(
    (r) => r.shortageVsShipped !== 0 || r.inTransit !== 0 || r.inbound > r.shipped,
  );

  const byProduct = rollupSkuRowsToProducts(skuRows);

  return { byManufacturer, byProduct, skuRows, attentionRows };
}

/** 单款在列表上的订/发/入/欠发/在途（与详情页合计口径一致） */
export type ProductMovementTotals = {
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  inTransit: number;
};

/** 批量计算多款衣服的件数汇总（衣服列表用，一次 groupBy） */
export async function getProductMovementTotalsMap(
  products: { id: string; skus: { id: string }[] }[]
): Promise<Map<string, ProductMovementTotals>> {
  const result = new Map<string, ProductMovementTotals>();
  if (products.length === 0) return result;

  const allSkuIds = [...new Set(products.flatMap((p) => p.skus.map((s) => s.id)))];
  if (allSkuIds.length === 0) {
    for (const p of products) {
      result.set(p.id, {
        ordered: 0,
        shipped: 0,
        inbound: 0,
        shortageVsShipped: 0,
        inTransit: 0,
      });
    }
    return result;
  }

  const [orderGroups, shipGroups, inboundGroups] = await Promise.all([
    prisma.orderLine.groupBy({
      by: ["skuId"],
      where: { skuId: { in: allSkuIds } },
      _sum: { quantity: true },
    }),
    prisma.shipmentLine.groupBy({
      by: ["skuId"],
      where: { skuId: { in: allSkuIds } },
      _sum: { quantity: true },
    }),
    prisma.inboundLine.groupBy({
      by: ["skuId"],
      where: { skuId: { in: allSkuIds } },
      _sum: { quantity: true },
    }),
  ]);

  const oMap = sumMap(orderGroups);
  const sMap = sumMap(shipGroups);
  const iMap = sumMap(inboundGroups);

  for (const p of products) {
    let ordered = 0;
    let shipped = 0;
    let inbound = 0;
    for (const sku of p.skus) {
      ordered += oMap.get(sku.id) ?? 0;
      shipped += sMap.get(sku.id) ?? 0;
      inbound += iMap.get(sku.id) ?? 0;
    }
    result.set(p.id, {
      ordered,
      shipped,
      inbound,
      shortageVsShipped: ordered - shipped,
      inTransit: shipped - inbound,
    });
  }
  return result;
}
