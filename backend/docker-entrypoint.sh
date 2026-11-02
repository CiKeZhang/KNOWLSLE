#!/bin/sh
# 启动器: 确保 SQLite db 存在(优先用镜像内置 seed),然后启动 NestJS

echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"
mkdir -p /app/data /app/uploads

# 从 DATABASE_URL 提取 db 路径 (file:/app/data/kygl.db -> /app/data/kygl.db)
DB_PATH=$(echo "${DATABASE_URL}" | sed 's|^file:||')

if [ -f "${DB_PATH}" ]; then
  echo "[entrypoint] 数据库已存在 (${DB_PATH}), 使用现有数据"
elif [ -f /app/prisma/dev.db ]; then
  echo "[entrypoint] 首次启动: 从镜像内置 seed 初始化数据库..."
  cp /app/prisma/dev.db "${DB_PATH}"
  echo "[entrypoint] seed 复制完成 ($(du -h "${DB_PATH}" | cut -f1))"
else
  echo "[entrypoint] 无 seed, 执行 prisma db push 建空表..."
  npx prisma db push --skip-generate 2>&1 || echo "[entrypoint] db push 失败,继续启动..."
fi

echo "[entrypoint] 启动 NestJS: node dist/src/main.js"
exec node --max-old-space-size=512 dist/src/main.js
