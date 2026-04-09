import Link from "next/link";

import { prisma } from "@/lib/prisma";

import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/products"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">新建衣服档案</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          保存后系统会在内部生成唯一编号。主图会写入服务器{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">storage/photos</code>。
        </p>
      </div>
      <ProductForm manufacturers={manufacturers} mode="create" />
    </div>
  );
}
