import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** 供衣服档案页「登记入库 / 登记发货」抽屉拉取厂家与全量衣服+SKU 目录（与入库/发货列表页一致）。 */
export async function GET() {
  const [manufacturers, products] = await Promise.all([
    prisma.manufacturer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      orderBy: [{ nameInbound: "asc" }],
      select: {
        id: true,
        nameInbound: true,
        nameManufacturer: true,
        skus: {
          orderBy: [{ color: "asc" }, { size: "asc" }],
          select: { id: true, color: true, size: true },
        },
      },
    }),
  ]);

  const catalog = products.map((p) => ({
    id: p.id,
    label: `${p.nameManufacturer}（入库：${p.nameInbound}）`,
    skus: p.skus.map((s) => ({
      id: s.id,
      label: `${s.color} / ${s.size}`,
    })),
  }));

  return NextResponse.json({ manufacturers, catalog });
}
