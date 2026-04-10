"use client";

import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useRequest } from "ahooks";
import { Space } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Link from "next/link";
import { useMemo } from "react";

import { photoPublicUrl } from "@/lib/storage/photo-url";

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
  const inboundDateDefault = useMemo((): [Dayjs, Dayjs] => {
    const d = dayjs();
    return [d.startOf("day"), d.endOf("day")];
  }, []);

  const { data: mfrPayload, loading: mfrLoading } = useRequest(async () => {
    const res = await fetch("/api/manufacturers/options");
    if (!res.ok) throw new Error("加载厂家失败");
    return res.json() as Promise<{ data: { label: string; value: string }[] }>;
  });

  const manufacturerOptions = mfrPayload?.data;

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
      <div className="flex flex-wrap items-end justify-between gap-4">
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
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新建档案
        </Link>
      </div>

      <div className="products-pro-table-wrap overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <ProTable<ProductTableRow>
          columns={columns}
          rowKey="id"
          form={{
            initialValues: {
              inboundDateRange: inboundDateDefault,
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
          toolBarRender={false}
        />
      </div>
    </div>
  );
}
