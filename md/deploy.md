# 生产部署指南（Ubuntu + Nginx + PM2）

本文给出一套可直接照做的部署流程，目标是把 `xy-sale` 稳定跑在 Linux 服务器上。

## 1. 服务器条件

最低可用：

- 2 vCPU / 4 GB RAM / 40 GB SSD
- Ubuntu 22.04 LTS
- 安全组放行：`22`、`80`、`443`

推荐：

- 4 vCPU / 8 GB RAM / 80 GB SSD
- 独立 MySQL/PostgreSQL（生产不建议长期使用 SQLite）

## 2. 项目运行依赖

本项目要求：

- Node.js `>= 22`
- pnpm `10.6.5`
- Prisma（安装依赖时会自动 `prisma generate`）

## 3. 环境变量准备

复制环境变量模板：

```bash
cp .env.example .env
```

至少需要填写：

```bash
DATABASE_URL=
ALIOSS_REGION=
ALIOSS_BUCKET=
ALIOSS_ACCESS_KEY_ID=
ALIOSS_ACCESS_KEY_SECRET=
```

可选：

```bash
MOONSHOT_API_KEY=
ALIOSS_ENDPOINT=
```

## 4. 首次部署（从 0 到可访问）

以下命令假设你使用 `root` 或有 sudo 权限用户。

### 4.1 安装 Node 22 与 pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm i -g pnpm@10.6.5
node -v
pnpm -v
```

### 4.2 拉取代码

```bash
sudo mkdir -p /srv
cd /srv
sudo git clone <你的仓库地址> xy-sale
sudo chown -R $USER:$USER /srv/xy-sale
cd /srv/xy-sale
```

### 4.3 安装依赖并配置环境变量

```bash
pnpm install
cp .env.example .env
# 编辑 .env，填入生产配置
```

### 4.4 初始化数据库

```bash
pnpm db:push
```

### 4.5 构建并本地启动验证

```bash
pnpm build
pnpm start
```

出现类似 `ready - started server on ...:3000` 说明应用已正常启动。  
可在服务器上先用 `curl http://127.0.0.1:3000` 进行验证。

## 5. 使用 PM2 守护进程

安装并启动：

```bash
sudo npm i -g pm2
cd /srv/xy-sale
pm2 start "pnpm start" --name xy-sale
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 status
pm2 logs xy-sale
pm2 restart xy-sale
pm2 stop xy-sale
```

## 6. 配置 Nginx 反向代理

安装 Nginx：

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

创建站点配置 `/etc/nginx/sites-available/xy-sale`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并重载：

```bash
sudo ln -s /etc/nginx/sites-available/xy-sale /etc/nginx/sites-enabled/xy-sale
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 配置 HTTPS（Let's Encrypt）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

验证自动续期：

```bash
sudo certbot renew --dry-run
```

## 8. 更新发布流程

每次代码更新建议按以下顺序：

```bash
cd /srv/xy-sale
git pull
pnpm install
pnpm db:push
pnpm build
pm2 restart xy-sale
```

## 9. 常见问题排查

- 页面 502：先看 `pm2 status`，再看 `pm2 logs xy-sale`
- Nginx 不生效：`sudo nginx -t` 检查配置语法
- 上传失败：检查 OSS 五个环境变量是否完整
- 构建失败：确认 Node 版本是 22+，并重新 `pnpm install`
- 数据库连不上：检查 `DATABASE_URL`、网络白名单、账号权限

## 10. 上线前检查清单

- [ ] `node -v` 为 22+
- [ ] `.env` 已配置且不包含示例空值
- [ ] `pnpm build` 成功
- [ ] `pm2 status` 为 online
- [ ] `https://your-domain.com` 可访问
- [ ] 图片上传可用（OSS）

