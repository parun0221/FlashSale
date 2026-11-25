# TODO: multi-stage build
#  - Stage 1 (deps): node:20-alpine, COPY package*.json, npm ci --omit=dev
#  - Stage 2 (runtime): salin node_modules, src/, migrations/; NODE_ENV=production
#  - Jalankan sebagai user non-root (USER node)
#  - HEALTHCHECK ke /health
#  - CMD ["node", "src/server.js"]
