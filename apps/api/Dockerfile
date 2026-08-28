# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# monorepo: apps/api has no standalone lockfile, so use install (not ci)
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# openssl needed by Prisma engine on alpine
RUN apk add --no-cache openssl bash
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3001
# Entrypoint switches Prisma to Postgres (if DATABASE_URL is postgres), runs
# migrations, then starts the server.
ENTRYPOINT ["./docker-entrypoint.sh"]
