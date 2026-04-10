import { trimSearchQ } from "@/lib/list-search";
import { prisma } from "@/lib/prisma";

import { OrderListPageClient } from "./order-list-client";
import type { ShipmentCatalogProduct } from "../shipments/shipment-form";

type Search = { productId?: string; q?: string };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const initialQ = trimSearchQ(sp.q);
  const initialProductId = sp.productId?.trim() || undefined;

  const [products, manufacturers] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ nameInbound: "asc" }],
      select: {
        id: true,
        manufacturerId: true,
        nameInbound: true,
        nameManufacturer: true,
        skus: {
          orderBy: [{ color: "asc" }, { size: "asc" }],
          select: { id: true, color: true, size: true },
        },
      },
    }),
    prisma.manufacturer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const catalog: ShipmentCatalogProduct[] = products.map((p) => ({
    id: p.id,
    manufacturerId: p.manufacturerId,
    label: `${p.nameManufacturer}（入库：${p.nameInbound}）`,
    skus: p.skus.map((s) => ({
      id: s.id,
      label: `${s.color} / ${s.size}`,
    })),
  }));

  return (
    <OrderListPageClient
      manufacturers={manufacturers}
      catalog={catalog}
      initialQ={initialQ}
      initialProductId={initialProductId}
    />
  );
}
