export default function InboundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">入库登记</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        模型：<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">InboundRecord</code>（照片必存）+{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">InboundLine</code>。
      </p>
    </div>
  );
}
