import Link from "next/link";

export function ProductListFilterBanner({
  product,
  clearHref,
}: {
  product: { code: string; nameInbound: string };
  clearHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
      <span>
        当前按衣服筛选：
        <span className="font-mono font-medium">{product.code}</span>
        <span className="text-sky-800/90 dark:text-sky-200/90"> · {product.nameInbound}</span>
      </span>
      <Link href={clearHref} className="shrink-0 font-medium underline-offset-2 hover:underline">
        清除筛选
      </Link>
    </div>
  );
}

export function ProductListFilterInvalidBanner({ clearHref }: { clearHref: string }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <span>链接中的衣服不存在或已删除，以下显示全部记录。</span>
      <Link href={clearHref} className="shrink-0 font-medium underline-offset-2 hover:underline">
        清除参数
      </Link>
    </div>
  );
}
