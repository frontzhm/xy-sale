import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { photoPublicUrl } from "@/lib/storage/photo-url";

export default async function ShipmentsPage() {
  const shipments = await prisma.shipmentRecord.findMany({
    orderBy: { recordedAt: "desc" },
    include: {
      manufacturer: { select: { name: true } },
      lines: { select: { quantity: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">厂家发货</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            已发货未到货：每条记录对应一次厂家发货照片与明细件数。
          </p>
        </div>
        <Link
          href="/shipments/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          登记发货
        </Link>
      </div>

      {shipments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          暂无记录。点击「登记发货」添加第一条。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">照片</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">登记时间</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">行数</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">总件数</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">备注</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s: (typeof shipments)[number]) => {
                const totalQty = s.lines.reduce((acc, l) => acc + l.quantity, 0);
                return (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-4 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 动态 API */}
                      <img
                        src={photoPublicUrl(s.photoFileName)}
                        alt=""
                        className="h-12 w-12 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {new Date(s.recordedAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {s.manufacturer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.lines.length}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {totalQty}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {s.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/shipments/${s.id}`}
                          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                        >
                          查看
                        </Link>
                        <Link
                          href={`/shipments/${s.id}/edit`}
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
