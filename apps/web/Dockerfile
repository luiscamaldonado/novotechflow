# Stage 1: Build
FROM node:20-alpine AS builder
ENV LANG=C.UTF-8
WORKDIR /app
RUN npm install -g pnpm@8.15.5
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter web...
COPY apps/web/ apps/web/
ARG VITE_API_URL=http://localhost:3000
RUN cd apps/web && pnpm build

# Stage 2: Serve
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
