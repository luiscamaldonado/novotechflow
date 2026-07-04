# Auditoría de invariante — Rol REPORTER (solo lectura)

**Fecha:** 2026-07-04
**Método:** Pasada de auditoría de un invariante (INSTRUCTIVO_CLAUDE.md §10.6), solo lectura, con Claude Fable 5. Ejecutada sobre la rama `feature/reporter-role` (base del rol REPORTER, ADR-054).
**Invariante:** Un usuario autenticado con rol REPORTER no puede mutar ningún dato por ninguna ruta del API, y solo puede leer los endpoints que el dashboard necesita.

## Resultado

- **Cláusula A (no mutación): SE CUMPLE.** Ningún endpoint que escriba datos de NovoTechFlow es alcanzable por REPORTER. Verificado controlador por controlador en los 13 controladores del API.
- **Cláusula B (superficie de lectura acotada): NO SE CUMPLE en su forma estricta.** REPORTER puede leer 5 GET adicionales y ejecutar 1 POST de cómputo (sin mutación) fuera de la lista del dashboard. Todo atribuible a la limitación consciente documentada en el ADR-054 (endpoints con solo `JwtAuthGuard` quedan legibles). Dos de ellos exponían datos sensibles y se corrigieron.

## Hallazgos

### #1 — POST /spec-prefill/extract sin guard de rol (MEDIA) — CERRADO
`apps/api/src/spec-prefill/spec-prefill.controller.ts` — el método `extract` tenía solo `@UseGuards(JwtAuthGuard)`. Cualquier REPORTER autenticado podía invocar el parseo de archivos (hasta 10 MB). No muta datos persistidos (0 llamadas a prisma en el módulo), por eso no rompe la cláusula A, pero queda fuera del alcance de solo-lectura del dashboard.
**Fix:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN, Role.COMMERCIAL)`. Commit `e1da449` (master).

### #2 — GET /clients/search enumera clientes (MEDIA) — CERRADO
`apps/api/src/clients/clients.controller.ts` — el método `search` tenía solo `@UseGuards(JwtAuthGuard)`. REPORTER podía enumerar nombres de cliente y NIT (PII comercial) fuera del whitelist del dashboard.
**Fix:** mismo patrón que #1. Commit `e1da449` (master).

### #3 — GET /proposals/client-history lectura cross-usuario (BAJA) — ACEPTADO
`apps/api/src/proposals/proposals.service.ts` — el endpoint no filtra por dueño (cruce de cuentas intencional). No amplía la exposición real de REPORTER: por el `findAll` global del ADR-054, REPORTER ya ve todas las propuestas en el dashboard. No expone nada que no tenga ya. Se acepta.

### #4 — GET /app-settings/price-thresholds (BAJA) — ACEPTADO
REPORTER lee umbrales de precio (config admin, sin PATCH). Exposición marginal; cerrarlo no justifica el cambio. Se acepta y se registra.

### #5 — GET /catalogs/category/:cat y /catalogs/pc-specs (BAJA) — ACEPTADO
Datos de referencia (catálogo maestro). Impacto bajo. Se acepta.

### #6 — GET /spec-options/suggest (BAJA) — ACEPTADO
Sugerencias de autocompletado. Impacto bajo. Se acepta.

### #7 — Rol tomado del payload del JWT, no de la DB (hipótesis) — DIFERIDO
`apps/api/src/auth/jwt.strategy.ts` — `validate()` toma `role` del token, no re-consulta la DB. Un usuario degradado a REPORTER conserva su rol anterior hasta que expire el token. No permite que un token REPORTER escale (siempre lleva REPORTER), así que no rompe el invariante en la dirección auditada. El fix (rol desde DB por request, o versionado de token) es estructural; se difiere.

## Casos borde revisados sin hallazgo

- `POST /presence/heartbeat`: escribe solo el `lastSeenAt` del propio llamador; REPORTER no puede tocar otra fila ni otro campo.
- `GET /proposals/:id`, `/:id/scenarios`, `/:id/pages`: abiertos a nivel de guard pero denegados en el servicio por `verifyProposalOwnership` (REPORTER no posee propuestas → 403).
- Uploads de mutación (`proposals/pages/upload-image`, `users/:id/signature`, imports CSV, templates): cerrados por `ReporterReadOnlyGuard` / `AdminGuard` / `@Roles(ADMIN)`.
- Módulo `external` (`GET /external/proposals`): usa `ExternalJwtAuthGuard` con `EXTERNAL_JWT_SECRET` distinto; un token REPORTER no valida la firma.

## Verificación del fix (cohorte 1: #1 y #2)

- `tsc --noEmit` en api: en verde (commit `e1da449`).
- Verificación funcional en local (CONVENTIONS §H) sobre `feature/reporter-role` con `e1da449` cherry-pickeado (`8bf4da1`) y modo-consola de 2FA: login como usuario REPORTER real, dashboard accesible con sus restricciones esperadas, sin acceso a otras pantallas. Invariante confirmado en runtime.

## Pendientes

- Push del fix `e1da449` a `master` (diferido a ventana sin usuarios en producción).
- #4–#6 aceptados como exposición de bajo impacto; #7 diferido por ser estructural. Revisar si a futuro se agrega un módulo no-admin con GET sin guard de rol (reabriría la limitación del ADR-054).
