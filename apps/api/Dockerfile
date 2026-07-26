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
COPY apps/api/ apps/api/
RUN cd apps/api && pnpm exec prisma generate
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
RUN pnpm install --frozen-lockfile --filter api... --prod --config.node-linker=hoisted
COPY apps/api/prisma apps/api/prisma
RUN cd apps/api && pnpm exec prisma generate

# Stage 3: Production
FROM node:22-alpine AS runner
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/tsconfig.json ./
RUN mkdir -p uploads/signatures uploads/templates
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
