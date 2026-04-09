import { prisma } from "@/lib/prisma";

export type ProductListFilterResolved = {
  /** null = 不按衣服筛选；[] = 该款无 SKU，不应出现任何明细行 */
  skuIds: string[] | null;
  product: { id: string; code: string; nameInbound: string } | null;
  /** URL 上带了 productId 但数据库无此款 */
  invalidProductId: boolean;
};

/** 解析 `?productId=`，供订货 / 发货 / 入库列表共用 */
export async function resolveProductListFilter(
  productId: string | null | undefined
): Promise<ProductListFilterResolved> {
  const raw = productId?.trim();
  if (!raw) {
    return { skuIds: null, product: null, invalidProductId: false };
  }

  const product = await prisma.product.findUnique({
    where: { id: raw },
    select: { id: true, code: true, nameInbound: true },
  });

  if (!product) {
    return { skuIds: null, product: null, invalidProductId: true };
  }

  const skus = await prisma.productSku.findMany({
    where: { productId: product.id },
    select: { id: true },
  });

  return {
    skuIds: skus.map((s) => s.id),
    product,
    invalidProductId: false,
  };
}
