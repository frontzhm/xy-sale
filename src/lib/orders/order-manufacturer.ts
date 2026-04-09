import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * 从数据库读取订货单头上的 manufacturerId，不依赖 Prisma Client 是否已包含
 * `Order.manufacturer` 关系（避免未执行 `prisma generate` 时的校验错误）。
 */
export async function orderManufacturerIdsByOrderIds(
  orderIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>(orderIds.map((oid) => [oid, null]));
  if (orderIds.length === 0) return map;

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; manufacturerId: string | null }>>(
      Prisma.sql`
        SELECT id, "manufacturerId" AS "manufacturerId"
        FROM "Order"
        WHERE id IN (${Prisma.join(orderIds)})
      `,
    );
    for (const r of rows) {
      map.set(r.id, r.manufacturerId);
    }
  } catch {
    // 未 db push、列名差异等：保持 null
  }
  return map;
}

export async function manufacturerNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.manufacturer.findMany({
    where: { id: { in: uniq } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}
