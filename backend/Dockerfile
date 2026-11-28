# TODO: multi-stage build
#  - Stage 1 (deps): node:20-alpine, COPY package*.json, npm ci --omit=dev
#  - Stage 2 (runtime): salin node_modules, src/, migrations/; NODE_ENV=production
#  - Jalankan sebagai user non-root (USER node)
#  - HEALTHCHECK ke /health
#  - CMD ["node", "src/server.js"]

# Tahap 1: pasang dependensi produksi saja
FROM node:26-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Tahap 2: image akhir, hanya berisi yang dibutuhkan untuk berjalan
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]