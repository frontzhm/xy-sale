import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { photoPublicUrl } from "@/lib/storage/photo-url";

type Params = { id: string };

export default async function ShipmentDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const record = await prisma.shipmentRecord.findUnique({
    where: { id },
    include: {
      manufacturer: true,
      lines: {
        orderBy: { id: "asc" },
        include: {
          sku: {
            include: {
              product: {
                select: {
                  nameInbound: true,
                  nameManufacturer: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!record) notFound();

  const totalQty = record.lines.reduce((acc, l) => acc + l.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/shipments"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回列表
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">发货登记详情</h1>
          <Link
            href={`/shipments/${id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            编辑
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          登记时间：{new Date(record.recordedAt).toLocaleString("zh-CN")}
          {record.manufacturer ? ` · 厂家：${record.manufacturer.name}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {record.note ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">备注</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {record.note}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                明细（共 {record.lines.length} 行，合计 {totalQty} 件）
              </h2>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {record.lines.map((line) => {
                const pr = line.sku.product;
                return (
                  <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{pr.nameManufacturer}</p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        入库名：{pr.nameInbound} · {line.sku.color} / {line.sku.size}
                      </p>
                    </div>
                    <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
                      {line.quantity} 件
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">发货照片</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- 动态 API */}
          <img
            src={photoPublicUrl(record.photoFileName)}
            alt="发货照片"
            className="mt-2 w-full rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
          />
        </div>
      </div>
    </div>
  );
}
