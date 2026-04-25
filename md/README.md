# 项目文档（xy-sale / 对货）

本目录存放**架构说明**与**数据关系**说明，便于接手开发与对账口径对齐。

| 文档 | 内容 |
|------|------|
| [architecture.md](./architecture.md) | 技术栈、目录结构、路由、Server Actions、API、文件存储 |
| [data-model.md](./data-model.md) | Prisma 实体关系、业务含义、对货汇总口径 |
| [deploy.md](./deploy.md) | 生产部署步骤（服务器条件、环境变量、Nginx、HTTPS、发布流程） |

单一事实来源仍以代码与 `prisma/schema.prisma` 为准；文档随迭代可继续补充。
