import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { photoPublicUrl } from "@/lib/storage/photo-url";

type Params = { id: string };

function dec(v: { toString(): string } | null | undefined): string {
  return v == null ? "" : v.toString();
}

export default async function ProductDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      manufacturer: true,
      skus: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/products"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回列表
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">档案详情</h1>
          <Link
            href={`/products/${id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            编辑
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">衣服 ID</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-100">{product.code}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">厂家</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{product.manufacturer.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">入库登记名称</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{product.nameInbound}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">厂家发货名称</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{product.nameManufacturer}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">成本价</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{dec(product.costPrice) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">批发价</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{dec(product.wholesalePrice) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">零售价</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{dec(product.retailPrice) || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">材质</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{product.material ?? "—"}</dd>
            </div>
          </dl>

          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">SKU 列表</h2>
            {product.skus.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">暂无 SKU</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {product.skus.map((s) => (
                  <li key={s.id} className="px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                    {s.color} / {s.size}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">主图</p>
          {product.imageFileName ? (
            // eslint-disable-next-line @next/next/no-img-element -- 动态 API
            <img
              src={photoPublicUrl(product.imageFileName)}
              alt=""
              className="w-full rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
              无主图
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
