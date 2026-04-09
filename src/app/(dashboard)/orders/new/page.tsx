import Link from "next/link";

import { prisma } from "@/lib/prisma";

import { OrderForm } from "../order-form";
import type { ShipmentCatalogProduct } from "../../shipments/shipment-form";

export default async function NewOrderPage() {
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
    <div className="space-y-6">
      <div>
        <Link
          href="/orders"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">新建订货单</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          按 SKU 填写订货件数；保存后参与统计页「订货 / 欠发」计算。
        </p>
      </div>
      <OrderForm manufacturers={manufacturers} catalog={catalog} />
    </div>
  );
}
