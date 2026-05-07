#!/usr/bin/env bash
# 在本机执行：SSH 到服务器，在 ~/xy-sale（可配置）执行 git pull → pnpm install → pnpm build → pm2 restart。
# 用法：./scripts/deploy.sh
# 环境变量：DEPLOY_HOST（默认 han）、REMOTE_APP（默认 xy-sale，即远端 ~/xy-sale）、PM2_NAME（默认 xy-sale）
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-han}"
REMOTE_APP="${REMOTE_APP:-xy-sale}"
PM2_NAME="${PM2_NAME:-xy-sale}"

exec ssh "$DEPLOY_HOST" bash -s -- "$REMOTE_APP" "$PM2_NAME" <<'REMOTE'
set -euo pipefail
REMOTE_APP="$1"
PM2_NAME="$2"
cd "$HOME/${REMOTE_APP}"
git pull
pnpm install
pnpm build
# 不用在此处执行 pnpm start：PM2 已托管进程，restart 即会拉起 next start
pm2 restart "${PM2_NAME}"
REMOTE
