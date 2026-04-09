import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      manufacturer: { select: { name: true } },
      lines: { select: { quantity: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">订货</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            订货单与明细件数；可与厂家发货、入库在对货统计中对比。
          </p>
        </div>
        <Link
          href="/orders/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新建订货单
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          暂无订货单。点击「新建订货单」开始录入。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">创建时间</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">行数</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">总件数</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">备注</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: (typeof orders)[number]) => {
                const totalQty = o.lines.reduce((acc, l) => acc + l.quantity, 0);
                return (
                  <tr
                    key={o.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {new Date(o.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {o.manufacturer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{o.lines.length}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {totalQty}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {o.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/orders/${o.id}`}
                          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                        >
                          查看
                        </Link>
                        <Link
                          href={`/orders/${o.id}/edit`}
                          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                        >
                          编辑
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
