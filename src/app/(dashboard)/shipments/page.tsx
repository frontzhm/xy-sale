export default function ShipmentsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">厂家发货</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        每条记录绑定照片文件（<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">ShipmentRecord.photoFileName</code>
        ）与多行 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">ShipmentLine</code>。上传接口：{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">POST /api/upload</code>（字段名{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">file</code>）。
      </p>
    </div>
  );
}
