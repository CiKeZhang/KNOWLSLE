# 考研进度管控 - Dockerfile
# 策略:构建时装依赖+编译,启动时 entrypoint 按优先级准备 SQLite 数据库

FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# 数据目录;在云托管服务配置里把持久卷(CFS/COS)挂到该路径即可持久化
ENV DATA_DIR=/app/data

# Prisma 引擎需要 openssl
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./

# 编译:不再用 `|| true` 吞掉编译错误,任何一步失败都必须让构建失败
RUN chmod +x docker-entrypoint.sh \
    && npm ci --no-audit --no-fund \
    && npx prisma generate \
    && ./node_modules/.bin/tsc -p tsconfig.json \
    && test -f dist/src/main.js

RUN mkdir -p /app/data /app/data/backups /app/uploads

EXPOSE 3000

# entrypoint: 优先沿用现有库 → 待恢复文件 → 最新备份 → 镜像内置 seed → 建空表
CMD ["./docker-entrypoint.sh"]
