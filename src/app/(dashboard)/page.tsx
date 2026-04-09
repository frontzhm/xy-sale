import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">对货工作台</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          维护衣服档案、登记订货与发货/入库照片（照片会保存在服务器 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">storage/photos</code>{" "}
          目录）。后续在此接表单与统计。
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link
            href="/products"
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-50">衣服档案</span>
            <p className="mt-1 text-sm text-zinc-500">厂家、主图、入库/发货名称、SKU（颜色+尺码）</p>
          </Link>
        </li>
        <li>
          <Link
            href="/shipments"
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-50">厂家发货</span>
            <p className="mt-1 text-sm text-zinc-500">上传群里的发货照片并登记数量（已发货未到货）</p>
          </Link>
        </li>
        <li>
          <Link
            href="/inbound"
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-50">入库登记</span>
            <p className="mt-1 text-sm text-zinc-500">上传入库照片并登记数量（已收到货）</p>
          </Link>
        </li>
        <li>
          <Link
            href="/reports"
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-50">统计 / 对货</span>
            <p className="mt-1 text-sm text-zinc-500">按厂家欠货、收发差异等（待实现查询）</p>
          </Link>
        </li>
      </ul>
    </div>
  );
}
