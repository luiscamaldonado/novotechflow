# Stage 1: Build
FROM node:20-alpine AS builder
ENV LANG=C.UTF-8
WORKDIR /app
RUN npm install -g pnpm@9.0.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api/ apps/api/
RUN cd apps/api && npx prisma generate
RUN cd apps/api && pnpm build

# Stage 2: Production
FROM node:20-alpine AS runner
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
WORKDIR /app
RUN npm install -g pnpm@9.0.0
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/tsconfig.json ./
COPY --from=builder /app/apps/api/uploads/defaults ./uploads/defaults
RUN mkdir -p uploads/signatures uploads/templates
EXPOSE 3000
RUN npm install prisma ts-node typescript
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
