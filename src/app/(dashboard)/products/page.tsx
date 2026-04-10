"use client";

import { BetaSchemaForm, ProTable } from "@ant-design/pro-components";
import type {
  ActionType,
  ProColumns,
  ProFormColumnsType,
  ProFormInstance,
} from "@ant-design/pro-components";
import { useDebounceFn, useRequest } from "ahooks";
import { Button, Space, Upload, message } from "antd";
import type { UploadFile } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { createProductInline } from "./actions";
import { photoPublicUrl } from "@/lib/storage/photo-url";

dayjs.extend(isoWeek);

type NewProductFormValues = {
  manufacturerId?: string;
  newManufacturerName?: string;
  nameInbound?: string;
  nameManufacturer?: string;
  costPrice?: string;
  wholesalePrice?: string;
  retailPrice?: string;
  material?: string;
  image?: UploadFile[];
  skus?: { color?: string; size?: string }[];
};

function newProductValuesToFormData(values: NewProductFormValues): FormData {
  const fd = new FormData();
  fd.set("nameInbound", String(values.nameInbound ?? "").trim());
  fd.set("nameManufacturer", String(values.nameManufacturer ?? "").trim());
  fd.set("material", String(values.material ?? "").trim());
  const mid = String(values.manufacturerId ?? "").trim();
  if (mid) fd.set("manufacturerId", mid);
  fd.set("newManufacturerName", String(values.newManufacturerName ?? "").trim());
  fd.set("costPrice", String(values.costPrice ?? "").trim());
  fd.set("wholesalePrice", String(values.wholesalePrice ?? "").trim());
  fd.set("retailPrice", String(values.retailPrice ?? "").trim());
  const skus = (values.skus ?? [])
    .map((r) => ({
      color: String(r?.color ?? "").trim(),
      size: String(r?.size ?? "").trim(),
    }))
    .filter((r) => r.color && r.size);
  fd.set("skusJson", JSON.stringify(skus));
  const f = values.image?.[0]?.originFileObj;
  if (f) fd.set("image", f);
  return fd;
}

/** 入库日期 RangePicker 快捷项（value 用函数，点击时取当前时间） */
const INBOUND_DATE_RANGE_PRESETS: {
  label: string;
  value: () => [Dayjs, Dayjs];
}[] = [
  {
    label: "今天",
    value: () => [dayjs().startOf("day"), dayjs().endOf("day")],
  },
  {
    label: "昨天",
    value: () => {
      const y = dayjs().subtract(1, "day");
      return [y.startOf("day"), y.endOf("day")];
    },
  },
  {
    label: "本周",
    value: () => [dayjs().startOf("isoWeek"), dayjs().endOf("day")],
  },
  {
    label: "本月",
    value: () => [dayjs().startOf("month"), dayjs().endOf("month")],
  },
  {
    label: "近一周",
    value: () => [dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")],
  },
  {
    label: "近一个月",
    value: () => [dayjs().subtract(29, "day").startOf("day"), dayjs().endOf("day")],
  },
];

type ProductTableRow = {
  id: string;
  nameInbound: string;
  manufacturerName: string;
  material: string | null;
  skuCount: number;
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  imageFileName: string | null;
};

const MOVEMENT_SORT_KEYS = new Set([
  "ordered",
  "shipped",
  "inbound",
  "shortageVsShipped",
]);

function pickMovementSort(sort: unknown): { field: string; order: "asc" | "desc" } | null {
  if (!sort || typeof sort !== "object") return null;
  for (const [k, v] of Object.entries(sort as Record<string, unknown>)) {
    if (!MOVEMENT_SORT_KEYS.has(k)) continue;
    if (v === "ascend") return { field: k, order: "asc" };
    if (v === "descend") return { field: k, order: "desc" };
  }
  return null;
}

/** 入库登记日期区间 → 接口用 ISO；清空则不传（不按入库日筛选） */
function inboundDateRangeToApiParams(range: unknown): { from: string; to: string } | null {
  if (!range || !Array.isArray(range) || range.length !== 2) return null;
  const [a, b] = range;
  if (a == null || b == null) return null;
  const d1 = dayjs(a as string | Date | Dayjs);
  const d2 = dayjs(b as string | Date | Dayjs);
  if (!d1.isValid() || !d2.isValid()) return null;
  const start = d1.valueOf() <= d2.valueOf() ? d1 : d2;
  const end = d1.valueOf() <= d2.valueOf() ? d2 : d1;
  return {
    from: start.startOf("day").toISOString(),
    to: end.endOf("day").toISOString(),
  };
}

function QtyLink({
  href,
  value,
  warnNegative,
  title,
}: {
  href: string;
  value: number;
  warnNegative?: boolean;
  title?: string;
}) {
  const bad = warnNegative && value < 0;
  return (
    <Link
      href={href}
      title={title}
      className={`tabular-nums underline-offset-2 hover:underline ${
        bad
          ? "font-medium text-red-600 dark:text-red-400"
          : "text-sky-700 dark:text-sky-400"
      }`}
    >
      {value}
    </Link>
  );
}

/** 备注：入库/发货对比 + 订货侧欠发或「少于发货」；订货为 0 时不提示欠发类文案 */
function productRemarkParts(row: ProductTableRow): string[] {
  const parts: string[] = [];
  if (row.inbound > row.shipped) parts.push("入库大于发货");
  if (row.inbound < row.shipped) parts.push("入库少于发货");
  if (row.ordered > 0) {
    if (row.shortageVsShipped > 0) parts.push(`欠发 ${row.shortageVsShipped}`);
    if (row.shortageVsShipped < 0) parts.push("订货少于发货");
  }
  return parts;
}

function RemarkCell({ row }: { row: ProductTableRow }) {
  const parts = productRemarkParts(row);
  if (parts.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }
  return (
    <span className="text-xs leading-snug text-amber-900 dark:text-amber-100/90">{parts.join("；")}</span>
  );
}

type TableRequestVars = {
  current?: number;
  pageSize?: number;
  searchNameInbound?: string;
  manufacturerId?: string;
  searchMaterial?: string;
  inboundDateFrom?: string;
  inboundDateTo?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
};

export default function ProductsPage() {
  const [newProductOpen, setNewProductOpen] = useState(false);
  const searchFormRef = useRef<ProFormInstance>(undefined);
  const actionRef = useRef<ActionType>(undefined);

  /** ProTable 请求参数来自「查询提交」后的 formSearch；直接 reload 不会带上未提交的表单，必须用 submit 同步 */
  const { run: scheduleSubmitSearch, cancel: cancelDebouncedSubmit } = useDebounceFn(
    () => {
      void searchFormRef.current?.submit?.();
    },
    { wait: 320 },
  );

  const { data: mfrPayload, loading: mfrLoading } = useRequest(async () => {
    const res = await fetch("/api/manufacturers/options");
    if (!res.ok) throw new Error("加载厂家失败");
    return res.json() as Promise<{ data: { label: string; value: string }[] }>;
  });

  const manufacturerOptions = mfrPayload?.data;

  const newProductColumns = useMemo<ProFormColumnsType<NewProductFormValues>[]>(
    () => [
      {
        valueType: "group",
        label: "厂家",
        colProps: { span: 24 },
        columns: [
          {
            title: "已有厂家",
            dataIndex: "manufacturerId",
            valueType: "select",
            colProps: { xs: 24, md: 12 },
            fieldProps: {
              loading: mfrLoading,
              showSearch: true,
              optionFilterProp: "label",
              allowClear: true,
              placeholder: "不选（改用右侧新建）",
              options: manufacturerOptions ?? [],
            },
          },
          {
            title: "新厂家名称",
            dataIndex: "newManufacturerName",
            valueType: "text",
            colProps: { xs: 24, md: 12 },
            fieldProps: { placeholder: "填写则优先创建并选用" },
          },
        ],
      },
      {
        valueType: "group",
        label: "基本信息",
        colProps: { span: 24 },
        columns: [
          {
            title: "入库登记名称",
            dataIndex: "nameInbound",
            valueType: "text",
            colProps: { span: 24 },
            formItemProps: { rules: [{ required: true, message: "请输入入库登记名称" }] },
          },
          {
            title: "厂家发货名称",
            dataIndex: "nameManufacturer",
            valueType: "text",
            colProps: { span: 24 },
            formItemProps: { rules: [{ required: true, message: "请输入厂家发货名称" }] },
          },
          {
            title: "成本价",
            dataIndex: "costPrice",
            valueType: "text",
            colProps: { xs: 24, sm: 8 },
            fieldProps: { placeholder: "可选", inputMode: "decimal" },
          },
          {
            title: "批发价",
            dataIndex: "wholesalePrice",
            valueType: "text",
            colProps: { xs: 24, sm: 8 },
            fieldProps: { placeholder: "可选", inputMode: "decimal" },
          },
          {
            title: "零售价",
            dataIndex: "retailPrice",
            valueType: "text",
            colProps: { xs: 24, sm: 8 },
            fieldProps: { placeholder: "可选", inputMode: "decimal" },
          },
          {
            title: "材质",
            dataIndex: "material",
            valueType: "textarea",
            colProps: { span: 24 },
            fieldProps: { rows: 2, placeholder: "如：棉、麻、真丝，或自定义" },
          },
          {
            title: "衣服照片（主图）",
            dataIndex: "image",
            valueType: "text",
            colProps: { span: 24 },
            formItemProps: {
              valuePropName: "fileList",
              getValueFromEvent: (e: { fileList?: UploadFile[] }) => e?.fileList ?? [],
            },
            renderFormItem: () => (
              <Upload
                maxCount={1}
                accept="image/*"
                beforeUpload={() => false}
                listType="picture"
              >
                <Button>选择图片</Button>
              </Upload>
            ),
          },
        ],
      },
      {
        valueType: "formList",
        dataIndex: "skus",
        label: "颜色与尺码（SKU）",
        colProps: { span: 24 },
        initialValue: [{ color: "", size: "" }],
        fieldProps: {
          min: 1,
          creatorButtonProps: { creatorButtonText: "添加一行" },
        },
        columns: [
          {
            title: "颜色",
            dataIndex: "color",
            valueType: "text",
          },
          {
            title: "尺码",
            dataIndex: "size",
            valueType: "text",
          },
        ],
      },
    ],
    [manufacturerOptions, mfrLoading],
  );

  const columns = useMemo<ProColumns<ProductTableRow>[]>(
    () => [
      {
        title: "入库名称",
        dataIndex: "searchNameInbound",
        hideInTable: true,
        fieldProps: { placeholder: "模糊匹配入库登记名称" },
      },
      {
        title: "厂家名称",
        dataIndex: "manufacturerId",
        hideInTable: true,
        valueType: "select",
        fieldProps: {
          loading: mfrLoading,
          showSearch: true,
          optionFilterProp: "label",
          allowClear: true,
          placeholder: "选择厂家（可搜索）",
          options: manufacturerOptions ?? [],
        },
      },
      {
        title: "材质",
        dataIndex: "searchMaterial",
        hideInTable: true,
        fieldProps: { placeholder: "模糊匹配材质" },
      },
      {
        title: "入库日期",
        dataIndex: "inboundDateRange",
        hideInTable: true,
        valueType: "dateRange",
        colSize: 1.25,
        fieldProps: {
          allowClear: true,
          placeholder: ["开始日期", "结束日期"],
          presets: INBOUND_DATE_RANGE_PRESETS,
        },
      },
      {
        title: "主图",
        dataIndex: "imageFileName",
        width: 88,
        search: false,
        render: (_, row) =>
          row.imageFileName ? (
            // eslint-disable-next-line @next/next/no-img-element -- 本地 API 动态地址
            <img
              src={photoPublicUrl(row.imageFileName)}
              alt=""
              className="h-12 w-12 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
            />
          ) : (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-600">
              无
            </span>
          ),
      },
      {
        title: "入库名称",
        dataIndex: "nameInbound",
        ellipsis: true,
        width: 160,
        search: false,
      },
      {
        title: "厂家",
        dataIndex: "manufacturerName",
        ellipsis: true,
        width: 120,
        search: false,
      },
      // {
      //   title: "材质",
      //   dataIndex: "material",
      //   ellipsis: true,
      //   width: 88,
      //   search: false,
      //   render: (_, row) => row.material ?? "—",
      // },
      // {
      //   title: "SKU",
      //   dataIndex: "skuCount",
      //   width: 72,
      //   align: "right",
      //   search: false,
      // },
      {
        title: "订货",
        dataIndex: "ordered",
        width: 60,
        align: "right",
        search: false,
        sorter: true,
        render: (_, row) => (
          <QtyLink
            href={`/orders?productId=${encodeURIComponent(row.id)}`}
            value={row.ordered}
            title="查看含该款的订货单"
          />
        ),
      },
      {
        title: "发货",
        dataIndex: "shipped",
        width: 60,
        align: "right",
        search: false,
        sorter: true,
        render: (_, row) => (
          <QtyLink
            href={`/shipments?productId=${encodeURIComponent(row.id)}`}
            value={row.shipped}
            title="查看含该款的厂家发货登记"
          />
        ),
      },
      {
        title: "入库",
        dataIndex: "inbound",
        width: 60,
        align: "right",
        search: false,
        sorter: true,
        render: (_, row) => (
          <QtyLink
            href={`/inbound?productId=${encodeURIComponent(row.id)}`}
            value={row.inbound}
            title="查看含该款的入库登记"
          />
        ),
      },
      {
        title: "欠发",
        dataIndex: "shortageVsShipped",
        width: 60,
        align: "right",
        search: false,
        sorter: true,
        render: (_, row) => (
          <QtyLink
            href={`/products/${row.id}#product-reconciliation`}
            value={row.shortageVsShipped}
            warnNegative
            title="欠发 = 订货 − 发货；查看该款对货汇总与各 SKU"
          />
        ),
      },
      {
        title: "备注",
        dataIndex: "remark",
        width: 200,
        ellipsis: true,
        search: false,
        render: (_, row) => <RemarkCell row={row} />,
      },
      {
        title: "操作",
        valueType: "option",
        width: 120,
        fixed: "right",
        search: false,
        render: (_, row) => (
          <Space size="middle" wrap>
            <Link
              href={`/products/${row.id}`}
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              查看
            </Link>
            <Link
              href={`/products/${row.id}/edit`}
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              编辑
            </Link>
          </Space>
        ),
      },
    ],
    [manufacturerOptions, mfrLoading],
  );

  const { runAsync } = useRequest(
    async (vars: TableRequestVars) => {
      const sp = new URLSearchParams();
      sp.set("current", String(vars.current ?? 1));
      sp.set("pageSize", String(vars.pageSize ?? 20));
      const sni = vars.searchNameInbound?.trim();
      if (sni) sp.set("nameInbound", sni);
      const mid = vars.manufacturerId?.trim();
      if (mid) sp.set("manufacturerId", mid);
      const smt = vars.searchMaterial?.trim();
      if (smt) sp.set("material", smt);
      if (vars.inboundDateFrom && vars.inboundDateTo) {
        sp.set("inboundDateFrom", vars.inboundDateFrom);
        sp.set("inboundDateTo", vars.inboundDateTo);
      }
      if (vars.sortField) {
        sp.set("sortField", vars.sortField);
        sp.set("sortOrder", vars.sortOrder ?? "desc");
      }
      const res = await fetch(`/api/products/table?${sp.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "加载失败");
      }
      return res.json() as Promise<{
        data: ProductTableRow[];
        total: number;
        success?: boolean;
      }>;
    },
    { manual: true },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">衣服档案</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          维护款名、厂家与 SKU。下表汇总该款在所有 SKU 上的
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">订货 / 厂家发货 / 入库</strong>
          件数（与「统计 / 对货」口径一致）。
          <span className="mt-1 block">
            点击<strong className="font-medium text-zinc-800 dark:text-zinc-200">蓝色数字</strong>
            可打开对应模块列表（已按该款筛选）；点击
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">欠发</strong>
            进入档案内的对货明细（订货 − 发货）。
          </span>
        </p>
      </div>

      <div className="products-pro-table-wrap overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <ProTable<ProductTableRow>
          actionRef={actionRef}
          columns={columns}
          rowKey="id"
          formRef={searchFormRef}
          form={{
            onValuesChange: (changed) => {
              const keys = Object.keys(changed ?? {});
              const immediate =
                keys.includes("inboundDateRange") || keys.includes("manufacturerId");
              if (immediate) {
                cancelDebouncedSubmit();
                queueMicrotask(() => void searchFormRef.current?.submit?.());
                return;
              }
              scheduleSubmitSearch();
            },
          }}
          request={async (params, sort) => {
            const sm = pickMovementSort(sort);
            const inboundIso = inboundDateRangeToApiParams(params.inboundDateRange);
            const r = await runAsync({
              current: params.current,
              pageSize: params.pageSize,
              searchNameInbound:
                typeof params.searchNameInbound === "string" ? params.searchNameInbound : undefined,
              manufacturerId:
                params.manufacturerId != null && params.manufacturerId !== ""
                  ? String(params.manufacturerId)
                  : undefined,
              searchMaterial:
                typeof params.searchMaterial === "string" ? params.searchMaterial : undefined,
              inboundDateFrom: inboundIso?.from,
              inboundDateTo: inboundIso?.to,
              sortField: sm?.field,
              sortOrder: sm?.order,
            });
            return {
              data: r.data,
              total: r.total,
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
          // scroll={{ x: 1380 }}
          size="small"
          tableLayout="fixed"
          ghost
          dateFormatter="string"
          toolBarRender={() => [
            <Link
              key="inbound"
              href="/inbound"
              className="inline-flex items-center text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              登记入库
            </Link>,
            <Link
              key="shipments"
              href="/shipments"
              className="inline-flex items-center text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              登记发货
            </Link>,
            <Button
              key="new-product"
              type="primary"
              size="small"
              onClick={() => setNewProductOpen(true)}
            >
              新建档案
            </Button>,
          ]}
        />
      </div>

      <BetaSchemaForm<NewProductFormValues>
        layoutType="DrawerForm"
        title="新建衣服档案"
        description="保存后系统会在内部生成唯一编号。主图会写入服务器 storage/photos。"
        open={newProductOpen}
        onOpenChange={setNewProductOpen}
        width={640}
        grid
        rowProps={{ gutter: [16, 8] }}
        layout="inline"
        labelCol={{ flex: "0 0 112px" }}
        wrapperCol={{ flex: "1 1 auto" }}
        labelAlign="right"
        drawerProps={{ destroyOnClose: true }}
        columns={newProductColumns}
        initialValues={{
          skus: [{ color: "", size: "" }],
        }}
        submitter={{
          searchConfig: { submitText: "保存档案", resetText: "取消" },
          resetButtonProps: { onClick: () => setNewProductOpen(false) },
        }}
        onFinish={async (values) => {
          const fd = newProductValuesToFormData(values);
          const r = await createProductInline(fd);
          if (r?.error) {
            message.error(r.error);
            return false;
          }
          message.success("已保存档案");
          actionRef.current?.reload?.();
          return true;
        }}
      />
    </div>
  );
}
