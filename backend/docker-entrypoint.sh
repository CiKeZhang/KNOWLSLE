#!/bin/sh
# 极简启动器:任何步骤失败都不阻塞 node 启动

echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"
mkdir -p /app/data
mkdir -p /app/uploads

# Prisma db push 很容易因 openssl/引擎版本在容器里挂掉,跳过不影响 SQLite 本地启动
# 如果后续需要同步表结构,在本地跑完后把 dev.db 复制上去也行
echo "[entrypoint] 跳过 prisma db push,直接启动 NestJS"

# --max-old-space-size=512 防止 Node 吃掉太多内存
echo "[entrypoint] 启动 node dist/main..."
exec node --max-old-space-size=512 dist/main 2>&1
