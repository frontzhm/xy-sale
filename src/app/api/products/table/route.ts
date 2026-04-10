import { NextRequest, NextResponse } from "next/server";

import { productListWhereFromTableFilters } from "@/lib/list-search";
import { prisma } from "@/lib/prisma";
import { getProductMovementTotalsMap } from "@/lib/reports/reconciliation";

const SORT_FIELDS = ["ordered", "shipped", "inbound", "shortageVsShipped"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parseSortField(raw: string | null): SortField | null {
  if (!raw) return null;
  return SORT_FIELDS.includes(raw as SortField) ? (raw as SortField) : null;
}

type Row = {
  id: string;
  nameInbound: string;
  manufacturerName: string;
  material: string | null;
  skuCount: number;
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  imageFileName: string | null;
};

function mapProductToRow(
  p: {
    id: string;
    nameInbound: string;
    material: string | null;
    imageFileName: string | null;
    manufacturer: { name: string };
    skus: { id: string }[];
  },
  movementById: Map<string, { ordered: number; shipped: number; inbound: number; shortageVsShipped: number }>,
): Row {
  const m = movementById.get(p.id)!;
  return {
    id: p.id,
    nameInbound: p.nameInbound,
    manufacturerName: p.manufacturer.name,
    material: p.material,
    skuCount: p.skus.length,
    ordered: m.ordered,
    shipped: m.shipped,
    inbound: m.inbound,
    shortageVsShipped: m.shortageVsShipped,
    imageFileName: p.imageFileName,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const current = Math.max(1, parseInt(searchParams.get("current") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  const where = productListWhereFromTableFilters({
    nameInbound: searchParams.get("nameInbound"),
    manufacturerId: searchParams.get("manufacturerId"),
    material: searchParams.get("material"),
  });

  const sortField = parseSortField(searchParams.get("sortField"));
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const include = {
    manufacturer: { select: { name: true } },
    skus: { select: { id: true } },
  } as const;

  if (sortField) {
    const products = await prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include,
    });
    const movementById = await getProductMovementTotalsMap(products);
    const rows = products.map((p) => mapProductToRow(p, movementById));
    rows.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (va !== vb) {
        const c = va < vb ? -1 : 1;
        return sortOrder === "asc" ? c : -c;
      }
      return a.id.localeCompare(b.id);
    });
    const total = rows.length;
    const data = rows.slice((current - 1) * pageSize, current * pageSize);
    return NextResponse.json({ data, total, success: true });
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (current - 1) * pageSize,
      take: pageSize,
      include,
    }),
  ]);

  const movementById = await getProductMovementTotalsMap(products);
  const data = products.map((p) => mapProductToRow(p, movementById));

  return NextResponse.json({ data, total, success: true });
}
