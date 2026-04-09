export default function ReportsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">统计 / 对货</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        建议在 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">src/lib/reports/</code> 编写按厂家、按日期的聚合查询，在此页展示。
      </p>
    </div>
  );
}
