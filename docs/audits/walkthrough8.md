# DevOps & Documentación — Walkthrough

## Resumen

Se implementaron 5 mejoras de DevOps y documentación para el monorepo NovoTechFlow:

1. Dockerfile para la API (multi-stage build)
2. Dockerfile para el Frontend (multi-stage build con nginx)
3. Actualización del docker-compose.yml con los 3 servicios
4. Reescritura completa del README.md
5. Scripts de migración en el API package.json

---

## Archivos Creados

### 1. API Dockerfile
```diff:Dockerfile
===
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api/ apps/api/
RUN cd apps/api && npx prisma generate
RUN cd apps/api && pnpm build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
RUN mkdir -p uploads/signatures uploads/defaults uploads/templates
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 2. API .dockerignore
```diff:.dockerignore
===
node_modules
dist
.env
uploads/
```

### 3. Web Dockerfile
```diff:Dockerfile
===
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
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
```

### 4. Web nginx.conf
```diff:nginx.conf
===
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://api:3000/;
    }
}
```

### 5. Web .dockerignore
```diff:.dockerignore
===
node_modules
dist
.env
```

---

## Archivos Modificados

### 6. docker-compose.yml
```diff:docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: novotechflow-db
    environment:
      POSTGRES_USER: ${DB_USER:-novotechflow}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: ${DB_NAME:-novotechflow}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
===
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: novotechflow-db
    environment:
      POSTGRES_USER: ${DB_USER:-novotechflow}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: ${DB_NAME:-novotechflow}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${DB_USER:-novotechflow}:${DB_PASSWORD:-changeme}@db:5432/${DB_NAME:-novotechflow}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost}
    depends_on:
      - db
    volumes:
      - api_uploads:/app/uploads

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: http://localhost:3000
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  postgres-data:
  api_uploads:

```

### 7. apps/api/package.json — Scripts de migración
```diff:package.json
{
  "name": "api",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/throttler": "^6.5.0",
    "@prisma/client": "5.10.2",
    "axios": "^1.13.6",
    "bcrypt": "^6.0.0",
    "cheerio": "^1.2.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "file-type": "19",
    "helmet": "^8.1.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1",
    "sanitize-html": "^2.17.2"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^6.0.0",
    "@types/cheerio": "^1.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.2",
    "@types/multer": "^2.1.0",
    "@types/node": "^20.3.1",
    "@types/node-fetch": "^2.6.13",
    "@types/passport-jwt": "^4.0.1",
    "@types/sanitize-html": "^2.16.1",
    "@types/supertest": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^8.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "prisma": "5.10.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
===
{
  "name": "api",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/throttler": "^6.5.0",
    "@prisma/client": "5.10.2",
    "axios": "^1.13.6",
    "bcrypt": "^6.0.0",
    "cheerio": "^1.2.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "file-type": "19",
    "helmet": "^8.1.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1",
    "sanitize-html": "^2.17.2"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^6.0.0",
    "@types/cheerio": "^1.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.2",
    "@types/multer": "^2.1.0",
    "@types/node": "^20.3.1",
    "@types/node-fetch": "^2.6.13",
    "@types/passport-jwt": "^4.0.1",
    "@types/sanitize-html": "^2.16.1",
    "@types/supertest": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^8.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "prisma": "5.10.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

### 8. README.md — Reescritura completa
```diff:README.md
# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo build
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=docs
```

Without global `turbo`:

```sh
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
===
# NovoTechFlow

**Sistema de cotizaciones comerciales para NOVOTECHNO.**

NovoTechFlow es una plataforma integral para la gestión y generación de cotizaciones/propuestas comerciales: creación de escenarios, cálculo automático de precios, generación de documentos PDF y seguimiento del pipeline de ventas.

---

## Stack Técnico

| Capa | Tecnología |
|------|------------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React 18 + Vite + TypeScript |
| Backend | NestJS 10 + TypeScript |
| Base de datos | PostgreSQL 15 + Prisma ORM |
| Desktop agent | Tauri (Rust + WebView) |
| Containerización | Docker + docker-compose |

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **PostgreSQL** 15+ (local o vía Docker)

---

## Quick Start

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-org/novotechflow.git
cd novotechflow

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env con tus valores reales

# 4. Ejecutar migraciones de base de datos
cd apps/api
pnpm migrate:dev
cd ../..

# 5. Seed de datos iniciales
cd apps/api
pnpm db:seed
cd ../..

# 6. Arrancar en modo desarrollo
pnpm dev
```

La API arranca en `http://localhost:3000` y el frontend en `http://localhost:5173`.

---

## Variables de Entorno

Consulta [`apps/api/.env.example`](apps/api/.env.example) para la referencia completa. Variables principales:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string de PostgreSQL | — |
| `JWT_SECRET` | Secreto para firmar tokens JWT | — |
| `CORS_ORIGIN` | Orígenes permitidos (CORS) | `http://localhost:5173` |
| `DB_USER` | Usuario de PostgreSQL (Docker) | `novotechflow` |
| `DB_PASSWORD` | Contraseña de PostgreSQL (Docker) | `changeme` |
| `DB_NAME` | Nombre de la base de datos (Docker) | `novotechflow` |

---

## Scripts Disponibles

### Raíz del monorepo

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Arranca todos los servicios en modo desarrollo |
| `pnpm build` | Compila todos los apps y packages |
| `pnpm lint` | Ejecuta el linter en todo el monorepo |
| `pnpm format` | Formatea el código con Prettier |
| `pnpm check-types` | Verifica tipos TypeScript |

### API (`apps/api`)

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Arranca el servidor NestJS con hot-reload |
| `pnpm build` | Compila el proyecto NestJS |
| `pnpm test` | Ejecuta tests unitarios |
| `pnpm migrate:dev` | Ejecuta migraciones en desarrollo |
| `pnpm migrate:deploy` | Aplica migraciones en producción |
| `pnpm db:seed` | Ejecuta el seed de datos |
| `pnpm db:studio` | Abre Prisma Studio |

---

## Docker Deployment

Levanta toda la infraestructura con un solo comando:

```bash
# Crear archivo .env en la raíz con las variables necesarias
# (ver apps/api/.env.example para referencia)

docker-compose up -d --build
```

Esto levanta tres servicios:

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| `db` | 5432 | PostgreSQL 15 Alpine |
| `api` | 3000 | Backend NestJS |
| `web` | 80 | Frontend Nginx + React |

Para detener:

```bash
docker-compose down
```

Para detener y eliminar volúmenes:

```bash
docker-compose down -v
```

---

## Estructura del Monorepo

```
novotechflow/
├── apps/
│   ├── api/                 # Backend — NestJS + Prisma
│   │   ├── prisma/          # Schema, migraciones y seeds
│   │   ├── src/             # Módulos, controladores, servicios
│   │   ├── Dockerfile       # Build multi-stage (Node Alpine)
│   │   └── .env.example     # Variables de entorno de referencia
│   ├── web/                 # Frontend — React + Vite
│   │   ├── src/             # Componentes, páginas, hooks, stores
│   │   ├── Dockerfile       # Build multi-stage (Node + Nginx)
│   │   └── nginx.conf       # Configuración Nginx con SPA fallback
│   └── agent/               # Desktop agent — Tauri
├── packages/
│   ├── eslint-config/       # Configuración ESLint compartida
│   ├── typescript-config/   # tsconfig.json compartidos
│   └── ui/                  # Componentes React reutilizables
├── docs/
│   ├── audits/              # Auditorías técnicas y reportes
│   └── NovoTechFlow_Plan_Implementacion.txt
├── docker-compose.yml       # Orquestación de servicios
├── CONVENTIONS.md           # Convenciones de código del proyecto
├── turbo.json               # Configuración de Turborepo
├── pnpm-workspace.yaml      # Definición del workspace
└── package.json             # Scripts y dependencias del monorepo
```

---

## Documentación Adicional

- [CONVENTIONS.md](CONVENTIONS.md) — Convenciones de código, nombrado y arquitectura del proyecto
- [docs/audits/](docs/audits/) — Auditorías técnicas y reportes de calidad

---

## Licencia

Proyecto privado — NOVOTECHNO © 2026. Todos los derechos reservados.

```

---

## Verificación

No se ejecutó Docker ni pnpm según lo solicitado. Todos los archivos fueron creados/modificados únicamente en disco.

### Checklist

| # | Tarea | Estado |
|---|-------|--------|
| 1 | `apps/api/Dockerfile` — multi-stage Node 20 Alpine | ✅ |
| 2 | `apps/api/.dockerignore` | ✅ |
| 3 | `apps/web/Dockerfile` — multi-stage Node + Nginx | ✅ |
| 4 | `apps/web/nginx.conf` — SPA fallback + proxy | ✅ |
| 5 | `apps/web/.dockerignore` | ✅ |
| 6 | `docker-compose.yml` — db + api + web + volumes | ✅ |
| 7 | `README.md` — reescritura completa del proyecto | ✅ |
| 8 | `apps/api/package.json` — migrate/seed/studio scripts | ✅ |
