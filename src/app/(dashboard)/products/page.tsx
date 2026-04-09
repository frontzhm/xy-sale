"use client";

import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { useRequest } from "ahooks";
import { Space } from "antd";
import Link from "next/link";

import { photoPublicUrl } from "@/lib/storage/photo-url";

type ProductTableRow = {
  id: string;
  nameInbound: string;
  manufacturerName: string;
  skuCount: number;
  ordered: number;
  shipped: number;
  inbound: number;
  shortageVsShipped: number;
  imageFileName: string | null;
};

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

const columns: ProColumns<ProductTableRow>[] = [
  {
    title: "关键词",
    dataIndex: "q",
    hideInTable: true,
    fieldProps: {
      placeholder: "入库名、厂家发货名、厂家名称…",
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
  {
    title: "SKU",
    dataIndex: "skuCount",
    width: 72,
    align: "right",
    search: false,
  },
  {
    title: "订货",
    dataIndex: "ordered",
    width: 80,
    align: "right",
    search: false,
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
    width: 80,
    align: "right",
    search: false,
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
    width: 80,
    align: "right",
    search: false,
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
    width: 80,
    align: "right",
    search: false,
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
];

export default function ProductsPage() {
  const { runAsync } = useRequest(
    async (vars: { current?: number; pageSize?: number; q?: string }) => {
      const sp = new URLSearchParams();
      sp.set("current", String(vars.current ?? 1));
      sp.set("pageSize", String(vars.pageSize ?? 20));
      const q = vars.q?.trim();
      if (q) sp.set("q", q);
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
          request={async (params) => {
            const r = await runAsync({
              current: params.current,
              pageSize: params.pageSize,
              q: typeof params.q === "string" ? params.q : undefined,
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
          scroll={{ x: 1080 }}
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
