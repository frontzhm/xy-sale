import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { photoPublicUrl } from "@/lib/storage/photo-url";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      manufacturer: { select: { name: true } },
      skus: { select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">衣服档案</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            维护衣服 ID、双端名称、价格、材质、厂家与 SKU（颜色+尺码）。
          </p>
        </div>
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新建档案
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          暂无档案。点击「新建档案」添加第一件。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">主图</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">衣服 ID</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">入库名称</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家名称</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">SKU 数</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: (typeof products)[number]) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                >
                  <td className="px-4 py-3">
                    {p.imageFileName ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 本地 API 动态地址
                      <img
                        src={photoPublicUrl(p.imageFileName)}
                        alt=""
                        className="h-12 w-12 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                      />
                    ) : (
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-600">
                        无
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">{p.code}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-800 dark:text-zinc-200">
                    {p.nameInbound}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-800 dark:text-zinc-200">
                    {p.nameManufacturer}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.manufacturer.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.skus.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/products/${p.id}`}
                        className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                      >
                        查看
                      </Link>
                      <Link
                        href={`/products/${p.id}/edit`}
                        className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                      >
                        编辑
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
