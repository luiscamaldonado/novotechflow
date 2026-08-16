# Stage 1: Build
FROM node:22-alpine AS builder
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
WORKDIR /app
RUN npm install -g pnpm@10.33.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter api...
RUN pnpm --filter @repo/item-display build
RUN pnpm --filter @repo/pricing-engine build
COPY apps/api/ apps/api/
# prisma.config.ts exige DATABASE_URL al cargarse; generate no toca la base: placeholder solo para este RUN
RUN cd apps/api && DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate
RUN cd apps/api && pnpm build

# Stage 2: Production dependencies (prod-only tree from lockfile, hoisted)
FROM node:22-alpine AS prod-deps
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
WORKDIR /app
RUN npm install -g pnpm@10.33.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
COPY --from=builder /app/packages/item-display/dist packages/item-display/dist
COPY --from=builder /app/packages/pricing-engine/dist packages/pricing-engine/dist
RUN pnpm install --frozen-lockfile --filter api... --prod --config.node-linker=hoisted

# Stage 3: Production
FROM node:22-alpine AS runner
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/item-display/package.json ./node_modules/@repo/item-display/package.json
COPY --from=builder /app/packages/item-display/dist ./node_modules/@repo/item-display/dist
COPY --from=builder /app/packages/pricing-engine/package.json ./node_modules/@repo/pricing-engine/package.json
COPY --from=builder /app/packages/pricing-engine/dist ./node_modules/@repo/pricing-engine/dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/tsconfig.json ./
RUN mkdir -p uploads/signatures uploads/templates
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
