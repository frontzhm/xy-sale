import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { formatDatetimeLocalValue } from "@/lib/format-datetime-local";

import { ShipmentForm, type ShipmentCatalogProduct, type ShipmentFormInitial } from "../../shipment-form";

type Params = { id: string };

export default async function EditShipmentPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const [record, manufacturers, products] = await Promise.all([
    prisma.shipmentRecord.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { id: "asc" },
          include: {
            sku: { select: { id: true, productId: true } },
          },
        },
      },
    }),
    prisma.manufacturer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        nameInbound: true,
        nameManufacturer: true,
        skus: {
          orderBy: [{ color: "asc" }, { size: "asc" }],
          select: { id: true, color: true, size: true },
        },
      },
    }),
  ]);

  if (!record) notFound();

  const catalog: ShipmentCatalogProduct[] = products.map((p) => ({
    id: p.id,
    label: `${p.code} · ${p.nameManufacturer}（入库：${p.nameInbound}）`,
    skus: p.skus.map((s) => ({
      id: s.id,
      label: `${s.color} / ${s.size}`,
    })),
  }));

  const initial: ShipmentFormInitial = {
    manufacturerId: record.manufacturerId,
    note: record.note ?? "",
    recordedAtValue: formatDatetimeLocalValue(record.recordedAt),
    photoFileName: record.photoFileName,
    lines: record.lines.map((line) => ({
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
          href={`/shipments/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回详情
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">编辑发货登记</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          可修改厂家、时间、备注、明细；不换照片则保留原图。
        </p>
      </div>
      <ShipmentForm
        manufacturers={manufacturers}
        catalog={catalog}
        mode="edit"
        recordId={id}
        initial={initial}
      />
    </div>
  );
}
