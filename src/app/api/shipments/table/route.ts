import { NextRequest, NextResponse } from "next/server";

import type { ShipmentTableFilterMeta } from "./types";
import { mergeWhereAnd, shipmentListWhereFromQ, trimSearchQ } from "@/lib/list-search";
import { prisma } from "@/lib/prisma";
import { resolveProductListFilter } from "@/lib/products/list-filter";
import type { Prisma } from "@prisma/client";

type Row = {
  id: string;
  photoFileName: string;
  recordedAt: string;
  manufacturerName: string | null;
  orderNo: string | null;
  lineCount: number;
  totalQty: number;
  note: string | null;
};

function extractOrderNo(note: string | null): string | null {
  if (!note) return null;
  const m = note.match(/单号[:：]\s*([^\n\r]+)/);
  if (!m) return null;
  const v = m[1]?.trim();
  return v ? v : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const current = Math.max(1, parseInt(searchParams.get("current") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  const qRaw = trimSearchQ(searchParams.get("q") ?? searchParams.get("searchQ"));
  const productId = searchParams.get("productId")?.trim() || undefined;

  const filter = await resolveProductListFilter(productId);

  const filterMeta: ShipmentTableFilterMeta = {
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

  const textWhere = shipmentListWhereFromQ(qRaw);
  const where = mergeWhereAnd<Prisma.ShipmentRecordWhereInput>(productLineWhere, textWhere);

  if (noRows) {
    return NextResponse.json({
      data: [] as Row[],
      total: 0,
      success: true,
      filterMeta,
    });
  }

  const total = await prisma.shipmentRecord.count({ where });

  const records = await prisma.shipmentRecord.findMany({
    where,
    skip: (current - 1) * pageSize,
    take: pageSize,
    orderBy: { recordedAt: "desc" },
    include: {
      manufacturer: { select: { name: true } },
      lines: { select: { quantity: true } },
    },
  });

  const data: Row[] = records.map((r) => ({
    id: r.id,
    photoFileName: r.photoFileName,
    recordedAt: r.recordedAt.toISOString(),
    manufacturerName: r.manufacturer?.name ?? null,
    orderNo: extractOrderNo(r.note),
    lineCount: r.lines.length,
    totalQty: r.lines.reduce((acc, l) => acc + l.quantity, 0),
    note: r.note,
  }));

  return NextResponse.json({
    data,
    total,
    success: true,
    filterMeta,
  });
}
