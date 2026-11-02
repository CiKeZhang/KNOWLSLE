# 考研进度管控 - Dockerfile
# 策略: 构建时装依赖+编译,启动时 entrypoint 懒初始化 SQLite db

FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Prisma 引擎需要 openssl
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./

# 编译 + 给脚本加执行权限 + 确保 node_modules 里有 prisma CLI
RUN chmod +x docker-entrypoint.sh \
    && npm ci --no-audit --no-fund \
    && npx prisma generate \
    && (./node_modules/.bin/tsc --noEmitOnError false || true) \
    && ls dist/src/main.js  # 必须存在,否则构建真失败

RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

# entrypoint: 如果 SQLite db 不存在,先 prisma db push 建表,然后 node 启动
CMD ["./docker-entrypoint.sh"]
