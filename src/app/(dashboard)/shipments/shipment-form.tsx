"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createShipment, updateShipment, type ShipmentFormState } from "./actions";
import { photoPublicUrl } from "@/lib/storage/photo-url";

import type { ManufacturerOption } from "../products/product-form";

export type ShipmentCatalogProduct = {
  id: string;
  label: string;
  /** 订货等场景按厂家过滤明细时使用；发货登记页可不传 */
  manufacturerId?: string;
  skus: { id: string; label: string }[];
};

export type ShipmentFormInitial = {
  manufacturerId: string | null;
  note: string;
  recordedAtValue: string;
  photoFileName: string;
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

type ShipmentFormProps = {
  manufacturers: ManufacturerOption[];
  catalog: ShipmentCatalogProduct[];
  mode?: "create" | "edit";
  recordId?: string;
  initial?: ShipmentFormInitial;
};

export function ShipmentForm({
  manufacturers,
  catalog,
  mode = "create",
  recordId,
  initial,
}: ShipmentFormProps) {
  const isEdit = mode === "edit" && recordId && initial;

  const action = isEdit ? updateShipment : createShipment;
  const [state, formAction, pending] = useActionState<ShipmentFormState, FormData>(action, null);

  const [rows, setRows] = useState<LineRow[]>(() =>
    isEdit && initial!.lines.length > 0
      ? initial!.lines.map((l) => ({ ...l }))
      : [newLine()],
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

  const hasCatalog = catalog.some((p) => p.skus.length > 0);

  const existingPhotoSrc =
    isEdit && initial?.photoFileName ? photoPublicUrl(initial.photoFileName) : null;

  return (
    <form key={recordId ?? "new"} action={formAction} className="max-w-2xl space-y-8">
      {state?.error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {isEdit ? <input type="hidden" name="recordId" value={recordId} /> : null}
      <input type="hidden" name="linesJson" value={linesJson} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">厂家（可选）</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">已有厂家</span>
            <select
              name="manufacturerId"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              defaultValue={isEdit ? initial!.manufacturerId ?? "" : ""}
            >
              <option value="">不选</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">或新厂家名称</span>
            <input
              name="newManufacturerName"
              type="text"
              placeholder="填写则创建并关联"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">发货照片</h2>
        <label className="block text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">
            {isEdit ? "更换照片（留空则保留原图）" : "上传照片"}{" "}
            {!isEdit ? <span className="text-red-600">*</span> : null}
          </span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            required={!isEdit}
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-100"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(f ? URL.createObjectURL(f) : null);
            }}
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob 预览
            <img
              src={previewUrl}
              alt="预览"
              className="mt-3 max-h-48 rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ) : existingPhotoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- 动态 API
            <img
              src={existingPhotoSrc}
              alt="当前照片"
              className="mt-3 max-h-48 rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ) : null}
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">登记信息</h2>
        <label className="block text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">登记时间</span>
          <input
            name="recordedAt"
            type="datetime-local"
            defaultValue={isEdit ? initial!.recordedAtValue : undefined}
            className="mt-1 w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {!isEdit ? (
            <p className="mt-1 text-xs text-zinc-500">留空则使用当前时间</p>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">备注</span>
          <textarea
            name="note"
            rows={2}
            defaultValue={isEdit ? initial!.note : undefined}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="可选"
          />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">发货明细</h2>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, newLine()])}
            disabled={!hasCatalog}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            添加一行
          </button>
        </div>
        {!hasCatalog ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            暂无带 SKU 的衣服档案，请先到「衣服档案」创建商品与颜色尺码。
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            先选衣服，再选颜色/尺码对应的 SKU，填写件数。空行不会提交。
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
                    {catalog.map((p) => (
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
          disabled={pending || !hasCatalog}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "保存中…" : isEdit ? "保存修改" : "保存发货登记"}
        </button>
        <Link
          href={isEdit && recordId ? `/shipments/${recordId}` : "/shipments"}
          className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
