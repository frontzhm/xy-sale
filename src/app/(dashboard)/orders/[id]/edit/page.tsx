import Link from "next/link";
import { notFound } from "next/navigation";

import { orderManufacturerIdsByOrderIds } from "@/lib/orders/order-manufacturer";
import { prisma } from "@/lib/prisma";

import { OrderForm, type OrderFormInitial } from "../../order-form";
import type { ShipmentCatalogProduct } from "../../../shipments/shipment-form";

type Params = { id: string };

export default async function EditOrderPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const [order, products, manufacturers, mfrIdByOrder] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { id: "asc" },
          include: {
            sku: {
              select: {
                id: true,
                productId: true,
                product: { select: { manufacturerId: true } },
              },
            },
          },
        },
      },
    }),
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
    orderManufacturerIdsByOrderIds([id]),
  ]);

  if (!order) notFound();

  const catalog: ShipmentCatalogProduct[] = products.map((p) => ({
    id: p.id,
    manufacturerId: p.manufacturerId,
    label: `${p.nameManufacturer}（入库：${p.nameInbound}）`,
    skus: p.skus.map((s) => ({
      id: s.id,
      label: `${s.color} / ${s.size}`,
    })),
  }));

  const inferredManufacturerId =
    mfrIdByOrder.get(id) ?? order.lines[0]?.sku.product.manufacturerId ?? null;

  const initial: OrderFormInitial = {
    manufacturerId: inferredManufacturerId,
    note: order.note ?? "",
    lines: order.lines.map((line) => ({
      rowKey: line.id,
      productId: line.sku.productId,
      skuId: line.sku.id,
      quantity: String(line.quantity),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/orders/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回详情
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">编辑订货单</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          修改备注或明细行；保存后统计页会按最新数据重算。
        </p>
      </div>
      <OrderForm
        manufacturers={manufacturers}
        catalog={catalog}
        mode="edit"
        orderId={id}
        initial={initial}
      />
    </div>
  );
}
