import Link from "next/link";
import { notFound } from "next/navigation";

import { manufacturerNamesByIds, orderManufacturerIdsByOrderIds } from "@/lib/orders/order-manufacturer";
import { prisma } from "@/lib/prisma";

type Params = { id: string };

export default async function OrderDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [order, mfrIdByOrder] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { id: "asc" },
          include: {
            sku: {
              include: {
                product: {
                  select: {
                    code: true,
                    nameInbound: true,
                    nameManufacturer: true,
                    manufacturer: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    orderManufacturerIdsByOrderIds([id]),
  ]);

  if (!order) notFound();

  const headerMfrId = mfrIdByOrder.get(id) ?? null;
  const headerMfrNames = headerMfrId ? await manufacturerNamesByIds([headerMfrId]) : new Map();
  const headerManufacturerName = headerMfrId ? headerMfrNames.get(headerMfrId) : undefined;

  const totalQty = order.lines.reduce((acc, l) => acc + l.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/orders"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回列表
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">订货单详情</h1>
          <Link
            href={`/orders/${id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            编辑
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          创建时间：{new Date(order.createdAt).toLocaleString("zh-CN")}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          订货厂家：
          {headerManufacturerName ??
            order.lines[0]?.sku.product.manufacturer.name ??
            "—"}
        </p>
      </div>

      {order.note ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">备注</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
            {order.note}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            明细（共 {order.lines.length} 行，合计 {totalQty} 件）
          </h2>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {order.lines.map((line) => {
            const pr = line.sku.product;
            return (
              <li
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {pr.code} · {pr.nameManufacturer}
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    厂家：{pr.manufacturer.name} · 入库名：{pr.nameInbound} · {line.sku.color} /{" "}
                    {line.sku.size}
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
  );
}
