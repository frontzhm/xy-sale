/** 将 Date 格式化为 `<input type="datetime-local" />` 可用的本地时间字符串 */
export function formatDatetimeLocalValue(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
