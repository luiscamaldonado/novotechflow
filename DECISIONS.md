# DECISIONS.md — Decisiones de Arquitectura NovoTechFlow

> Documento requerido por CONVENTIONS.md sección 12.
> Actualizado: Abril 2026

---

## ADR-001: Pricing Engine como fuente única de verdad

**Fecha:** Abril 2026 (Auditoría Fase 3)
**Estado:** Vigente

**Problema:** Las fórmulas de landed cost, dilución, margen y precio unitario estaban duplicadas en 4 archivos (`useScenarios.ts`, `ProposalCalculations.tsx`, `Dashboard.tsx`, `exportExcel.ts`) con variantes inconsistentes. `resolveMargin` tenía 3 implementaciones distintas, una de las cuales producía `NaN`. Dashboard.tsx ignoraba la dilución completamente, produciendo subtotales inflados en las billing cards.

**Decisión:** Crear `apps/web/src/lib/pricing-engine.ts` con 17 funciones puras sin dependencias de React. Todos los consumidores importan de ahí. Ningún archivo del proyecto puede implementar cálculos financieros propios.

**Consecuencias:** Se eliminaron ~235 líneas de código duplicado. El bug de dilución en Dashboard quedó corregido. Cualquier cálculo financiero nuevo va al pricing-engine, no al componente.

---

## ADR-002: Descomposición de archivos monolíticos

**Fecha:** Abril 2026 (Auditoría Fase 3)
**Estado:** Vigente

**Problema:** 4 archivos superaban las 800 líneas, dificultando mantenimiento y aumentando riesgo de conflictos.

**Decisión y resultado:**

| Archivo original | Antes | Después | Extracciones |
|---|---|---|---|
| Dashboard.tsx | 1,038 | 405 | `useDashboard.ts`, `useProjections.ts`, `BillingCards.tsx`, `ProjectionModal.tsx` |
| ProposalDocBuilder.tsx | 1,089 | 527 | `CityCombobox`, `LockedPageView`, `VirtualSectionPreview`, `PageEditor`, `BlockEditor` |
| ProposalCalculations.tsx | 841 | 363 | `ScenarioItemRow`, `ScenarioSidebar`, `ScenarioHeader` |
| proposals.service.ts | 967 | ~370 | `scenarios.service.ts`, `pages.service.ts`, `trm.service.ts` |

**Excepciones aceptadas:**
- `ProposalDocBuilder` quedó en 527 líneas (meta 400) porque el sidebar de páginas tiene ~10 callbacks acoplados al estado padre. Extraerlo fragmentaría sin beneficio.
- `ProposalCalculations` mantuvo la lógica DaaS inline (`savedMarginsRef`, `acquisitionModes`) porque depende de `totals` y `activeScenario` del hook.

---

## ADR-003: Moneda por item y TRM por escenario

**Fecha:** Abril 2026
**Estado:** Vigente

**Problema:** Todos los costos se asumían en COP. En la realidad, los proveedores cotizan en COP o USD y una misma propuesta puede mezclar ambas monedas.

**Decisión:**
- `ProposalItem.costCurrency` (String, default "COP") — moneda del costo del item.
- `Scenario.conversionTrm` (Float, nullable) — TRM de conversión para el escenario.
- Función `convertCost()` en pricing-engine se ejecuta ANTES de `calculateParentLandedCost`. Convierte el costo a la moneda del escenario.
- Campo TRM editable en ScenarioHeader, pre-poblado con la TRM del día.

**Consecuencias:** Las fórmulas del pricing-engine no se modificaron. Solo reciben el costo ya convertido. Excel export, billing cards y PDF siguen funcionando porque consumen valores post-conversión.

---

## ADR-004: TRM histórica desde Datos Abiertos

**Fecha:** Abril 2026
**Estado:** Vigente

**Problema:** Se necesita la TRM diaria para conversiones automáticas y gráficos históricos.

**Decisión:** Consumir la API de Datos Abiertos del gobierno colombiano (`https://www.datos.gov.co/resource/32sa-8pi3.json`).

**Descubrimiento crítico:** La API agrupa fines de semana y festivos en una sola fila. Un lookup por fecha exacta falla para sábados y domingos. Se implementó un algoritmo de day-expansion que distribuye el valor de cada fila a todos los días del rango que cubre.

---

## ADR-005: Encoding UTF-8 obligatorio en Windows/Antigravity

**Fecha:** Abril 2026 (Deploy a Railway)
**Estado:** Vigente

**Problema:** Antigravity IDE en Windows guarda archivos como UTF-16 LE (BOM `FF FE`). Docker y `ts-node` en producción no lo interpretan — los caracteres no-ASCII (tildes, ñ, µ) aparecen como `??`.

**Caso real:** `prisma/seed.ts` se guardó como UTF-16 LE. `ts-node` lo rechazó con error `TS1490: File appears to be binary`. Fix: re-guardar como UTF-8 sin BOM.

**Comando de diagnóstico:**
```powershell
Get-Content <RUTA> -Encoding Byte | Select-Object -First 4
# 255 254 = UTF-16 LE (ROTO)
# 239 187 191 = UTF-8 con BOM (OK)
# Bytes ASCII normales = UTF-8 sin BOM (correcto)
```

**Comando de corrección:**
```powershell
$content = Get-Content <RUTA> -Raw
[System.IO.File]::WriteAllText("$PWD\<RUTA>", $content, [System.Text.UTF8Encoding]::new($false))
```

**Regla:** Todo archivo nuevo debe verificarse con los primeros 4 bytes antes de commitear si contiene caracteres no-ASCII.

---

## ADR-006: Seguridad post-auditoría (24 vulnerabilidades)

**Fecha:** Abril 2026 (Auditoría Fase 2)
**Estado:** Vigente — no desactivar ninguna medida

**Decisiones:**
- IDOR ownership checks en 26+ endpoints (cada query filtra por `userId` del JWT).
- `forbidNonWhitelisted: true` en ValidationPipe global — el backend rechaza campos no declarados en el DTO.
- Rate limiting: 30/min global, 5/min en login.
- Upload: validación por magic bytes (no solo extensión), sanitización del nombre del archivo.
- XSS: `sanitize-html` en campos de texto. Requiere `require()` en NestJS (CommonJS), no `import`.
- Helmet con CSP, HSTS, X-Frame-Options.
- JWT sin fallback — la app crashea si no hay `JWT_SECRET` (intencional).

---

## ADR-007: Items diferidos con justificación explícita

**Fecha:** Abril 2026
**Estado:** Vigente

| Item diferido | Razón | Trigger para implementar |
|---|---|---|
| Paginación server-side | No necesaria con <200 propuestas | Dashboard lento o >200 propuestas |
| React Query | Alto riesgo de regresiones sin tests | Tests en hooks implementados primero |
| ~~isDilpidate → isDiluted~~ | ~~Cosmético, centralizado en pricing-engine~~ | ~~Deploy window tranquilo~~ → **CERRADO** |

**Principio:** Los items diferidos deben tener razón documentada para evitar revisarlos prematuramente.

---

## ADR-008: SpecOption como modelo genérico de admin

**Fecha:** Abril 2026
**Estado:** Vigente

**Problema:** Los campos de especificaciones técnicas de items (RAM, almacenamiento, procesador, etc.) necesitan valores predefinidos para autocompletado, pero crear una tabla por cada campo no escala.

**Decisión:** Modelo `SpecOption` con dos campos: `fieldName` (nombre del campo) + `value` (valor predefinido). Un solo CRUD con filtro por `fieldName` sirve para todos los campos de especificaciones.

**Patrón frontend:** `AutocompleteInput` → `SpecFieldsSection`. Los componentes de formulario consumen SpecOptions filtrados por su `fieldName`.

---

## ADR-009: Deploy en Railway (3 servicios)

**Fecha:** Abril 2026
**Estado:** Vigente

**Arquitectura de producción:**
- **API:** `novotechflow-production.up.railway.app` — NestJS, Dockerfile multi-stage (builder + runner Alpine).
- **Frontend:** `web-production-55504.up.railway.app` — React+Vite, build estático servido por Nginx.
- **PostgreSQL:** red privada Railway, no expuesto a internet.

**Decisiones:**
- CORS restringido al dominio del frontend (`CORS_ORIGIN` en variables de Railway).
- La `DATABASE_URL` de la API usa la URL interna (`.railway.internal`).
- El seed NO se ejecuta en el CMD del Dockerfile. Se corre desde la máquina local apuntando a la DB pública de Railway.
- `pnpm` se fija en versión `8.15.5` en el Dockerfile para reproducibilidad.

---

## ADR-010: PowerShell como shell de desarrollo

**Fecha:** Abril 2026
**Estado:** Vigente

**Convenciones específicas de Windows/PowerShell:**
- Usar `;` para encadenar comandos, no `&&`.
- Usar `pnpm exec tsc` en vez de `npx tsc` para evitar instalar `tsc@2.0.4` (paquete incorrecto).
- `findstr` no soporta pipes `|` como separador de alternativas. Usar `Select-String` de PowerShell o buscar uno por uno.
- Errores `EPERM` en migraciones de Prisma son un artifact de DLL lock en Windows. No indican fallo real.
