# 服务器日常运维命令（xy-sale）

## 1. 基础连通检查（本机执行）

```shell
dig +short xy.sixsixrun.com

dig +short xyapi.sixsixrun.com
```

## 2. 服务状态检查（服务器执行）

```shell
pm2 status
sudo systemctl status nginx --no-pager
sudo ss -ltnp | grep ':80 '
sudo ss -ltnp | grep ':443 '
```

## 3. 日志排查（服务器执行）

```shell
# 应用日志
pm2 logs xy-sale --lines 200

# Nginx 错误日志
sudo tail -n 200 /var/log/nginx/error.log

# Nginx 访问日志
sudo tail -n 200 /var/log/nginx/access.log
```

## 4. Nginx 配置生效（服务器执行）

```shell
sudo nginx -t
sudo systemctl reload nginx
```

## 5. HTTPS 证书检查（服务器执行）

```shell
# 仅检查 xy 证书续签能力（推荐）
sudo certbot renew --dry-run --cert-name xy.sixsixrun.com

# 查看本机已有证书
sudo certbot certificates
```

## 6. 发布更新（服务器执行）

```shell
cd ~/xy-sale
git pull
pnpm install
pnpm db:push
pnpm build
pm2 restart xy-sale
pm2 status
```

### 一键发布脚本（推荐）

仓库内已提供脚本：`scripts/release.sh`。

```shell
# 首次执行赋予权限（在项目根目录）
chmod +x scripts/release.sh

# 默认发布 ~/xy-sale，PM2 进程名 xy-sale
./scripts/release.sh
```

可选自定义：

```shell
APP_DIR=~/xy-sale APP_NAME=xy-sale ./scripts/release.sh
```

## 7. 常用重启（服务器执行）

```shell
# 仅重启应用
pm2 restart xy-sale

# 重启 Nginx
sudo systemctl restart nginx
```

## 8. 快速健康检查（服务器执行）

```shell
curl -I http://127.0.0.1:3000
curl -I https://xy.sixsixrun.com
curl -I https://xyapi.sixsixrun.com
```

## 9. 故障速查（服务器执行）

```shell
# Nginx 启动失败
sudo systemctl status nginx --no-pager -l
sudo journalctl -u nginx -n 100 --no-pager

# 80/443 端口占用排查
sudo ss -ltnp | grep ':80 '
sudo ss -ltnp | grep ':443 '
```
