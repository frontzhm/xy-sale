import Link from "next/link";

type Preserve = Record<string, string | undefined>;

function buildClearHref(basePath: string, preserve: Preserve | undefined): string {
  const u = new URLSearchParams();
  if (preserve) {
    for (const [k, v] of Object.entries(preserve)) {
      if (v) u.set(k, v);
    }
  }
  const s = u.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/**
 * GET 表单：提交后 URL 带 `q=`。可用 hidden 保留 `productId` 等其它查询参数。
 */
export function TableSearchBar({
  basePath,
  defaultQ,
  placeholder,
  preserveParams,
}: {
  basePath: string;
  defaultQ: string;
  placeholder: string;
  preserveParams?: Preserve;
}) {
  const clearHref = buildClearHref(basePath, preserveParams);

  return (
    <form method="get" action={basePath} className="flex max-w-xl flex-wrap items-center gap-2">
      {preserveParams
        ? Object.entries(preserveParams).map(([k, v]) =>
            v ? <input key={k} type="hidden" name={k} value={v} /> : null,
          )
        : null}
      <input
        type="search"
        name="q"
        defaultValue={defaultQ}
        placeholder={placeholder}
        className="min-w-[200px] flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        className="rounded-md bg-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        搜索
      </button>
      {defaultQ ? (
        <Link
          href={clearHref}
          className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          清除
        </Link>
      ) : null}
    </form>
  );
}
