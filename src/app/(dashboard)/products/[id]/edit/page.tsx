import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { ProductForm, type ProductFormInitial } from "../../product-form";

type Params = { id: string };

function dec(v: { toString(): string } | null | undefined): string {
  return v == null ? "" : v.toString();
}

export default async function EditProductPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      skus: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });

  if (!product) notFound();

  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const initial: ProductFormInitial = {
    manufacturerId: product.manufacturerId,
    nameInbound: product.nameInbound,
    nameManufacturer: product.nameManufacturer,
    costPrice: dec(product.costPrice),
    wholesalePrice: dec(product.wholesalePrice),
    retailPrice: dec(product.retailPrice),
    material: product.material ?? "",
    imageFileName: product.imageFileName,
    skus: product.skus.map((s) => ({ id: s.id, color: s.color, size: s.size })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/products/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← 返回详情
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">编辑衣服档案</h1>
      </div>
      <ProductForm manufacturers={manufacturers} mode="edit" productId={id} initial={initial} />
    </div>
  );
}
