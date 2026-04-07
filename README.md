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
