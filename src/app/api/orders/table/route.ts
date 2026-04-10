import { NextRequest, NextResponse } from "next/server";

import type { OrderTableFilterMeta } from "./types";
import { mergeWhereAnd, orderListWhereFromQ, trimSearchQ } from "@/lib/list-search";
import { manufacturerNamesByIds, orderManufacturerIdsByOrderIds } from "@/lib/orders/order-manufacturer";
import { prisma } from "@/lib/prisma";
import { resolveProductListFilter } from "@/lib/products/list-filter";
import type { Prisma } from "@prisma/client";

type Row = {
  id: string;
  createdAt: string;
  manufacturerName: string | null;
  lineCount: number;
  totalQty: number;
  note: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const current = Math.max(1, parseInt(searchParams.get("current") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  const qRaw = trimSearchQ(searchParams.get("q") ?? searchParams.get("searchQ"));
  const productId = searchParams.get("productId")?.trim() || undefined;

  const filter = await resolveProductListFilter(productId);

  const filterMeta: OrderTableFilterMeta = {
    invalidProductId: filter.invalidProductId,
    product: filter.product,
    skuIdsEmpty: filter.skuIds !== null && filter.skuIds.length === 0,
  };

  const noRows =
    !filter.invalidProductId && filter.skuIds !== null && filter.skuIds.length === 0;

  const productLineWhere =
    !filter.invalidProductId && filter.skuIds !== null && filter.skuIds.length > 0
      ? { lines: { some: { skuId: { in: filter.skuIds } } } }
      : undefined;

  const textWhere = await orderListWhereFromQ(qRaw);
  const where = mergeWhereAnd<Prisma.OrderWhereInput>(productLineWhere, textWhere);

  if (noRows) {
    return NextResponse.json({
      data: [] as Row[],
      total: 0,
      success: true,
      filterMeta,
    });
  }

  const total = await prisma.order.count({ where });

  const orders = await prisma.order.findMany({
    where,
    skip: (current - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: "desc" },
    include: {
      lines: { select: { quantity: true } },
    },
  });

  const mfrIdByOrder = await orderManufacturerIdsByOrderIds(orders.map((o) => o.id));
  const mfrIds = [...new Set([...mfrIdByOrder.values()].filter((x): x is string => Boolean(x)))];
  const mfrNames = await manufacturerNamesByIds(mfrIds);

  const data: Row[] = orders.map((o) => {
    const mid = mfrIdByOrder.get(o.id);
    const manufacturerName = mid ? (mfrNames.get(mid) ?? null) : null;
    return {
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      manufacturerName,
      lineCount: o.lines.length,
      totalQty: o.lines.reduce((acc, l) => acc + l.quantity, 0),
      note: o.note,
    };
  });

  return NextResponse.json({
    data,
    total,
    success: true,
    filterMeta,
  });
}
