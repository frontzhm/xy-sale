#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-xy-sale}"
APP_DIR="${APP_DIR:-$HOME/xy-sale}"

echo "==> deploy app: ${APP_NAME}"
echo "==> app dir: ${APP_DIR}"

if [ ! -d "${APP_DIR}" ]; then
  echo "ERROR: app dir not found: ${APP_DIR}" >&2
  exit 1
fi

cd "${APP_DIR}"

echo "==> git pull"
git pull

echo "==> pnpm install"
pnpm install

echo "==> prisma db push"
pnpm db:push

echo "==> next build"
pnpm build

echo "==> restart pm2 app"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}"
else
  pm2 start "pnpm start" --name "${APP_NAME}"
fi

echo "==> pm2 status"
pm2 status

echo "==> deploy done"
