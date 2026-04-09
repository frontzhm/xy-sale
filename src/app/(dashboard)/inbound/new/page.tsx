import Link from "next/link";

import { prisma } from "@/lib/prisma";

import { InboundForm } from "../inbound-form";
import type { ShipmentCatalogProduct } from "../../shipments/shipment-form";

export default async function NewInboundPage() {
  const products = await prisma.product.findMany({
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
  });

  const catalog: ShipmentCatalogProduct[] = products.map((p) => ({
    id: p.id,
    label: `${p.nameManufacturer}（入库：${p.nameInbound}）`,
    skus: p.skus.map((s) => ({
      id: s.id,
      label: `${s.color} / ${s.size}`,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/inbound"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">登记入库</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          上传入库群里的照片并填写本次收到的 SKU 与件数；照片会保存到服务器存档。
        </p>
      </div>
      <InboundForm catalog={catalog} />
    </div>
  );
}
