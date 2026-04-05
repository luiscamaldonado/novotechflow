# 🏗️ Auditoría Arquitectónica — NovotechFlow

> **Auditor:** Arquitecto de Software Senior  
> **Fecha:** 5 de abril de 2026  
> **Scope:** Monorepo completo `novotechflow` (apps/web, apps/api, apps/agent, packages/*)

---

## Resumen Ejecutivo

NovotechFlow es un monorepo pnpm + Turborepo con 3 aplicaciones (web Vite/React, api NestJS, agent Tauri) y 3 paquetes compartidos. El proyecto tiene **convenciones bien documentadas** (`CONVENTIONS.md`) pero una **brecha significativa entre lo documentado y lo implementado**. Los hallazgos más críticos son: archivos de página monolíticos (>1000 líneas), estructura por tipo de archivo en lugar de features, y acumulación de scripts ad-hoc en la raíz del API.

**Métricas clave:**
- Dashboard.tsx: **1,038 líneas** (límite CONVENTIONS: 200)
- ProposalCalculations.tsx: **841 líneas**
- ProposalDocBuilder.tsx: **1,089 líneas**
- ProposalItemsBuilder.tsx: **569 líneas**
- proposals.service.ts (backend): **967 líneas**
- ~20 scripts .js sueltos en la raíz de `apps/api`
- ~6 archivos CSV/PNG/Python sueltos en la raíz del monorepo

---

## Tabla de Hallazgos

| # | Hallazgo | Severidad | Archivo / Ubicación | Recomendación |
|---|----------|-----------|---------------------|---------------|
| **1. ESTRUCTURA DE CARPETAS** | | | | |
| 1.1 | **Organización por tipo de archivo, no por feature.** El frontend usa `components/`, `hooks/`, `pages/`, `lib/`, `store/` como carpetas raíz. Esto viola directamente CONVENTIONS.md §1: "Organiza por features/dominios, NO por tipo de archivo." | **Crítica** | [apps/web/src/](file:///d:/novotechflow/apps/web/src) | Migrar a estructura feature-based: `features/proposals/`, `features/auth/`, `features/dashboard/`, `features/admin/`. Cada feature agrupa sus componentes, hooks, constantes y tipos. |
| 1.2 | **Scripts ad-hoc en la raíz del API.** ~20 archivos `.js` sueltos (debug, tests manuales, migraciones, seeds) sin organización. | **Alta** | [apps/api/*.js](file:///d:/novotechflow/apps/api) (check_accents.js, debug_trm.js, fix_clients.js, etc.) | Mover a carpetas organizadas: `scripts/debug/`, `scripts/migrations/`, `scripts/seeds/`. Agregar a `.gitignore` los que sean temporales. |
| 1.3 | **Archivos multimedia y datos sueltos en la raíz del monorepo.** Imágenes PNG, archivos CSV, scripts Python que no pertenecen al código fuente. | **Alta** | Raíz: `Imagen1.png`, `Imagen3.png`, `novotechflow.png`, `portada.png`, `firmalcmc.jpg`, `terceros.csv`, `almacenamiento.csv`, `memorias.csv`, `add_groups.py`, `clean_terceros.py`, `deep_clean_terceros.py`, `remove_accents.py` | Mover imágenes a `apps/web/public/` o al directorio de uploads. Mover CSVs y scripts Python a `scripts/data-import/`. Eliminar los que ya no se usen. |
| 1.4 | **Carpeta `Logos Novotechno` con espacios en el nombre.** No sigue ninguna convención de naming. | **Media** | [Logos Novotechno/](file:///d:/novotechflow/Logos%20Novotechno) | Renombrar a `assets/logos-novotechno/` o mover a `apps/web/public/logos/`. |
| 1.5 | **Carpeta `backups/` en el repositorio.** Los backups no deberían vivir en el código fuente. | **Media** | [backups/](file:///d:/novotechflow/backups) | Mover fuera del repo o agregar a `.gitignore`. Usar un sistema de backup externo. |
| 1.6 | **App `agent` (Tauri) parece abandonada.** Solo tiene archivos boilerplate mínimos: un `App.tsx` genérico con contador y el scaffold de Tauri. | **Media** | [apps/agent/](file:///d:/novotechflow/apps/agent) | Documentar su propósito o eliminar si no está en uso activo. Ocupa espacio y confunde. |
| 1.7 | **Paquete `packages/ui` infrautilizado.** Solo contiene 3 componentes genéricos mínimos (button, card, code) que no se usan en la web app. | **Baja** | [packages/ui/src/](file:///d:/novotechflow/packages/ui/src) | Evaluar si vale la pena mantener el paquete. Si el design system real está en el web app, consolidar ahí. |
| | | | | |
| **2. ARCHIVOS MONOLÍTICOS (SRP)** | | | | |
| 2.1 | **Dashboard.tsx: 1,038 líneas.** Contiene lógica de negocio compleja (cálculos financieros trimestrales, subtotales por propuesta), operaciones CRUD, estado de filtros, modal de proyecciones y toda la UI del dashboard. Viola SRP masivamente. | **Crítica** | [Dashboard.tsx](file:///d:/novotechflow/apps/web/src/pages/Dashboard.tsx) | Descomponer en: `useDashboardData` hook (carga + cálculos), `useBillingCards` hook (métricas financieras), `ProposalRow` componente, `ProjectionRow` componente, `ProjectionModal` componente, `BillingCardsGrid` componente. La función `computeMinSubtotal` (70 líneas de lógica de negocio) debe ir a `lib/calculations.ts`. |
| 2.2 | **ProposalDocBuilder.tsx: 1,089 líneas.** Contiene el componente principal + 4 sub-componentes en el mismo archivo (`CityCombobox`, `LockedPageView`, `VirtualSectionPreview`, `PageEditor`). | **Crítica** | [ProposalDocBuilder.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalDocBuilder.tsx) | Cada sub-componente (`CityCombobox`, `LockedPageView`, `VirtualSectionPreview`, `PageEditor`) debe ser un archivo separado en `components/proposals/`. |
| 2.3 | **ProposalCalculations.tsx: 841 líneas.** La función render de la tabla tiene cálculos en-línea de dilución, costos, márgenes repetidos desde `useScenarios`. | **Crítica** | [ProposalCalculations.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalCalculations.tsx) | Extraer `ScenarioItemRow` como componente. Mover el tipo `AcquisitionMode` y `ACQUISITION_OPTIONS` a constantes. Extraer la lógica de `handleAcquisitionChange` al hook. |
| 2.4 | **proposals.service.ts (API): 967 líneas.** Un solo servicio maneja propuestas, ítems, escenarios, páginas, bloques, TRM scraping, y clonación. Viola SRP del lado servidor. | **Crítica** | [proposals.service.ts](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts) | Dividir en servicios independientes: `ScenariosService`, `PagesService`, `TrmService`. Cada uno con su propio módulo NestJS. |
| 2.5 | **ProposalItemsBuilder.tsx: 569 líneas.** ~250 líneas son badges de specs técnicos repetitivos por tipo de item (PCS, ACCESSORIES, PC_SERVICES, etc.) que son copy-paste con variación de colores. | **Alta** | [ProposalItemsBuilder.tsx:479-523](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalItemsBuilder.tsx#L479-L523) | Crear un componente `TechSpecBadges` data-driven que renderice dinámicamente los badges según el `itemType` y un mapa de configuración (similar al patrón ya usado en `SPEC_FIELDS_BY_ITEM_TYPE`). |
| | | | | |
| **3. SEPARACIÓN DE CONCERNS** | | | | |
| 3.1 | **Lógica de cálculos financieros duplicada en UI y hook.** `ProposalCalculations.tsx` recalcula costos/dilución/márgenes inline dentro del JSX (líneas 512-559), cuando esa misma lógica ya existe en `useScenarios.calculateTotals`. | **Alta** | [ProposalCalculations.tsx:512-559](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalCalculations.tsx#L512-L559) | El hook debe exponer un método `getItemDisplayValues(si)` que retorne `unitPrice`, `effectiveLandedCost`, `dilutionAmount` pre-calculados. La UI solo renderiza, no calcula. |
| 3.2 | **Dashboard.tsx realiza cálculos financieros complejos.** La función `computeMinSubtotal` (26-69) y `billingCards` useMemo (233-349) son ~180 líneas combinadas de lógica de negocio pura dentro de un componente de página. | **Alta** | [Dashboard.tsx:26-69](file:///d:/novotechflow/apps/web/src/pages/Dashboard.tsx#L26-L69), [Dashboard.tsx:233-349](file:///d:/novotechflow/apps/web/src/pages/Dashboard.tsx#L233-L349) | Extraer toda la lógica de cálculos a `lib/billing-calculations.ts`. Crear `useDashboard` hook para orquestar datos + cálculos. |
| 3.3 | **Dashboard.tsx hace llamadas API directas.** Múltiples `api.get/patch/post/delete` dispersos en el componente (líneas 136-491). No usa un hook dedicado. | **Alta** | [Dashboard.tsx](file:///d:/novotechflow/apps/web/src/pages/Dashboard.tsx) | Crear `useDashboard` hook que encapsule todas las operaciones de datos (loadData, handleStatusChange, handleClone, handleDelete, etc.). |
| 3.4 | **Users.tsx hace llamadas API directas** sin hook intermediario. | **Media** | [Users.tsx](file:///d:/novotechflow/apps/web/src/pages/Users.tsx) | Crear `useUsers` hook. |
| 3.5 | **ProposalDocBuilder.tsx hace llamada API directa** para cargar el proposal metadata (línea 86-91). | **Media** | [ProposalDocBuilder.tsx:86-91](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalDocBuilder.tsx#L86-L91) | Mover al hook `useProposalPages` o crear un hook dedicado `useProposalMetadata`. |
| 3.6 | **Endpoint `getExtraTrm` sin autenticación.** Es el único endpoint del controlador de propuestas que no lleva `@UseGuards(JwtAuthGuard)`. Realiza scraping de sitios externos. | **Alta** | [proposals.controller.ts:38-41](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L38-L41) | Agregar `@UseGuards(JwtAuthGuard)`. Considerar cachear los resultados de TRM para evitar scraping en cada request. |
| | | | | |
| **4. TIPADO** | | | | |
| 4.1 | **Uso de `any` en hook principal.** `useScenarios.ts:55` → `const [proposal, setProposal] = useState<any>(null)` con `// eslint-disable-next-line`. CONVENTIONS prohíbe explícitamente `any`. | **Alta** | [useScenarios.ts:54-55](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts#L54-L55) | Tipar como `useState<ProposalDetail \| null>(null)` usando el tipo ya existente en `lib/types.ts`. |
| 4.2 | **Tipos duplicados entre archivos.** `Scenario`, `ScenarioItem`, `ScenarioTotals` están definidos TANTO en `lib/types.ts` como en `hooks/useScenarios.ts` con definiciones ligeramente diferentes (e.g., `isDilpidate` solo en la versión del hook). | **Alta** | [lib/types.ts:145-170](file:///d:/novotechflow/apps/web/src/lib/types.ts#L145-L170) vs [useScenarios.ts:4-48](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts#L4-L48) | Consolidar en `lib/types.ts` como fuente única de verdad. El hook debe importar los tipos. |
| 4.3 | **Tipo `AcquisitionMode` definido inline** dentro de `ProposalCalculations.tsx` (línea 46) como un tipo local del componente. Debería estar en tipos compartidos. | **Media** | [ProposalCalculations.tsx:46](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalCalculations.tsx#L46) | Mover a `lib/types.ts` junto con `ACQUISITION_OPTIONS` en `lib/constants.ts`. |
| 4.4 | **Backend usa `any` en retornos.** `findPotentialConflicts` retorna `Promise<any[]>`. `initializeDefaultPages` usa `(t.content as any[])`. | **Media** | [proposals.service.ts:38](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L38), [proposals.service.ts:782](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L782) | Crear interfaces tipadas para los retornos. |
| | | | | |
| **5. NAMING CONVENTIONS** | | | | |
| 5.1 | **Typo persistente: `isDilpidate`** en todo el codebase (debería ser `isDiluted` o `isDilutable`). Aparece en hooks, componentes frontend, y Prisma schema. | **Alta** | Global: `useScenarios.ts`, `ProposalCalculations.tsx`, `proposals.service.ts`, `schema.prisma` | Corregir mediante migración de Prisma + renombrar en todo el codebase. Priorizar consistencia lingüística. |
| 5.2 | **Mezcla de idiomas.** Archivos en inglés, comentarios en español, variables en inglés, labels en español. Funciones como `handleDateChange` conviven con `handleUpdateProposal`. | **Media** | Global | Definir política explícita: código en inglés, UI/labels en español. Documentar en CONVENTIONS.md. |
| 5.3 | **Función `handleDateChange` maneja más que fechas.** En `ProposalItemsBuilder.tsx:41` esta función también procesa el campo `subject` (textarea). El nombre no refleja su responsabilidad real. | **Baja** | [ProposalItemsBuilder.tsx:41](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalItemsBuilder.tsx#L41) | Renombrar a `handleProposalFieldChange` o similar. |
| 5.4 | **Constantes `PAGE_TYPE_LABELS` y `PAGE_TYPE_STYLES` definidas inline** en el componente, no en `lib/constants.ts`. | **Baja** | [ProposalDocBuilder.tsx:23-44](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalDocBuilder.tsx#L23-L44) | Mover a `lib/constants.ts` para reutilización. |
| | | | | |
| **6. CÓDIGO MUERTO / REDUNDANTE** | | | | |
| 6.1 | **~20 scripts de debug/migración en raíz del API** que probablemente ya cumplieron su propósito y no se usan activamente. | **Alta** | `apps/api/check_accents.js`, `check_activity.js`, `check_activity_v2.js`, `check_clients.js`, `clean_unused_clients.js`, `debug_trm.js`, `deep_clean_clients.js`, `e2e_search_test.js`, `e2e_search_test_v2.js`, `fix_clients.js`, `fix_email.js`, `force_migrate_clients.js`, `gen_token.js`, `gen_token_nest.js`, `get_client_test.js`, `import_clients.js`, `import_terceros_sag.js`, `list_proposals.js`, `list_users.js`, `smart_clean_clients.js`, `test_api.js`, `test_db.js`, `test_db_counts.js`, `test_http_search.js`, `test_proposals.js`, `test_scraping.js`, `test_search_logic.js` | Auditar cada uno. Eliminar los obsoletos. Los útiles mover a `scripts/` con documentación. |
| 6.2 | **Scripts Prisma de migración manual** en `apps/api/prisma/`. `check-db.js`, `check-proposals.js`, `test-api.js` son scripts ad-hoc que probablemente ya no se usan. | **Media** | [apps/api/prisma/*.js](file:///d:/novotechflow/apps/api/prisma) | Limpiar los que no sean `seed.ts`. |
| 6.3 | **Scripts Python en la raíz del monorepo.** `add_groups.py`, `clean_terceros.py`, `deep_clean_terceros.py`, `remove_accents.py` — scripts de limpieza de datos one-off. | **Media** | Raíz del monorepo | Mover a `scripts/python/` o eliminar si ya no se necesitan. |
| 6.4 | **Archivos CSV en la raíz del monorepo.** `almacenamiento.csv`, `memorias.csv`, `terceros.csv`, `terceros sag.csv` son datos de importación. | **Media** | Raíz del monorepo | Mover a `data/imports/` o eliminar si ya fueron importados. |
| 6.5 | **Componente `AdminPanel` definido inline en `App.tsx`** como placeholder estático ("Módulo de Administración en Construcción"). | **Baja** | [App.tsx:19-29](file:///d:/novotechflow/apps/web/src/App.tsx#L19-L29) | Mover a su propio archivo o eliminar si nunca se implementará. |
| 6.6 | **`NovoTechFlow_Plan_Implementacion.txt`** en la raíz — documento de planificación que no es código fuente. | **Baja** | Raíz del monorepo | Mover a `docs/` o a un wiki externo. |
| 6.7 | **`security_audit.md`** en la raíz del monorepo — el resultado de una auditoría anterior. | **Baja** | Raíz del monorepo | Mover a `docs/audits/`. |
| 6.8 | **Archivo `dist/`** incluido en `apps/api/` y `apps/agent/` — los builds no deberían estar en el repo. | **Media** | `apps/api/dist/`, `apps/agent/dist/` | Verificar que estén en `.gitignore`. Si no, agregarlos. |
| | | | | |
| **7. PATRONES DE DISEÑO** | | | | |
| 7.1 | **Cálculos de negocio repetidos en 3 lugares.** La fórmula landed cost + dilución + margen → precio aparece en: `useScenarios.calculateTotals`, inline en `ProposalCalculations.tsx`, y en `Dashboard.computeMinSubtotal`. | **Crítica** | Tres archivos distintos | Crear un módulo `lib/pricing-engine.ts` con funciones puras: `calculateLandedCost()`, `calculateDilution()`, `calculateUnitPrice()`, `calculateScenarioTotals()`. Todos los consumidores importan de ahí. |
| 7.2 | **No hay error boundaries granulares.** Solo existe un `ErrorBoundary` global en `App.tsx`. Si la ventana de cálculos falla, toda la app se rompe. | **Media** | [App.tsx:55](file:///d:/novotechflow/apps/web/src/App.tsx#L55) | Envolver cada página/feature en su propio `ErrorBoundary`. |
| 7.3 | **Patrón de "prop drilling" de `api` controlado.** Las páginas que usan hooks (`useScenarios`, `useProposalBuilder`, `useProposalPages`) no hacen prop drilling excesivo. ✅ Bien implementado. | **N/A** | Global | Mantener este patrón. |
| 7.4 | **Backend: controlador monolítico.** `proposals.controller.ts` tiene **246 líneas** con ~25 endpoints que cubren propuestas, ítems, escenarios, páginas, bloques e imágenes. | **Alta** | [proposals.controller.ts](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts) | Dividir en controladores especializados: `ScenariosController`, `PagesController`, `BlocksController`. |
| 7.5 | **Módulos NestJS sin DTOs.** Los módulos `clients/`, `catalogs/`, y `billing-projections/` no tienen carpeta de DTOs. | **Media** | `apps/api/src/clients/`, `catalogs/`, `billing-projections/` | Crear DTOs con `class-validator` como establece CONVENTIONS.md §D. |
| 7.6 | **Eliminación en cascada manual.** `deleteProposal` en el servicio hace 6 deletes manuales secuenciales en vez de usar transacciones Prisma o cascading relations. | **Alta** | [proposals.service.ts:429-459](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L429-L459) | Envolver en `prisma.$transaction()` para garantizar atomicidad. Evaluar `onDelete: Cascade` en el schema de Prisma. |
| | | | | |
| **8. SEGURIDAD** | | | | |
| 8.1 | **Token JWT almacenado en `localStorage`** sin protección contra XSS. | **Alta** | [authStore.ts:21](file:///d:/novotechflow/apps/web/src/store/authStore.ts#L21), [api.ts:13](file:///d:/novotechflow/apps/web/src/lib/api.ts#L13) | Migrar a cookies httpOnly para almacenar el token. Implementar refresh token rotation. |
| 8.2 | **`checkAuth` no valida expiración del token.** Solo verifica que exista en localStorage, nunca decodifica el JWT para verificar si está expirado. | **Alta** | [authStore.ts:32-45](file:///d:/novotechflow/apps/web/src/store/authStore.ts#L32-L45) | Decodificar el JWT y verificar `exp` claim. Implementar lógica de refresh. |
| 8.3 | **No hay interceptor de errores 401.** Si el token expira, la app no hace logout automático ni redirige al login. | **Alta** | [api.ts](file:///d:/novotechflow/apps/web/src/lib/api.ts) | Agregar un `response interceptor` que capture 401 y ejecute `logout()`. |
| 8.4 | **Archivo `.env` commiteado** en `apps/api/`. | **Alta** | [apps/api/.env](file:///d:/novotechflow/apps/api/.env) | Agregar a `.gitignore`. Usar `.env.example` como plantilla documentada. |

---

## Resumen de Severidades

| Severidad | Cantidad |
|-----------|---------|
| 🔴 Crítica | 6 |
| 🟠 Alta | 16 |
| 🟡 Media | 12 |
| 🟢 Baja | 5 |
| **Total** | **39** |

---

## Top 5 Acciones Prioritarias

1. **Crear `lib/pricing-engine.ts`** — Centralizar TODA la lógica de cálculo financiero (landed cost, dilución, margen, subtotales) en funciones puras testables. Elimina la duplicación más peligrosa del proyecto.

2. **Descomponer los 4 archivos monolíticos** — `Dashboard.tsx`, `ProposalDocBuilder.tsx`, `ProposalCalculations.tsx`, y `proposals.service.ts`. Crear hooks dedicados + componentes atómicos + servicios especializados.

3. **Migrar a estructura feature-based** — Reorganizar `apps/web/src/` de type-based a feature-based (`features/proposals/`, `features/dashboard/`, `features/auth/`, `features/admin/`).

4. **Limpiar la raíz del monorepo y del API** — Mover/eliminar ~30 archivos sueltos (scripts, CSVs, imágenes, Python) que no son código fuente. Aplicar `.gitignore` donde corresponda.

5. **Hardening de seguridad** — Migrar token a httpOnly cookies, agregar interceptor 401, validar expiración del JWT, proteger el endpoint TRM, y sacar `.env` del repo.
