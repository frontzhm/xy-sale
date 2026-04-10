import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 与 `next.config.ts` 同目录，即本应用根目录（不随启动 cwd 变化） */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * 父级目录另有 `pnpm-lock.yaml` 时，Turbopack 会报「Detected additional lockfiles」。
   * 显式指定 root 后只以本仓库为边界。
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
   */
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
