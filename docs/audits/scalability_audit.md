# 🏗️ Auditoría de Arquitectura — NovoTechFlow: Readiness para Escalar

> **Fecha:** 2026-04-06  
> **Auditor:** Consultor de Arquitectura Senior  
> **Alcance:** 5 dimensiones — DB, Frontend Performance, DevOps, Documentación, Deuda Técnica

---

## 1. BASE DE DATOS (Prisma)

### 1.1 Inventario de Modelos y Relaciones

| Modelo | Relaciones | Notas |
|:---|:---|:---|
| **User** | → Proposal[], PdfTemplate[], SyncedFile[], EmailLog[], BillingProjection[] | Hub central |
| **Proposal** | → User, Client?, ProposalVersion[], ProposalItem[], ProposalPage[], Scenario[], SyncedFile[], EmailLog[] | Entidad más conectada (8 relaciones) |
| **ProposalVersion** | → Proposal, EmailLog[] | Snapshots JSON |
| **ProposalPage** | → Proposal, ProposalPageBlock[], ProposalItem[] | Páginas del documento |
| **ProposalPageBlock** | → ProposalPage (onDelete: Cascade) | **Único modelo con Cascade** |
| **ProposalItem** | → Proposal, ProposalPage?, ScenarioItem[] | Ítems de la cotización |
| **Scenario** | → Proposal, ScenarioItem[] | Escenarios de cálculo |
| **ScenarioItem** | → Scenario, ProposalItem, ScenarioItem? (self-ref parent/children) | Árbol jerárquico |
| **PdfTemplate** | → User (author) | Plantillas globales |
| **SyncedFile** | → User, Proposal? | Archivos sincronizados |
| **EmailLog** | → User, Proposal, ProposalVersion? | Log de correos |
| **Client** | → Proposal[] | Catálogo de clientes |
| **Catalog** | (ninguna FK) | Catálogo de valores |
| **BillingProjection** | → User | Proyecciones de facturación |

**Total: 14 modelos, 2 enums (Role, ProposalStatus, ItemType, PageType, BlockType, SyncStatus, AcquisitionType)**

---

### 1.2 Índices — Estado Actual vs. Necesarios

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **CERO índices `@@index` definidos** en todo el schema. Solo existen `@unique` (email, proposalCode, projectionCode, Client.name, Catalog[category,value]) | **Alta** | 2h | Agregar índices compuestos (ver abajo) |
| FK `userId` en Proposal, SyncedFile, EmailLog, BillingProjection no indexada | **Alta** | 30m | `@@index([userId])` en cada modelo con FK a User |
| FK `proposalId` en ProposalItem, ProposalPage, Scenario, ProposalVersion, SyncedFile, EmailLog no indexada | **Alta** | 30m | `@@index([proposalId])` en cada modelo hijo |
| FK `pageId` en ProposalPageBlock, `scenarioId` en ScenarioItem, `itemId` en ScenarioItem no indexadas | **Alta** | 30m | `@@index([pageId])`, `@@index([scenarioId])`, `@@index([itemId])` |
| `Proposal.status` se usa en **todas** las queries de Dashboard pero no tiene índice | **Media** | 10m | `@@index([status])` |
| `Proposal.clientName` con `contains insensitive` (búsqueda) — no hay índice GIN/trigram | **Media** | 1h | Crear extensión `pg_trgm` + índice GIN para búsqueda LIKE |
| `Client.name` con `contains insensitive` en `findWithRelevanceRanking` — rendimiento O(n) | **Media** | 1h | Índice GIN trigram en `clients.name` |
| `Proposal.createdAt` usado en `findPotentialConflicts` con rango temporal | **Baja** | 10m | `@@index([createdAt])` en Proposal |

> [!IMPORTANT]
> **Sin ningún índice definido**, cada query que filtre por FK resort a sequential scan. Con 1,000+ propuestas esto degradará significativamente el rendimiento. Este es el hallazgo más crítico de la auditoría.

**Índices recomendados (migración):**
```prisma
// Proposal
@@index([userId])
@@index([status])
@@index([clientId])
@@index([createdAt])

// ProposalItem
@@index([proposalId])

// ProposalPage
@@index([proposalId])

// ProposalPageBlock
@@index([pageId])

// Scenario
@@index([proposalId])

// ScenarioItem
@@index([scenarioId])
@@index([itemId])
@@index([parentId])

// SyncedFile
@@index([userId])
@@index([proposalId])

// EmailLog
@@index([userId])
@@index([proposalId])

// BillingProjection
@@index([userId])
```

---

### 1.3 Queries N+1

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| `ProposalsService.findAll()` — carga **TODAS** las propuestas con `include { scenarios { scenarioItems { item, children { item } } } }` — **query multinivel profunda (4 niveles)** | **Alta** | 4h | Implementar paginación + no eager-load scenarios en listado. Mover cálculo de subtotal al backend en query separada |
| `ProposalsService.cloneProposal()` — loop `for-of` sobre `proposalItems` y `scenarioItems` con `create` individual = **N+1 writes** | **Media** | 3h | Usar `createMany` de Prisma para batch insert |
| `ScenariosService.cloneScenario()` — mismo patrón: loop de creates individuales | **Media** | 2h | Usar `createMany` |
| `PagesService.initializeDefaultPages()` — loop de creates individuales para pages y blocks | **Baja** | 1h | Usa `createMany` para bloques |
| `ClientsService.getSmartSuggestion()` — carga hasta 1,000 clientes en memoria para calcular similitud | **Media** | 4h | Migrar a `pg_trgm` + similarity search en SQL |
| `UsersService.deleteUser()` — 10+ queries manuales de DELETE en cascada manual dentro de transacción | **Media** | 2h | Configurar `onDelete: Cascade` en schema (ver 1.4) |

---

### 1.4 `onDelete: Cascade` — Faltantes

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **Solo `ProposalPageBlock → ProposalPage`** tiene `onDelete: Cascade` | **Media** | 3h | Agregar cascadas al schema |
| `deleteProposal()` y `deleteUser()` implementan cascada **manual** con 6-10 queries | **Media** | — | Las siguientes relaciones deberían tener `onDelete: Cascade`: |
| | | | `Proposal → User`: **NO** (no borrar propuestas si borras usuario) |
| | | | `ProposalVersion → Proposal`: **SÍ** Cascade |
| | | | `ProposalPage → Proposal`: **SÍ** Cascade |
| | | | `ProposalItem → Proposal`: **SÍ** Cascade |
| | | | `Scenario → Proposal`: **SÍ** Cascade |
| | | | `ScenarioItem → Scenario`: **SÍ** Cascade |
| | | | `ScenarioItem.children → parent`: **SÍ** Cascade |
| | | | `SyncedFile → Proposal`: **SÍ** SetNull |
| | | | `EmailLog → Proposal`: **SÍ** Cascade |

> [!TIP]
> Con cascadas correctas, los métodos `deleteProposal()` y `deleteUser()` se reducen a una sola operación `delete`, eliminando el riesgo de inconsistencia por fallos parciales y reduciendo ~100 líneas de código.

---

### 1.5 Multi-Tenancy Readiness

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| No existe campo `tenantId` / `organizationId` en ningún modelo | **Media** | 8-16h | Crear modelo `Organization` y agregar `organizationId` FK a User, Proposal, Client, BillingProjection, PdfTemplate |
| El filtrado RBAC actual es `userId` (COMMERCIAL) o sin filtro (ADMIN) | **Baja** | — | Funciona para single-tenant; requiere refactoring para multi-tenant |
| `Client.name` es `@unique` globalmente — conflicto si dos tenants tienen el mismo cliente | **Media** | 2h | Cambiar a `@@unique([organizationId, name])` cuando se implemente multi-tenancy |

**Veredicto:** El schema **NO soporta** multi-tenancy. Si se necesita, requiere una migración significativa (~16h).

---

## 2. PERFORMANCE DEL FRONTEND

### 2.1 Code Splitting

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| ✅ **7 rutas usan `React.lazy()` + `Suspense`** con un `PageLoader` spinner | **N/A** | — | Correcto. Bien implementado |
| `Login` **NO está lazy-loaded** (importación directa) | **Baja** | 5m | Mover a `lazy()` — Login tiene 9KB |

### 2.2 React.memo

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **CERO usos de `React.memo`** en todo el frontend | **Media** | 4h | Componentes candidatos: |
| | | | • `ScenarioItemRow.tsx` (renderiza en listas de items) |
| | | | • `BillingCards.tsx` (6 tarjetas con cálculos) |
| | | | • Rows del Dashboard table (re-renders en cada keystroke del search) |
| **CERO usos de `useMemo` o `useCallback`** en componentes de UI (solo en hooks) | **Media** | 3h | `useDashboard` usa `useMemo` correctamente, pero los componentes que renderizan listas (ProposalCalculations, Dashboard) no memorizan callbacks pasados a rows |

### 2.3 Caching de API

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **No existe capa de caching.** Ni React Query, ni SWR, ni cache manual | **Alta** | 8h | Instalar `@tanstack/react-query` para: stale-while-revalidate, dedup de requests, retry automático, optimistic updates |
| Cada navegación al Dashboard re-fetches TODAS las propuestas + escenarios + ítems | **Alta** | — | Con TanStack Query: `staleTime: 30s`, `cacheTime: 5m` |
| `useDashboard` hace `api.get('/proposals')` que carga **toda la data expandida** sin paginación | **Alta** | 6h | Implementar paginación server-side + endpoint ligero para listado |
| Optimistic updates implementados manualmente con `setProposals(prev => prev.map(...))` | **Baja** | — | Funciona pero es frágil; React Query lo hace mejor |

### 2.4 Imágenes

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| `public/logo.png` y `public/novotechflow.png` = **4.5 MB cada uno (duplicados)** | **Alta** | 30m | Convertir a WebP (~100KB), eliminar duplicado |
| `favicon.png` = 28KB (razonable) | **N/A** | — | OK |
| No hay lazy loading en `<img>` tags | **Baja** | 1h | Agregar `loading="lazy"` |
| No hay responsive images (`srcset`/`<picture>`) | **Baja** | 2h | No crítico para app interna |

### 2.5 Bundle Analyzer

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **NO existe** `vite-plugin-visualizer` ni otro bundle analyzer | **Media** | 15m | `pnpm add -D rollup-plugin-visualizer` + agregar a `vite.config.ts` |
| `vite.config.ts` tiene solo `react()` plugin — cero optimizaciones | **Media** | 1h | Agregar: manualChunks para vendor, chunk splitting, compresión |

---

## 3. DEVOPS READINESS

### 3.1 Docker

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **NO existe Dockerfile** para API ni para Frontend | **Alta** | 4h | Crear `apps/api/Dockerfile` (Node multi-stage) y `apps/web/Dockerfile` (build → nginx) |
| `docker-compose.yml` solo tiene el contenedor de **PostgreSQL** (solo DB) | **Alta** | 2h | Agregar servicios `api` y `web` al compose |
| docker-compose.yml usa `version: '3.8'` (deprecado en Compose v2) | **Baja** | 5m | Eliminar la línea `version` |
| Credenciales del DB externalizadas con `${DB_USER:-novotechflow}` ✅ | **N/A** | — | Bien configurado |

### 3.2 Migraciones

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| ✅ **10 migraciones bien nombradas** con timestamps | **N/A** | — | Historial de migraciones limpio |
| No hay script de migración en `package.json` | **Media** | 10m | Agregar `"migrate:deploy": "prisma migrate deploy"` y `"migrate:dev": "prisma migrate dev"` |

### 3.3 Seeds

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| Existen 4 archivos de seed (`seed.ts`, `seed-admin.js`, `seed-catalogs.js`, `seed-csv-catalogs.js`) | **Media** | 2h | Consolidar en un solo `prisma/seed.ts` con steps |
| No hay script `"prisma.seed"` en `package.json` del API | **Media** | 10m | Agregar `"prisma": { "seed": "ts-node prisma/seed.ts" }` |
| `check-db.js`, `check-proposals.js`, `test-api.js` — scripts de debug mezclados con seeds | **Baja** | 30m | Mover a `prisma/scripts/` o eliminar |

### 3.4 CI/CD

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **NO existe `.github/workflows/`** — cero CI/CD | **Alta** | 4h | Crear pipeline básico: lint → tsc → build → test |
| No hay pre-commit hooks (husky, lint-staged) | **Media** | 1h | Agregar `husky` + `lint-staged` para format/lint |

---

## 4. DOCUMENTACIÓN

### 4.1 README.md

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **README.md del root es el template genérico de Turborepo** — no menciona NovoTechFlow, ni la BD, ni las variables de entorno | **Alta** | 2h | Reescribir con: Descripción del proyecto, stack técnico, prerequisites, setup instructions, env vars, scripts disponibles |
| `apps/api/README.md` existe pero no fue evaluado — si también es template, actualizar | **Media** | 1h | Verificar y actualizar |

### 4.2 API Documentation

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **NO existe documentación de API** (Swagger/OpenAPI) | **Alta** | 4h | Instalar `@nestjs/swagger`, decorar controllers con `@ApiOperation`, generar docs en `/api/docs` |
| Los DTOs están bien tipados con `class-validator` — facilitarían generar Swagger automáticamente | **N/A** | — | Los 15+ DTOs ya existentes se mapearían 1:1 |

### 4.3 CONVENTIONS.md

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| `CONVENTIONS.md` es **extenso (261 líneas)** y bien mantenido | **N/A** | — | ✅ Documento de alta calidad |
| Addendum de patrones específicos del proyecto está actualizado | **N/A** | — | Refleja hooks, DTOs, constantes reales |
| **Contradicción:** dice "Organiza por features/dominios" pero el código actual usa `components/`, `hooks/`, `pages/` como carpetas raíz | **Baja** | — | La realidad del proyecto usa un enfoque híbrido; documentar la decisión |
| Regla "Máx 200 líneas por archivo" → `ProposalItemsBuilder.tsx` = 44KB (~1,100+ líneas), `ProposalDocBuilder.tsx` = 31KB, `Dashboard.tsx` = 28KB | **Media** | 8h | Estos archivos ya están en proceso de refactoring (ver conversaciones previas) |

---

## 5. DEUDA TÉCNICA RESIDUAL

### 5.1 Scripts Sueltos en `apps/api/`

**20 scripts encontrados** en la raíz de `apps/api/`:

| Script | Propósito | Acción |
|:---|:---|:---|
| `check_accents.js` | Debug acentos en BD | 🗑️ Eliminar |
| `check_activity.js` | Debug actividad | 🗑️ Eliminar |
| `check_activity_v2.js` | Debug actividad v2 | 🗑️ Eliminar |
| `check_clients.js` | Debug clientes | 🗑️ Eliminar |
| `clean_unused_clients.js` | Limpieza de clientes | 📁 Mover a `scripts/` |
| `debug_trm.js` | Debug TRM | 🗑️ Eliminar |
| `deep_clean_clients.js` | Limpieza profunda | 📁 Mover a `scripts/` |
| `e2e_search_test.js` | Test búsqueda | 🗑️ Eliminar (duplicado) |
| `e2e_search_test_v2.js` | Test búsqueda v2 | 🗑️ Eliminar |
| `fix_clients.js` | Fix datos clientes | 📁 Mover a `scripts/` |
| `fix_email.js` | Fix emails | 🗑️ Eliminar |
| `force_migrate_clients.js` | Migración manual | 🗑️ Eliminar |
| `gen_token.js` | Genera JWT token | 🔐 Mover a `scripts/dev/` |
| `gen_token_nest.js` | Genera JWT (Nest) | 🔐 Mover a `scripts/dev/` |
| `get_client_test.js` | Test clientes | 🗑️ Eliminar |
| `import_clients.js` | Import clientes | 📁 Mover a `scripts/` |
| `import_terceros_sag.js` | Import terceros | 📁 Mover a `scripts/` |
| `list_proposals.js` | Lista propuestas | 🗑️ Eliminar |
| `list_users.js` | Lista usuarios | 🗑️ Eliminar |
| `smart_clean_clients.js` | Limpieza inteligente | 📁 Mover a `scripts/` |
| `test_api.js` | Test API | 🗑️ Eliminar |
| `test_db.js` | Test conexión DB | 🗑️ Eliminar |
| `test_db_counts.js` | Test conteos | 🗑️ Eliminar |
| `test_http_search.js` | Test búsqueda HTTP | 🗑️ Eliminar |
| `test_proposals.js` | Test propuestas | 🗑️ Eliminar |
| `test_scraping.js` | Test scraping | 🗑️ Eliminar |
| `test_search_logic.js` | Test lógica búsqueda | 🗑️ Eliminar |

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **~27 scripts sueltos** en `apps/api/` root | **Media** | 1h | Eliminar ~17, mover ~8 a `scripts/`, agregar a `.gitignore` |

---

### 5.2 Typo `isDilpidate` (debería ser `isDiluted` o `isDilutable`)

**Archivos afectados (excluyendo backups):**

| Capa | Archivo | Ocurrencias |
|:---|:---|:---|
| **Schema** | `schema.prisma` (ScenarioItem.isDilpidate) | 1 |
| **Migration** | `20260324174240_add_is_dilpidate_to_scenario_item` | 1 (nombre) |
| **DTO** | `proposals.dto.ts` (UpdateScenarioItemDto) | 1 |
| **Service** | `scenarios.service.ts` | 3 |
| **Frontend** | `ScenarioItemRow.tsx` | 7 |
| **Frontend** | `ProposalCalculations.tsx` | 2 |
| **Frontend** | `useScenarios.ts` | 4 |
| **Frontend** | `useProposalScenarios.ts` | 5 |
| **Frontend** | `pricing-engine.ts` | 9 |
| **Frontend** | `exportExcel.ts` | 1 |
| **Frontend** | `types.ts` | 1 |
| **Total activos** | **11 archivos** | **~34 ocurrencias** |

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| Typo `isDilpidate` en 11 archivos + 1 tabla + 1 migración | **Media** | 4h | 1. Nueva migración: `ALTER TABLE scenario_items RENAME COLUMN is_dilpidate TO is_diluted;` 2. Actualizar schema.prisma 3. Find-and-replace en 11 archivos 4. **Riesgo:** Requiere deploy coordinado API+Frontend |

---

### 5.3 Dependencias Deprecadas/Desactualizadas

| Dependencia | Versión actual | Estado | Esfuerzo | Recomendación |
|:---|:---|:---|:---|:---|
| `eslint` (API) | `^8.0.0` | ⚠️ ESLint 8 → end-of-life (Oct 2024) | 4h | Migrar a ESLint 9 flat config |
| `eslint` (Web) | `^9.39.1` | ✅ Actualizado | — | OK |
| `turbo` (root) | `^1.12.4` | ⚠️ Turbo 1.x → 2.x ya disponible | 2h | Actualizar a Turbo 2.x |
| `typescript` (root) | `6.0.2` | ✅ Réciente | — | OK |
| `typescript` (API) | `^5.1.3` | ⚠️ Desalineado con root (6.0.2) | 1h | Unificar versión |
| `prisma` / `@prisma/client` | `5.10.2` | ⚠️ Prisma 6.x ya disponible | 3h | Actualizar para performance improvements |
| `pnpm` (packageManager) | `pnpm@9.0.0` | ✅ Actualizado (era 8 antes) | — | OK |
| `source-map-support` | `^0.5.21` | ⚠️ Obsoleta (built-in en Node 20+) | 15m | Eliminar |
| `@types/node` (web) | `^24.10.1` | ⚠️ No existe Node 24 — versión ficticia | 10m | Alinear con Node real (`^20.x`) |

---

### 5.4 Archivos Sueltos en Raíz del Monorepo

| Archivo | Tamaño | Acción |
|:---|:---|:---|
| `Imagen1.png` | 64 KB | 🗑️ Eliminar o mover a `docs/` |
| `Imagen3.png` | 236 KB | 🗑️ Eliminar o mover a `docs/` |
| `Sin Fondo - NT Morado.png` | 28 KB | 📁 Mover a `apps/web/public/` o `assets/` |
| `novotechflow.png` | **4.5 MB** | 📁 Duplicado de `apps/web/public/novotechflow.png` → 🗑️ Eliminar |
| `portada.png` | 504 KB | 📁 Mover a `apps/api/uploads/defaults/` |
| `firmalcmc.jpg` | 19 KB | 📁 Mover a `apps/api/uploads/signatures/` |
| `Logos Novotechno/` | (dir) | 📁 Mover a `assets/brand/` |
| `favicon/` | (dir) | 📁 Ya está en `apps/web/public/` → 🗑️ Eliminar duplicado |
| `add_groups.py` | 1.6 KB | 🗑️ Script de migración legacy — eliminar |
| `clean_terceros.py` | 1 KB | 🗑️ Eliminar |
| `deep_clean_terceros.py` | 1.8 KB | 🗑️ Eliminar |
| `remove_accents.py` | 1.2 KB | 🗑️ Eliminar |
| `almacenamiento.csv` | 4 KB | 🗑️ Eliminar |
| `memorias.csv` | 5 KB | 🗑️ Eliminar |
| `terceros sag.csv` | 144 KB | 🗑️ Datos ya importados — eliminar |
| `terceros.csv` | 317 KB | 🗑️ Datos ya importados — eliminar |
| `NovoTechFlow_Plan_Implementacion.txt` | 33 KB | 📁 Mover a `docs/` |
| `backups/` | (dir) | ⚠️ Backups de código en repo — no pertenecen aquí |

| Hallazgo | Severidad | Esfuerzo | Recomendación |
|:---|:---|:---|:---|
| **18+ archivos sueltos** en la raíz del monorepo (~5.3 MB de basura) | **Media** | 1h | Limpiar: eliminar CSVs, PNGs, scripts Python, mover docs a `docs/` |
| Directorio `backups/` con código completo de fechas anteriores | **Media** | 10m | Eliminar — Git es el historial; agregar a `.gitignore` |

---

## 🏆 TOP 10 — Acciones Priorizadas por Impacto/Esfuerzo

| # | Acción | Impacto | Esfuerzo | Área |
|:---|:---|:---|:---|:---|
| **1** | **Agregar `@@index` a todas las FK** en Prisma schema (15+ índices) | 🔴 Crítico — performance de queries degradará con data | 2h | DB |
| **2** | **Implementar paginación server-side** en `GET /proposals` y `GET /billing-projections` | 🔴 Crítico — actualmente carga todo en memoria | 6h | DB + Frontend |
| **3** | **Instalar `@tanstack/react-query`** para caching, dedup, y stale-while-revalidate | 🔴 Crítico — cada navegación re-fetches everything | 8h | Frontend |
| **4** | **Crear Dockerfiles** para API y Frontend + completar `docker-compose.yml` | 🔴 Crítico — imposible desplegar sin esto | 4h | DevOps |
| **5** | **Crear CI/CD pipeline** (GitHub Actions): lint → tsc → build → test | 🟠 Alto — sin CI, cada push es un riesgo | 4h | DevOps |
| **6** | **Reescribir README.md** con setup real del proyecto | 🟠 Alto — onboarding imposible actualmente | 2h | Docs |
| **7** | **Agregar `onDelete: Cascade`** en relaciones hijo de Proposal y eliminar deletes manuales | 🟡 Medio — reduce ~100 líneas de código y riesgo de inconsistencia | 3h | DB |
| **8** | **Optimizar imágenes `public/`**: convertir PNGs de 4.5MB a WebP, eliminar duplicados | 🟡 Medio — ahorra 9MB de bundling | 30m | Frontend |
| **9** | **Limpiar ~45 archivos sueltos** (scripts de debug, CSVs, PNGs, Python scripts) de api/ y root | 🟡 Medio — reduce ruido, mejora DX | 1.5h | Deuda |
| **10** | **Integrar Swagger/OpenAPI** en NestJS API (`@nestjs/swagger`) | 🟡 Medio — enable API discovery, testing, y documentación automática | 4h | Docs |

---

## Resumen Ejecutivo

| Dimensión | Score | Veredicto |
|:---|:---|:---|
| **Base de Datos** | ⚠️ 4/10 | Cero índices, sin paginación, sin cascadas — funciona pero no escala |
| **Frontend Performance** | ⚠️ 5/10 | Code splitting ✅, pero sin caching, sin memoization, imágenes de 4.5MB |
| **DevOps** | ❌ 2/10 | Sin Dockerfiles, sin CI/CD, compose incompleto |
| **Documentación** | ⚠️ 4/10 | CONVENTIONS.md excelente, pero README y API docs inexistentes |
| **Deuda Técnica** | ⚠️ 4/10 | ~45 archivos de basura, typo sistémico, deps desactualizadas |

> [!WARNING]
> **Veredicto general: NovoTechFlow NO está listo para escalar.** Las 5 primeras acciones del Top 10 son bloqueantes para cualquier despliegue de producción. Esfuerzo estimado total del Top 10: **~35 horas** (~1 semana de un developer senior).
