import Link from "next/link";

import { TableSearchBar } from "@/components/table-search-bar";
import { productListWhereFromQ, trimSearchQ } from "@/lib/list-search";
import { prisma } from "@/lib/prisma";
import { getProductMovementTotalsMap } from "@/lib/reports/reconciliation";
import { photoPublicUrl } from "@/lib/storage/photo-url";

function QtyLink({
  href,
  value,
  warnNegative,
  title,
}: {
  href: string;
  value: number;
  warnNegative?: boolean;
  title?: string;
}) {
  const bad = warnNegative && value < 0;
  return (
    <Link
      href={href}
      title={title}
      className={`tabular-nums underline-offset-2 hover:underline ${
        bad
          ? "font-medium text-red-600 dark:text-red-400"
          : "text-sky-700 dark:text-sky-400"
      }`}
    >
      {value}
    </Link>
  );
}

type Search = { q?: string };

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const sp = (await searchParams) ?? {};
  const qRaw = trimSearchQ(sp.q);

  const products = await prisma.product.findMany({
    where: productListWhereFromQ(qRaw),
    orderBy: { updatedAt: "desc" },
    include: {
      manufacturer: { select: { name: true } },
      skus: { select: { id: true } },
    },
  });

  const movementById = await getProductMovementTotalsMap(products);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">衣服档案</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            维护衣服 ID、名称、厂家与 SKU。下表汇总该款在所有 SKU 上的
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">订货 / 厂家发货 / 入库</strong>
            件数（与「统计 / 对货」口径一致）。
            <span className="block mt-1">
              点击<strong className="font-medium text-zinc-800 dark:text-zinc-200">蓝色数字</strong>
              可打开对应模块列表（已按该款筛选）；点击
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">欠发</strong>
              进入档案内的对货明细（订货 − 发货）。
            </span>
          </p>
        </div>
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新建档案
        </Link>
      </div>

      <TableSearchBar
        basePath="/products"
        defaultQ={qRaw}
        placeholder="衣服 ID、入库名、厂家发货名、厂家名称…"
      />

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {qRaw ? `没有符合「${qRaw}」的档案。` : "暂无档案。点击「新建档案」添加第一件。"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">主图</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">衣服 ID</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">入库名称</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">SKU</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">订货</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">发货</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">入库</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">欠发</th>
                <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: (typeof products)[number]) => {
                const m = movementById.get(p.id)!;
                const pidQs = `productId=${encodeURIComponent(p.id)}`;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-3">
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
                    <td className="px-3 py-3 font-mono text-zinc-900 dark:text-zinc-100">{p.code}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-zinc-800 dark:text-zinc-200">
                      {p.nameInbound}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-3 text-zinc-600 dark:text-zinc-400">
                      {p.manufacturer.name}
                    </td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{p.skus.length}</td>
                    <td className="px-3 py-3">
                      <QtyLink
                        href={`/orders?${pidQs}`}
                        value={m.ordered}
                        title="查看含该款的订货单"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <QtyLink
                        href={`/shipments?${pidQs}`}
                        value={m.shipped}
                        title="查看含该款的厂家发货登记"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <QtyLink
                        href={`/inbound?${pidQs}`}
                        value={m.inbound}
                        title="查看含该款的入库登记"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <QtyLink
                        href={`/products/${p.id}#product-reconciliation`}
                        value={m.shortageVsShipped}
                        warnNegative
                        title="欠发 = 订货 − 发货；查看该款对货汇总与各 SKU"
                      />
                    </td>
                    <td className="px-3 py-3">
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
