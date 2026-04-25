# 架构说明

## 项目定位

**对货系统**：围绕「衣服档案 + SKU」串联 **订货**、**厂家发货**、**入库** 三类业务单据，在「统计 / 对货」中按 SKU / 衣服 / 厂家维度汇总件数，用于核对欠发、在途等差异。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript 5 |
| UI | React 19、Tailwind CSS 4、Ant Design 6、**@ant-design/pro-components**（如衣服档案 `ProTable`）；根布局通过 `@ant-design/nextjs-registry` 做 SSR 样式 |
| 数据访问 | Prisma 6 + `@prisma/client` |
| 数据库 | 开发默认 SQLite（`DATABASE_URL` 指向本地文件）；生产可换 PostgreSQL（改 `provider` 与 URL） |
| 包管理 | pnpm 10；Node ≥ 22（见 `package.json` engines、`.nvmrc`） |

## 仓库顶层结构（节选）

```
xy-sale/
├── prisma/schema.prisma
├── src/app/              # Next.js App Router
├── src/components/       # 共享客户端组件
├── src/lib/              # Prisma、存储、报表
├── storage/photos/       # 上传照片落盘
├── md/                   # 说明文档
├── package.json
└── .env / .env.example
```

## `src/app` 路由与页面

根布局 `app/layout.tsx`：字体、全局样式、`AntdAppProvider`。

业务页面在 `app/(dashboard)/`，共用顶栏导航：

| 路径 | 作用 |
|------|------|
| `/` | 概览 |
| `/products`、`/products/new`、`/products/[id]`、`/products/[id]/edit` | 衣服档案（Product + SKU） |
| `/orders`、… | 订货单（列表为 `ProTable`，`GET /api/orders/table`） |
| `/shipments`、… | 厂家发货登记（列表为 `ProTable`，`GET /api/shipments/table`） |
| `/inbound`、… | 入库登记（同上，`GET /api/inbound/table`） |
| `/reports` | 统计 / 对货 |

动态路由使用 Next 约定：**`params` 为 Promise**，在页面中需 `await params`。

**列表筛选**：

- **`?productId=<衣服档案 id>`**：订货、厂家发货、入库列表可按款筛选（从衣服档案点击件数进入）。解析见 `lib/products/list-filter.ts`，提示条见 `components/product-list-filter-banner.tsx`。
- **`?q=`**：衣服档案、订货、发货、入库、统计对货等支持关键词搜索；订货/发货/入库列表在 **`ProTable`** 内搜索并请求对应 **`/api/.../table`**。Prisma 条件在 `lib/list-search.ts`；部分旧页仍用 `components/table-search-bar.tsx` 的 GET 表单。

## `src/lib` 模块

| 路径 | 职责 |
|------|------|
| `lib/prisma.ts` | 单例 `PrismaClient` |
| `lib/storage/*` | 照片保存/读取、本地图片 URL、OSS 上传封装 |
| `lib/reports/reconciliation.ts` | 订货/发货/入库按 `skuId` 聚合；厂家/衣服/单款汇总 |
| `lib/orders/order-manufacturer.ts` | `$queryRaw` 读取 `Order.manufacturerId` |
| `lib/format-datetime-local.ts` | 日期时间展示辅助 |

## Server Actions

表单提交以 **Server Actions**（`"use server"`）为主，各模块 `actions.ts`：

- `products/actions.ts`：衣服与 SKU、图片
- `orders/actions.ts`：订货单；校验厂家与 SKU 归属（含 `createOrderInline`，供列表抽屉保存后不整页跳转）
- `shipments/actions.ts`：发货登记与照片（含 `createShipmentInline`，供列表抽屉保存后不整页跳转）
- `inbound/actions.ts`：入库登记（含 `createInboundInline`）

常见模式：`useActionState`、隐藏字段传 `linesJson`、`revalidatePath`、`redirect`；列表抽屉内保存用 `*Inline` + 仅 `revalidatePath`。

## HTTP API Routes

| 路径 | 说明 |
|------|------|
| `app/api/photos/[name]/route.ts` | `GET`：从 `storage/photos` 读照片 |
| `app/api/upload/route.ts` | `POST`：接收 `file`（FormData）并上传到阿里云 OSS，返回 `fileName/url/mimeType` |
| `app/api/products/table/route.ts` | `GET`：衣服档案 `ProTable` 分页与筛选 |
| `app/api/inbound/table/route.ts` | `GET`：入库列表 `ProTable` 分页与 `filterMeta` |
| `app/api/orders/table/route.ts` | `GET`：订货列表 `ProTable` 分页与 `filterMeta` |
| `app/api/shipments/table/route.ts` | `GET`：厂家发货列表 `ProTable` 分页与 `filterMeta` |

## 构建与数据库脚本

```bash
pnpm install          # postinstall: prisma generate
pnpm db:push          # 同步开发库结构
pnpm dev              # predev: prisma generate
pnpm build            # prebuild: prisma generate
```

## 数据流（简图）

```
浏览器表单/页面
    → Server Actions 或 RSC 内 prisma 查询
    → Prisma → SQLite（或 PostgreSQL）
    → 照片上传（可选）→ /api/upload → 阿里云 OSS
    → 业务照片读写（现存逻辑）→ storage/photos → /api/photos/[name]
```

## 扩展与部署注意

- 换 PostgreSQL：改 `schema.prisma` 的 `datasource` 与 `DATABASE_URL`；若有手写 SQL 需按方言复核。
- 多实例部署：本地 `storage/photos` 需改为共享存储或对象存储，并调整上传与 URL 逻辑。
