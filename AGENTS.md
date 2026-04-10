<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 项目文档（xy-sale）

架构与数据关系说明在 **`md/`** 目录（入口：`md/README.md`）。

**约定**：改 Prisma 模型、对货/报表逻辑、主要路由或存储流程时，同步更新 `md/data-model.md` 或 `md/architecture.md`。具体触发条件见 **`.cursor/rules/sync-project-docs.mdc`**（Cursor 会据此提醒 AI）；人工开发也请对照该列表自检。

后台**表格列表 + 新建**类页面约定见 **`.cursor/rules/table-pages.mdc`**（ProTable、`/api/.../table`、抽屉 + `BetaSchemaForm`）。

在 Cursor 中也可到 **Settings → Rules** 查看/启用项目规则；规则文件位于 `.cursor/rules/`。
