import { trimSearchQ } from "@/lib/list-search";
import { prisma } from "@/lib/prisma";

import { ShipmentListPageClient } from "./shipment-list-client";
import type { ShipmentCatalogProduct } from "./shipment-form";

type Search = { productId?: string; q?: string };

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const initialQ = trimSearchQ(sp.q);
  const initialProductId = sp.productId?.trim() || undefined;

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

  const catalog: ShipmentCatalogProduct[] = products.map((p) => ({
    id: p.id,
    label: `${p.nameManufacturer}（入库：${p.nameInbound}）`,
    skus: p.skus.map((s) => ({
      id: s.id,
      label: `${s.color} / ${s.size}`,
    })),
  }));

  return (
    <ShipmentListPageClient
      manufacturers={manufacturers}
      catalog={catalog}
      initialQ={initialQ}
      initialProductId={initialProductId}
    />
  );
}
