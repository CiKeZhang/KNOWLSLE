#!/bin/sh
# 启动器:确保 SQLite 数据库就绪(优先级见 scripts/prepare-db.js),再启动 NestJS。
# 数据目录可用 DATA_DIR 覆盖;在云托管服务配置里把持久卷挂到该路径即可实现数据持久化。

DATA_DIR="${DATA_DIR:-/app/data}"
export DATA_DIR

echo "[entrypoint] DATABASE_URL=${DATABASE_URL:-<unset>}"
echo "[entrypoint] DATA_DIR=${DATA_DIR}"
echo "[entrypoint] BACKUP_DIR=${BACKUP_DIR:-$DATA_DIR/backups}"

node /app/scripts/prepare-db.js
code=$?

if [ "$code" -eq 2 ]; then
  echo "[entrypoint] 无可用数据,执行 prisma db push 建空表..."
  npx prisma db push --skip-generate 2>&1 || echo "[entrypoint] db push 失败,继续启动..."
elif [ "$code" -ne 0 ]; then
  echo "[entrypoint] 数据库准备失败(code=$code),终止启动"
  exit 1
fi

echo "[entrypoint] 启动 NestJS: node dist/src/main.js"
exec node --max-old-space-size=512 dist/src/main.js
