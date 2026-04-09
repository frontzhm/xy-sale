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

/** 聚合订货、厂家发货、入库，用于对账 */
export async function getReconciliationReport(): Promise<{
  byManufacturer: ManufacturerRollup[];
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

  return { byManufacturer, skuRows, attentionRows };
}
