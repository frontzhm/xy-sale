"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

/** 根级接入 Ant Design：SSR 样式 + 中文文案。页面中直接 `import { Button, Form, ... } from 'antd'` 即可。 */
export function AntdAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
    </AntdRegistry>
  );
}
