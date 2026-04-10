"use client";

import { BetaSchemaForm, ProTable } from "@ant-design/pro-components";
import type {
  ActionType,
  ProColumns,
  ProFormColumnsType,
  ProFormInstance,
} from "@ant-design/pro-components";
import { useDebounceFn } from "ahooks";
import { Button, Upload, message } from "antd";
import type { UploadFile } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { InboundTableFilterMeta } from "@/app/api/inbound/table/types";

import { createInboundInline } from "./actions";
import {
  ProductListFilterBanner,
  ProductListFilterInvalidBanner,
} from "@/components/product-list-filter-banner";
import { photoPublicUrl } from "@/lib/storage/photo-url";

import type { ShipmentCatalogProduct } from "../shipments/shipment-form";

type InboundTableRow = {
  id: string;
  photoFileName: string;
  recordedAt: string;
  lineCount: number;
  totalQty: number;
  note: string | null;
};

type InboundDrawerValues = {
  photo?: UploadFile[];
  recordedAt?: Dayjs;
  note?: string;
  lines?: { productId?: string; skuId?: string; quantity?: number }[];
};

function formatRecordedAtForServer(v: unknown): string {
  if (v == null || v === "") return "";
  if (dayjs.isDayjs(v)) return v.toISOString();
  return String(v);
}

function inboundDrawerValuesToFormData(values: InboundDrawerValues): FormData {
  const fd = new FormData();
  const note = String(values.note ?? "").trim();
  fd.set("note", note);
  const ra = formatRecordedAtForServer(values.recordedAt);
  if (ra) fd.set("recordedAt", ra);

  const lines = (values.lines ?? [])
    .map((r) => {
      const skuId = String(r?.skuId ?? "").trim();
      const q = r?.quantity;
      const quantity = typeof q === "number" ? q : Number.parseInt(String(q ?? ""), 10);
      return { skuId, quantity };
    })
    .filter((r) => r.skuId && Number.isInteger(r.quantity) && r.quantity > 0);
  fd.set("linesJson", JSON.stringify(lines));

  const f = values.photo?.[0]?.originFileObj;
  if (f) fd.set("photo", f);
  return fd;
}

type Props = {
  catalog: ShipmentCatalogProduct[];
  initialQ: string;
  initialProductId?: string;
};

export function InboundListPageClient({ catalog, initialQ, initialProductId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterMeta, setFilterMeta] = useState<InboundTableFilterMeta | null>(null);
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

  const productOptions = useMemo(
    () =>
      catalog.map((p) => ({
        label: p.label,
        value: p.id,
        disabled: p.skus.length === 0,
      })),
    [catalog],
  );

  const catalogByProductId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

  const drawerColumns = useMemo<ProFormColumnsType<InboundDrawerValues>[]>(
    () => [
      {
        title: "入库照片",
        dataIndex: "photo",
        valueType: "text",
        colProps: { span: 24 },
        formItemProps: {
          rules: [{ required: true, message: "请上传入库照片" }],
          valuePropName: "fileList",
          getValueFromEvent: (e: { fileList?: UploadFile[] }) => e?.fileList ?? [],
        },
        renderFormItem: () => (
          <Upload maxCount={1} accept="image/*" beforeUpload={() => false} listType="picture">
            <Button>选择照片</Button>
          </Upload>
        ),
      },
      {
        title: "登记时间",
        dataIndex: "recordedAt",
        valueType: "dateTime",
        colProps: { span: 24 },
        fieldProps: {
          style: { width: "100%", maxWidth: 360 },
          placeholder: "留空则使用保存时当前时间",
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
        valueType: "formList",
        dataIndex: "lines",
        label: "入库明细",
        colProps: { span: 24 },
        initialValue: [{}],
        fieldProps: {
          min: 1,
          creatorButtonProps: { creatorButtonText: "添加一行" },
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
              placeholder: "请选择",
              showSearch: true,
              optionFilterProp: "label",
            },
          },
          {
            valueType: "dependency",
            name: ["productId"],
            columns: (deps: { productId?: string }) => {
              const p = deps?.productId ? catalogByProductId.get(deps.productId) : undefined;
              const skuOpts =
                p?.skus.map((s) => ({ label: s.label, value: s.id })) ?? [];
              return [
                {
                  title: "颜色 / 尺码（SKU）",
                  dataIndex: "skuId",
                  valueType: "select",
                  colProps: { xs: 24, md: 10 },
                  fieldProps: {
                    options: skuOpts,
                    placeholder: "请选择",
                    disabled: !deps?.productId,
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
    ],
    [catalogByProductId, productOptions],
  );

  const columns = useMemo<ProColumns<InboundTableRow>[]>(
    () => [
      {
        title: "综合搜索",
        dataIndex: "searchQ",
        hideInTable: true,
        fieldProps: { placeholder: "备注、入库名、厂家发货名…" },
      },
      {
        title: "照片",
        dataIndex: "photoFileName",
        width: 88,
        search: false,
        render: (_, row) => (
          // eslint-disable-next-line @next/next/no-img-element -- 动态 API
          <img
            src={photoPublicUrl(row.photoFileName)}
            alt=""
            className="h-12 w-12 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
          />
        ),
      },
      {
        title: "登记时间",
        dataIndex: "recordedAt",
        width: 168,
        search: false,
        render: (_, row) => (
          <span className="whitespace-nowrap text-zinc-700 dark:text-zinc-300">
            {new Date(row.recordedAt).toLocaleString("zh-CN")}
          </span>
        ),
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
            href={`/inbound/${row.id}`}
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            查看
          </Link>,
          <Link
            key="edit"
            href={`/inbound/${row.id}/edit`}
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
    initialQ.trim() !== ""
      ? `/inbound?q=${encodeURIComponent(initialQ.trim())}`
      : "/inbound";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">入库登记</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          每条记录对应一次入库照片与明细。从衣服档案点击「入库」件数可只显示含该款的登记。
        </p>
      </div>

      {filterMeta?.invalidProductId ? (
        <ProductListFilterInvalidBanner clearHref={clearHrefBase} />
      ) : filterMeta?.product ? (
        <ProductListFilterBanner product={filterMeta.product} clearHref={clearHrefBase} />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <ProTable<InboundTableRow>
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
            const sq =
              typeof params.searchQ === "string" ? params.searchQ.trim() : "";
            if (sq) sp.set("q", sq);
            const res = await fetch(`/api/inbound/table?${sp.toString()}`);
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || "加载失败");
            }
            const j = (await res.json()) as {
              data: InboundTableRow[];
              total: number;
              success?: boolean;
              filterMeta: InboundTableFilterMeta;
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
              ? "该款暂无 SKU，无法匹配入库明细。"
              : "暂无记录。点击「登记入库」添加。",
          }}
          toolBarRender={() => [
            <Button key="new" type="primary" size="small" onClick={() => setDrawerOpen(true)}>
              登记入库
            </Button>,
          ]}
        />
      </div>

      <BetaSchemaForm<InboundDrawerValues>
        layoutType="DrawerForm"
        title="登记入库"
        description="上传入库群里的照片并填写本次收到的 SKU 与件数；照片会保存到服务器存档。"
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        grid
        rowProps={{ gutter: [16, 8] }}
        layout="horizontal"
        labelCol={{ flex: "0 0 112px" }}
        wrapperCol={{ flex: "1 1 auto" }}
        labelAlign="right"
        drawerProps={{ destroyOnClose: true, size: 720 }}
        columns={drawerColumns}
        initialValues={{
          lines: [{}],
        }}
        submitter={{
          searchConfig: { submitText: "保存入库登记", resetText: "取消" },
          submitButtonProps: { disabled: !hasCatalog },
          resetButtonProps: { onClick: () => setDrawerOpen(false) },
        }}
        onFinish={async (values) => {
          if (!hasCatalog) {
            message.warning("暂无带 SKU 的衣服档案，请先到「衣服档案」维护。");
            return false;
          }
          const fd = inboundDrawerValuesToFormData(values);
          const r = await createInboundInline(fd);
          if (r?.error) {
            message.error(r.error);
            return false;
          }
          message.success("已保存入库登记");
          actionRef.current?.reload?.();
          return true;
        }}
      />
    </div>
  );
}
