# ── Stage 1: instalar dependências ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# ── Stage 2: build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis públicas precisam estar disponíveis no build
ARG NEXT_PUBLIC_WA_NUMBER=5517996383708
ENV NEXT_PUBLIC_WA_NUMBER=$NEXT_PUBLIC_WA_NUMBER

ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG API_ORIGIN=http://localhost:8080
ENV API_ORIGIN=$API_ORIGIN

RUN npm run build

# ── Stage 3: produção ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "start"]
