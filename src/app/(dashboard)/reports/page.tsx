import { getReconciliationReport } from "@/lib/reports/reconciliation";

function Num({ value, warnNegative }: { value: number; warnNegative?: boolean }) {
  const bad = warnNegative && value < 0;
  return (
    <span
      className={`tabular-nums ${bad ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}
    >
      {value}
    </span>
  );
}

export default async function ReportsPage() {
  const { byManufacturer, skuRows, attentionRows } = await getReconciliationReport();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">统计 / 对货</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          数据来自已登记的<strong className="font-medium text-zinc-800 dark:text-zinc-200">订货单</strong>、
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">厂家发货</strong>与
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">入库</strong>明细，按 SKU（颜色+尺码）汇总。
          <span className="block mt-2">
            <strong>欠发</strong> = 订货合计 − 发货合计（&gt;0 表示相对订货厂家仍少发）；
            <strong>在途/待入库</strong> = 发货合计 − 入库合计（&gt;0 表示已发登记多于入库登记，可能仍在途或未入库）。
            <strong>入库多于发货</strong>为异常提示，需核对是否重复登记或发货漏记。
          </span>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">按厂家汇总</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          仅统计在订货/发货/入库中出现过的 SKU，并按衣服档案归属到厂家。
        </p>
        {byManufacturer.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无厂家数据。</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">订货</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">发货</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">入库</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">欠发</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">在途</th>
                </tr>
              </thead>
              <tbody>
                {byManufacturer.map((m) => (
                  <tr
                    key={m.manufacturerId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{m.name}</td>
                    <td className="px-4 py-3">
                      <Num value={m.ordered} />
                    </td>
                    <td className="px-4 py-3">
                      <Num value={m.shipped} />
                    </td>
                    <td className="px-4 py-3">
                      <Num value={m.inbound} />
                    </td>
                    <td className="px-4 py-3">
                      <Num value={m.shortageVsShipped} warnNegative />
                    </td>
                    <td className="px-4 py-3">
                      <Num value={m.inTransit} warnNegative />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">需关注 SKU</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          欠发≠0、在途≠0，或入库件数大于发货件数时列出，便于对货人员优先处理。
        </p>
        {attentionRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            当前无差异行（或尚未有任何订货/发货/入库明细）。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">衣服 ID</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">颜色/尺码</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">订</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">发</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">入</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">欠发</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">在途</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">提示</th>
                </tr>
              </thead>
              <tbody>
                {attentionRows.map((r) => (
                  <tr
                    key={r.skuId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.manufacturerName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                      {r.productCode}
                    </td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                      {r.color} / {r.size}
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.ordered} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.shipped} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.inbound} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.shortageVsShipped} warnNegative />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.inTransit} warnNegative />
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                      {r.flags.length ? r.flags.join("；") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">全部已对账 SKU</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          凡在订货、发货或入库中出现过的 SKU 均列出（含三项均为 0 的孤立数据，一般不会出现）。
        </p>
        {skuRows.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无明细。请先维护订货、厂家发货或入库登记。</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">厂家</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">衣服 ID</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">入库名</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">颜色/尺码</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">订</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">发</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">入</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">欠发</th>
                  <th className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-300">在途</th>
                </tr>
              </thead>
              <tbody>
                {skuRows.map((r) => (
                  <tr
                    key={r.skuId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.manufacturerName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                      {r.productCode}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      {r.nameInbound}
                    </td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                      {r.color} / {r.size}
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.ordered} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.shipped} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.inbound} />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.shortageVsShipped} warnNegative />
                    </td>
                    <td className="px-3 py-2">
                      <Num value={r.inTransit} warnNegative />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
