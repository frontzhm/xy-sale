"use client";

import { BetaSchemaForm, ProTable } from "@ant-design/pro-components";
import type {
  ActionType,
  ProColumns,
  ProFormColumnsType,
  ProFormInstance,
} from "@ant-design/pro-components";
import { useDebounceFn } from "ahooks";
import { Button, message } from "antd";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { OrderTableFilterMeta } from "@/app/api/orders/table/types";

import { createOrderInline } from "./actions";
import type { ShipmentCatalogProduct } from "../shipments/shipment-form";
import {
  ProductListFilterBanner,
  ProductListFilterInvalidBanner,
} from "@/components/product-list-filter-banner";
import type { ManufacturerOption } from "../products/product-form";

type OrderTableRow = {
  id: string;
  createdAt: string;
  manufacturerName: string | null;
  lineCount: number;
  totalQty: number;
  note: string | null;
};

type OrderDrawerValues = {
  manufacturerId?: string;
  note?: string;
  lines?: { productId?: string; skuId?: string; quantity?: number }[];
};

function orderDrawerValuesToFormData(values: OrderDrawerValues): FormData {
  const fd = new FormData();
  fd.set("manufacturerId", String(values.manufacturerId ?? "").trim());
  const note = String(values.note ?? "").trim();
  fd.set("note", note);

  const lines = (values.lines ?? [])
    .map((r) => {
      const skuId = String(r?.skuId ?? "").trim();
      const q = r?.quantity;
      const quantity = typeof q === "number" ? q : Number.parseInt(String(q ?? ""), 10);
      return { skuId, quantity };
    })
    .filter((r) => r.skuId && Number.isInteger(r.quantity) && r.quantity > 0);
  fd.set("linesJson", JSON.stringify(lines));
  return fd;
}

type Props = {
  manufacturers: ManufacturerOption[];
  catalog: ShipmentCatalogProduct[];
  initialQ: string;
  initialProductId?: string;
};

export function OrderListPageClient({
  manufacturers,
  catalog,
  initialQ,
  initialProductId,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterMeta, setFilterMeta] = useState<OrderTableFilterMeta | null>(null);
  const searchFormRef = useRef<ProFormInstance>(undefined);
  const actionRef = useRef<ActionType>(undefined);

  const productIdForApi = initialProductId?.trim() || undefined;

  const { run: scheduleSubmitSearch } = useDebounceFn(
    () => {
      void searchFormRef.current?.submit?.();
    },
    { wait: 320 },
  );

  const hasCatalog = useMemo(() => catalog.some((p) => p.skus.length > 0), [catalog]);

  const mfrOptions = useMemo(
    () => manufacturers.map((m) => ({ label: m.name, value: m.id })),
    [manufacturers],
  );

  const drawerColumns = useMemo<ProFormColumnsType<OrderDrawerValues>[]>(
    () => [
      {
        title: "订货厂家",
        dataIndex: "manufacturerId",
        valueType: "select",
        colProps: { span: 24 },
        formItemProps: {
          rules: [{ required: true, message: "请选择订货厂家" }],
        },
        fieldProps: {
          allowClear: false,
          showSearch: true,
          optionFilterProp: "label",
          placeholder: "请选择",
          options: mfrOptions,
        },
      },
      {
        title: "备注",
        dataIndex: "note",
        valueType: "textarea",
        colProps: { span: 24 },
        fieldProps: { rows: 2, placeholder: "可选" },
      },
      {
        valueType: "dependency",
        name: ["manufacturerId"],
        columns: (deps: { manufacturerId?: string }) => {
          const mid = String(deps?.manufacturerId ?? "").trim();
          const filtered = mid
            ? catalog.filter((p) => (p.manufacturerId ?? "") === mid)
            : [];
          const byId = new Map(filtered.map((p) => [p.id, p]));
          const productOptions = filtered.map((p) => ({
            label: p.label,
            value: p.id,
            disabled: p.skus.length === 0,
          }));
          return [
            {
              valueType: "formList",
              dataIndex: "lines",
              label: "订货明细",
              colProps: { span: 24 },
              initialValue: [{}],
              fieldProps: {
                min: 1,
                creatorButtonProps: {
                  creatorButtonText: "添加一行",
                  disabled: !mid,
                },
                creatorRecord: {},
              },
              columns: [
                {
                  title: "衣服",
                  dataIndex: "productId",
                  valueType: "select",
                  colProps: { xs: 24, md: 10 },
                  fieldProps: {
                    options: productOptions,
                    placeholder: mid ? "请选择" : "请先选择厂家",
                    showSearch: true,
                    optionFilterProp: "label",
                    disabled: !mid,
                  },
                },
                {
                  valueType: "dependency",
                  name: ["productId"],
                  columns: (rowDeps: { productId?: string }) => {
                    const p = rowDeps?.productId ? byId.get(rowDeps.productId) : undefined;
                    const skuOpts = p?.skus.map((s) => ({ label: s.label, value: s.id })) ?? [];
                    return [
                      {
                        title: "颜色 / 尺码（SKU）",
                        dataIndex: "skuId",
                        valueType: "select",
                        colProps: { xs: 24, md: 10 },
                        fieldProps: {
                          options: skuOpts,
                          placeholder: "请选择",
                          disabled: !rowDeps?.productId,
                        },
                      },
                    ];
                  },
                },
                {
                  title: "件数",
                  dataIndex: "quantity",
                  valueType: "digit",
                  colProps: { xs: 24, md: 4 },
                  fieldProps: { min: 1, precision: 0, placeholder: "件数" },
                },
              ],
            },
          ];
        },
      },
    ],
    [catalog, mfrOptions],
  );

  const columns = useMemo<ProColumns<OrderTableRow>[]>(
    () => [
      {
        title: "综合搜索",
        dataIndex: "searchQ",
        hideInTable: true,
        fieldProps: { placeholder: "备注、厂家名、入库名、厂家发货名…" },
      },
      {
        title: "创建时间",
        dataIndex: "createdAt",
        width: 168,
        search: false,
        render: (_, row) => (
          <span className="whitespace-nowrap text-zinc-700 dark:text-zinc-300">
            {new Date(row.createdAt).toLocaleString("zh-CN")}
          </span>
        ),
      },
      {
        title: "厂家",
        dataIndex: "manufacturerName",
        width: 120,
        ellipsis: true,
        search: false,
        render: (_, row) => row.manufacturerName ?? "—",
      },
      {
        title: "行数",
        dataIndex: "lineCount",
        width: 72,
        align: "right",
        search: false,
      },
      {
        title: "总件数",
        dataIndex: "totalQty",
        width: 80,
        align: "right",
        search: false,
      },
      {
        title: "备注",
        dataIndex: "note",
        ellipsis: true,
        search: false,
        render: (_, row) => row.note ?? "—",
      },
      {
        title: "操作",
        valueType: "option",
        width: 120,
        search: false,
        render: (_, row) => [
          <Link
            key="view"
            href={`/orders/${row.id}`}
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            查看
          </Link>,
          <Link
            key="edit"
            href={`/orders/${row.id}/edit`}
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            编辑
          </Link>,
        ],
      },
    ],
    [],
  );

  const clearHrefBase =
    initialQ.trim() !== "" ? `/orders?q=${encodeURIComponent(initialQ.trim())}` : "/orders";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">订货</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          订货单与明细件数；可与厂家发货、入库在对货统计中对比。从衣服档案点击「订货」件数可只显示含该款的单据。
        </p>
      </div>

      {filterMeta?.invalidProductId ? (
        <ProductListFilterInvalidBanner clearHref={clearHrefBase} />
      ) : filterMeta?.product ? (
        <ProductListFilterBanner product={filterMeta.product} clearHref={clearHrefBase} />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <ProTable<OrderTableRow>
          actionRef={actionRef}
          columns={columns}
          rowKey="id"
          formRef={searchFormRef}
          form={{
            initialValues: { searchQ: initialQ },
            onValuesChange: () => {
              scheduleSubmitSearch();
            },
          }}
          request={async (params) => {
            const sp = new URLSearchParams();
            sp.set("current", String(params.current ?? 1));
            sp.set("pageSize", String(params.pageSize ?? 20));
            if (productIdForApi) sp.set("productId", productIdForApi);
            const sq = typeof params.searchQ === "string" ? params.searchQ.trim() : "";
            if (sq) sp.set("q", sq);
            const res = await fetch(`/api/orders/table?${sp.toString()}`);
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || "加载失败");
            }
            const j = (await res.json()) as {
              data: OrderTableRow[];
              total: number;
              success?: boolean;
              filterMeta: OrderTableFilterMeta;
            };
            setFilterMeta(j.filterMeta);
            return {
              data: j.data,
              total: j.total,
              success: true,
            };
          }}
          search={{
            labelWidth: "auto",
            defaultCollapsed: false,
          }}
          options={false}
          pagination={{
            defaultPageSize: 20,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
          tableLayout="fixed"
          ghost
          dateFormatter="string"
          locale={{
            emptyText: filterMeta?.skuIdsEmpty
              ? "该款暂无 SKU，无法匹配订货明细。"
              : "暂无订货单。可通过上方「新建订货单」添加。",
          }}
          toolBarRender={() => [
            <Button key="new" type="primary" size="small" onClick={() => setDrawerOpen(true)}>
              新建订货单
            </Button>,
          ]}
        />
      </div>

      <BetaSchemaForm<OrderDrawerValues>
        layoutType="DrawerForm"
        title="新建订货单"
        description="选择订货厂家后，仅显示该厂家名下的衣服与 SKU；保存后参与统计页「订货 / 欠发」计算。"
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        width={720}
        grid
        rowProps={{ gutter: [16, 8] }}
        layout="horizontal"
        labelCol={{ flex: "0 0 112px" }}
        wrapperCol={{ flex: "1 1 auto" }}
        labelAlign="right"
        drawerProps={{ destroyOnClose: true }}
        columns={drawerColumns}
        initialValues={{
          lines: [{}],
        }}
        submitter={{
          searchConfig: { submitText: "保存订货单", resetText: "取消" },
          submitButtonProps: { disabled: !hasCatalog },
          resetButtonProps: { onClick: () => setDrawerOpen(false) },
        }}
        onFinish={async (values) => {
          if (!hasCatalog) {
            message.warning("暂无带 SKU 的衣服档案，请先到「衣服档案」维护。");
            return false;
          }
          const mid = String(values.manufacturerId ?? "").trim();
          if (mid) {
            const hasForMfr = catalog.some(
              (p) => (p.manufacturerId ?? "") === mid && p.skus.length > 0,
            );
            if (!hasForMfr) {
              message.warning("该厂家下暂无带 SKU 的衣服档案，请先在衣服档案中关联厂家并维护 SKU。");
              return false;
            }
          }
          const fd = orderDrawerValuesToFormData(values);
          const r = await createOrderInline(fd);
          if (r?.error) {
            message.error(r.error);
            return false;
          }
          message.success("已保存订货单");
          actionRef.current?.reload?.();
          return true;
        }}
      />
    </div>
  );
}
