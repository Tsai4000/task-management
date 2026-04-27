FROM node:20-alpine AS builder

# better-sqlite3 編譯原生模組需要這些工具（prebuilt 抓不到時的 fallback）
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── 生產階段：只保留執行所需 ──────────────────────────────
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY package.json ./

EXPOSE 3334

CMD ["node", "dist/db-server/index.js"]
