export default function OrdersPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">订货</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        数据模型：<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">Order</code> /{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">OrderLine</code>（SKU + 件数）。
      </p>
    </div>
  );
}
