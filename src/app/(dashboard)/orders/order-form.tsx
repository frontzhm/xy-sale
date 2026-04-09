"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createOrder, updateOrder, type OrderFormState } from "./actions";

import type { ManufacturerOption } from "../products/product-form";
import type { ShipmentCatalogProduct } from "../shipments/shipment-form";

export type OrderFormInitial = {
  manufacturerId: string | null;
  note: string;
  lines: { rowKey: string; productId: string; skuId: string; quantity: string }[];
};

type LineRow = {
  rowKey: string;
  productId: string;
  skuId: string;
  quantity: string;
};

function newLine(): LineRow {
  return { rowKey: crypto.randomUUID(), productId: "", skuId: "", quantity: "" };
}

type OrderFormProps = {
  manufacturers: ManufacturerOption[];
  catalog: ShipmentCatalogProduct[];
  mode?: "create" | "edit";
  orderId?: string;
  initial?: OrderFormInitial;
};

export function OrderForm({
  manufacturers,
  catalog,
  mode = "create",
  orderId,
  initial,
}: OrderFormProps) {
  const isEdit = mode === "edit" && orderId && initial;

  const action = isEdit ? updateOrder : createOrder;
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(action, null);

  const [manufacturerId, setManufacturerId] = useState(
    () => (isEdit ? initial!.manufacturerId ?? "" : ""),
  );

  const [rows, setRows] = useState<LineRow[]>(() =>
    isEdit && initial!.lines.length > 0
      ? initial!.lines.map((l) => ({ ...l }))
      : [newLine()],
  );

  const linesJson = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.skuId && r.quantity.trim())
          .map((r) => ({
            skuId: r.skuId,
            quantity: Number.parseInt(r.quantity, 10),
          })),
      ),
    [rows],
  );

  const filteredCatalog = useMemo(
    () =>
      manufacturerId
        ? catalog.filter((p) => (p.manufacturerId ?? "") === manufacturerId)
        : [],
    [catalog, manufacturerId],
  );

  const productById = useMemo(
    () => new Map(filteredCatalog.map((p) => [p.id, p])),
    [filteredCatalog],
  );

  const hasCatalog =
    manufacturerId !== "" && filteredCatalog.some((p) => p.skus.length > 0);

  function onManufacturerChange(nextId: string) {
    setManufacturerId(nextId);
    setRows([newLine()]);
  }

  return (
    <form key={orderId ?? "new"} action={formAction} className="max-w-2xl space-y-8">
      {state?.error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {isEdit ? <input type="hidden" name="orderId" value={orderId} /> : null}
      <input type="hidden" name="linesJson" value={linesJson} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">订货说明</h2>
        <label className="block text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">
            订货厂家 <span className="text-red-600">*</span>
          </span>
          <select
            name="manufacturerId"
            required
            value={manufacturerId}
            onChange={(e) => onManufacturerChange(e.target.value)}
            className="mt-1 w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">请选择厂家</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            切换厂家会清空当前明细行，避免混用不同厂家的款式。
          </p>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">备注（整单）</span>
          <textarea
            name="note"
            rows={3}
            defaultValue={isEdit ? initial!.note : undefined}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="可选：批次、约定等"
          />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">订货明细</h2>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, newLine()])}
            disabled={!hasCatalog}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            添加一行
          </button>
        </div>
        {!manufacturerId ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">请先选择订货厂家，再添加明细。</p>
        ) : !hasCatalog ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            该厂家下暂无带 SKU 的衣服档案，请先到「衣服档案」维护商品与颜色尺码。
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            仅显示当前厂家下的款式。保存后会计入统计页的「订货」汇总。
          </p>
        )}
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const product = row.productId ? productById.get(row.productId) : undefined;
            const skuOptions = product?.skus ?? [];
            return (
              <li
                key={row.rowKey}
                className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12 dark:border-zinc-800"
              >
                <label className="block text-sm sm:col-span-5">
                  <span className="text-zinc-600 dark:text-zinc-400">衣服</span>
                  <select
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={row.productId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const p = productById.get(pid);
                      const firstSku = p?.skus[0]?.id ?? "";
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === row.rowKey
                            ? { ...x, productId: pid, skuId: firstSku }
                            : x,
                        ),
                      );
                    }}
                  >
                    <option value="">请选择</option>
                    {filteredCatalog.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.skus.length === 0}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-4">
                  <span className="text-zinc-600 dark:text-zinc-400">颜色 / 尺码（SKU）</span>
                  <select
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={row.skuId}
                    disabled={!row.productId}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === row.rowKey ? { ...x, skuId: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="">请选择</option>
                    {skuOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">件数</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.rowKey === row.rowKey ? { ...x, quantity: e.target.value } : x,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <div className="flex items-end justify-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={rows.length <= 1}
                    onClick={() => setRows((prev) => prev.filter((x) => x.rowKey !== row.rowKey))}
                    className="text-sm text-red-600 hover:underline disabled:opacity-40"
                  >
                    删
                  </button>
                </div>
                <span className="text-xs text-zinc-400 sm:col-span-12">#{index + 1}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={pending || !hasCatalog || !manufacturerId}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "保存中…" : isEdit ? "保存修改" : "保存订货单"}
        </button>
        <Link
          href={isEdit && orderId ? `/orders/${orderId}` : "/orders"}
          className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
