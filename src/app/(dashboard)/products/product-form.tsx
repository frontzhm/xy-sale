"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createProduct, updateProduct, type ProductFormState } from "./actions";
import { photoPublicUrl } from "@/lib/storage/photo-url";

export type ManufacturerOption = { id: string; name: string };

export type ProductFormInitial = {
  manufacturerId: string;
  nameInbound: string;
  nameManufacturer: string;
  costPrice: string;
  wholesalePrice: string;
  retailPrice: string;
  material: string;
  imageFileName: string | null;
  skus: { id: string; color: string; size: string }[];
};

type SkuRow = { rowKey: string; dbSkuId?: string; color: string; size: string };

function newRow(): SkuRow {
  return { rowKey: crypto.randomUUID(), color: "", size: "" };
}

function rowsFromInitialSkus(skus: ProductFormInitial["skus"]): SkuRow[] {
  if (skus.length === 0) return [newRow()];
  return skus.map((s) => ({
    rowKey: s.id,
    dbSkuId: s.id,
    color: s.color,
    size: s.size,
  }));
}

const materialPresets = ["棉", "麻", "真丝"] as const;

type ProductFormProps = {
  manufacturers: ManufacturerOption[];
  mode: "create" | "edit";
  productId?: string;
  initial?: ProductFormInitial;
};

export function ProductForm({ manufacturers, mode, productId, initial }: ProductFormProps) {
  const action = mode === "edit" ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, null);

  const [rows, setRows] = useState<SkuRow[]>(() =>
    mode === "edit" && initial ? rowsFromInitialSkus(initial.skus) : [newRow()],
  );
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const skusJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((r) => ({
          ...(r.dbSkuId ? { id: r.dbSkuId } : {}),
          color: r.color,
          size: r.size,
        })),
      ),
    [rows],
  );

  const existingImageSrc =
    mode === "edit" && initial?.imageFileName ? photoPublicUrl(initial.imageFileName) : null;

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      {state?.error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {mode === "edit" && productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <input type="hidden" name="skusJson" value={skusJson} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">厂家</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">已有厂家</span>
            <select
              name="manufacturerId"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              defaultValue={initial?.manufacturerId ?? ""}
            >
              <option value="">不选（改用右侧新建）</option>
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
              placeholder="填写则优先创建并选用"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">基本信息</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-700 dark:text-zinc-300">
              入库登记名称 <span className="text-red-600">*</span>
            </span>
            <input
              name="nameInbound"
              required
              type="text"
              defaultValue={initial?.nameInbound}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-700 dark:text-zinc-300">厂家发货名称</span>
            <input
              name="nameManufacturer"
              type="text"
              placeholder="可选"
              defaultValue={initial?.nameManufacturer}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">成本价</span>
            <input
              name="costPrice"
              type="text"
              inputMode="decimal"
              placeholder="可选"
              defaultValue={initial?.costPrice}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">批发价</span>
            <input
              name="wholesalePrice"
              type="text"
              inputMode="decimal"
              placeholder="可选"
              defaultValue={initial?.wholesalePrice}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">零售价</span>
            <input
              name="retailPrice"
              type="text"
              inputMode="decimal"
              placeholder="可选"
              defaultValue={initial?.retailPrice}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">材质</span>
          <div className="flex flex-wrap gap-2">
            {materialPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMaterial(p)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {p}
              </button>
            ))}
          </div>
          <input type="hidden" name="material" value={material} />
          <input
            type="text"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="自定义材质或直接输入"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <label className="block text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">
            衣服照片（主图）{mode === "edit" ? "（留空则保留原图）" : null}
          </span>
          <input
            name="image"
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-100"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(f ? URL.createObjectURL(f) : null);
            }}
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 本地预览 blob
            <img
              src={previewUrl}
              alt="预览"
              className="mt-3 max-h-48 rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ) : existingImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- 动态 API 地址
            <img
              src={existingImageSrc}
              alt="当前主图"
              className="mt-3 max-h-48 rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ) : null}
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">颜色与尺码（SKU）</h2>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, newRow()])}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            添加一行
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          仅颜色、尺码都填写的行会保存；删除行时若该 SKU 已被订货/发货/入库引用，将无法保存。
        </p>
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.rowKey}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <label className="min-w-[120px] flex-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">颜色</span>
                <input
                  type="text"
                  value={row.color}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) => (x.rowKey === row.rowKey ? { ...x, color: e.target.value } : x)),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <label className="min-w-[120px] flex-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">尺码</span>
                <input
                  type="text"
                  value={row.size}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) => (x.rowKey === row.rowKey ? { ...x, size: e.target.value } : x)),
                    )
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <button
                type="button"
                disabled={rows.length <= 1}
                onClick={() => setRows((prev) => prev.filter((x) => x.rowKey !== row.rowKey))}
                className="rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/40"
              >
                删除
              </button>
              <span className="w-full text-xs text-zinc-400 sm:w-auto">#{index + 1}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "保存中…" : mode === "edit" ? "保存修改" : "保存档案"}
        </button>
        <Link
          href={mode === "edit" && productId ? `/products/${productId}` : "/products"}
          className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
