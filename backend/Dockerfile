# 考研进度管控与智能辅导系统 - 后端镜像
# 构建: docker build -t kygl-backend .
# 运行: docker compose up -d

# ---------- 构建阶段 ----------
FROM node:20-slim AS builder
WORKDIR /app

# Prisma 引擎依赖 openssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---------- 运行阶段 ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
# 保留完整 node_modules(含 prisma CLI,启动时用于同步表结构)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
