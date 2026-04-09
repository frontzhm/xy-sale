import Link from "next/link";

import {
  ProductListFilterBanner,
  ProductListFilterInvalidBanner,
} from "@/components/product-list-filter-banner";
import { TableSearchBar } from "@/components/table-search-bar";
import { mergeWhereAnd, orderListWhereFromQ, trimSearchQ } from "@/lib/list-search";
import { manufacturerNamesByIds, orderManufacturerIdsByOrderIds } from "@/lib/orders/order-manufacturer";
import { resolveProductListFilter } from "@/lib/products/list-filter";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Search = { productId?: string; q?: string };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = trimSearchQ(sp.q);
  const filter = await resolveProductListFilter(sp.productId);

  const noRows =
    !filter.invalidProductId && filter.skuIds !== null && filter.skuIds.length === 0;

  const productLineWhere =
    !filter.invalidProductId && filter.skuIds !== null && filter.skuIds.length > 0
      ? { lines: { some: { skuId: { in: filter.skuIds } } } }
      : undefined;

  const textWhere = await orderListWhereFromQ(qRaw);
  const where = mergeWhereAnd<Prisma.OrderWhereInput>(productLineWhere, textWhere);

  const orders = noRows
    ? []
    : await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          lines: { select: { quantity: true } },
        },
      });

  const mfrIdByOrder = await orderManufacturerIdsByOrderIds(orders.map((o) => o.id));
  const mfrIds = [...new Set([...mfrIdByOrder.values()].filter((x): x is string => Boolean(x)))];
  const mfrNames = await manufacturerNamesByIds(mfrIds);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">订货</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            订货单与明细件数；可与厂家发货、入库在对货统计中对比。从衣服档案点击「订货」件数可只显示含该款的单据。
          </p>
        </div>
        <Link
          href="/orders/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新建订货单
        </Link>
      </div>

      {filter.invalidProductId ? (
        <ProductListFilterInvalidBanner
          clearHref={qRaw ? `/orders?q=${encodeURIComponent(qRaw)}` : "/orders"}
        />
      ) : filter.product ? (
        <ProductListFilterBanner
          product={filter.product}
          clearHref={qRaw ? `/orders?q=${encodeURIComponent(qRaw)}` : "/orders"}
        />
      ) : null}

      <TableSearchBar
        basePath="/orders"
        defaultQ={qRaw}
        placeholder="备注、厂家名、衣服 ID / 名称…"
        preserveParams={
          filter.product && !filter.invalidProductId ? { productId: filter.product.id } : undefined
        }
      />

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {filter.skuIds !== null && filter.skuIds.length === 0
            ? "该款暂无 SKU，无法匹配订货明细。"
            : filter.skuIds !== null
              ? qRaw
                ? `没有符合「${qRaw}」且包含该款的订货单。`
                : "没有包含该款的订货单。"
              : qRaw
                ? `没有符合「${qRaw}」的订货单。`
                : "暂无订货单。点击「新建订货单」开始录入。"}
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
                const mid = mfrIdByOrder.get(o.id);
                const mfrLabel = mid ? (mfrNames.get(mid) ?? "—") : "—";
                return (
                  <tr
                    key={o.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {new Date(o.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {mfrLabel}
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
