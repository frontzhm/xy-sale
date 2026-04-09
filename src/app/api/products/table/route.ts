import { NextRequest, NextResponse } from "next/server";

import { productListWhereFromQ, trimSearchQ } from "@/lib/list-search";
import { prisma } from "@/lib/prisma";
import { getProductMovementTotalsMap } from "@/lib/reports/reconciliation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const current = Math.max(1, parseInt(searchParams.get("current") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
  const qRaw = trimSearchQ(searchParams.get("q"));

  const where = productListWhereFromQ(qRaw);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (current - 1) * pageSize,
      take: pageSize,
      include: {
        manufacturer: { select: { name: true } },
        skus: { select: { id: true } },
      },
    }),
  ]);

  const movementById = await getProductMovementTotalsMap(products);

  const data = products.map((p) => {
    const m = movementById.get(p.id)!;
    return {
      id: p.id,
      nameInbound: p.nameInbound,
      manufacturerName: p.manufacturer.name,
      skuCount: p.skus.length,
      ordered: m.ordered,
      shipped: m.shipped,
      inbound: m.inbound,
      shortageVsShipped: m.shortageVsShipped,
      imageFileName: p.imageFileName,
    };
  });

  return NextResponse.json({ data, total, success: true });
}
