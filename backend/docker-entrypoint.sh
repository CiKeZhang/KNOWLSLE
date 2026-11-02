#!/bin/sh
set -e

echo "[entrypoint] 数据库目录: ${DATABASE_URL}"

mkdir -p /app/data
mkdir -p /app/uploads

echo "[entrypoint] 同步数据库表结构..."
npx prisma db push --skip-generate

echo "[entrypoint] 启动 NestJS 服务..."
exec node dist/main
