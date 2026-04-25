/** 浏览器可访问的照片地址（需登录鉴权可后续在中间件加） */
export function photoPublicUrl(fileName: string): string {
  if (/^https?:\/\//i.test(fileName)) return fileName;
  return `/api/photos/${encodeURIComponent(fileName)}`;
}
