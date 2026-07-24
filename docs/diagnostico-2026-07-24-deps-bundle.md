# Diagnóstico 2026-07-24 — Dependencias del API y composición del bundle web

**Rama:** `chore/audit-deps-y-bundle` (creada desde `master` @ `410db2f`)
**Alcance:** solo diagnóstico. No se modificó `package.json`, `Dockerfile` ni código de aplicación. No se ejecutó `npm audit fix`.
**Entorno de medición:** Windows 11, PowerShell. `node v22.22.2`, `npm 10.9.7`, `pnpm 10.33.4`.

Este documento contiene únicamente datos medidos. No incluye recomendaciones de fix.

---

## Nota metodológica previa (afecta a todo el Bloque A)

El comando pedido, `npm audit --json` dentro de `apps/api`, **no puede ejecutarse**. El monorepo es pnpm y no existe ningún `package-lock.json` en el repositorio:

```
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only
```

Verificado: `Glob **/package-lock.json` → 0 resultados. `apps/api/node_modules` es un árbol de enlaces de pnpm.

Para no perder ninguna de las dos lecturas, se midió por dos vías **y los resultados no coinciden**:

| Vía | Qué representa | Comando | Salida |
|---|---|---|---|
| **(1) npm sintético** | Resolución *fresca* contra el registro hoy, a partir de `apps/api/package.json` copiado a un directorio temporal | `npm install --package-lock-only` + `npm audit` | **4 vulnerabilidades (2 moderate, 2 high)** |
| **(2) pnpm real** | El árbol que **realmente se despacha**, porque el `Dockerfile` instala con `pnpm install --frozen-lockfile` sobre `pnpm-lock.yaml` | `pnpm audit --json` dentro de `apps/api` | **66 findings** en el árbol completo, **53** en el subárbol de producción (solo rutas `apps__api>`) |

Las "4 vulnerabilidades" del enunciado corresponden a la vía (1). **No describen el contenido de la imagen.** La divergencia es real y su causa está identificada: `pnpm-lock.yaml` fija versiones transitivas más antiguas que las que npm resuelve hoy desde cero. Ejemplos concretos medidos:

- `@nestjs/swagger`: npm resuelve **11.4.6** (que arrastra `js-yaml@5.2.1`); el lockfile de pnpm tiene **11.4.4** (que arrastra `js-yaml@4.1.1`). Son advisories **distintos**.
- `resend`: npm resuelve **6.18.0** (sin `svix`); el lockfile de pnpm tiene **6.11.0** → `svix@1.90.0` → `uuid@10.0.0`. Esa segunda ruta de `uuid` es invisible para `npm audit`.

Advertencia adicional: `pnpm audit` audita **todo el workspace**, no el paquete del directorio actual. Todas las cifras de pnpm en este documento están filtradas por prefijo de ruta `apps__api>` salvo donde se indique lo contrario.

Ficheros crudos generados (fuera del repo, en el scratchpad de la sesión): `audit-main.json`, `audit-prod.json`, `audit-runner.json`, `npm-audit-api-main.json`, `npm-audit-api-prod.json`, `stats.html`.

---

## BLOQUE A — Auditoría de dependencias del API

### A.1 — Las 4 vulnerabilidades de `npm audit` (vía sintética)

`npm audit` y `npm audit --omit=dev` devuelven **exactamente el mismo conjunto**: los 4 hallazgos están en el grafo de producción (`dev=false` en el lockfile para los cuatro).

| # | Paquete | Versión resuelta (npm) | GHSA / CVE | Sev. | CVSS | Cadena completa | ¿En `--omit=dev`? | Fix disponible | ¿Breaking? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `js-yaml` | 5.2.1 | GHSA-pm4m-ph32-ghv5 | high | 7.5 | `api > @nestjs/swagger@11.4.6 > js-yaml@5.2.1` | Sí | `fixAvailable: true` | **No** |
| 2 | `@nestjs/swagger` | 11.4.6 (directa) | — (transitiva vía `js-yaml`) | high | — | `api > @nestjs/swagger` | Sí | `fixAvailable: true` | **No** |
| 3 | `uuid` | 8.3.2 | GHSA-w5hq-g745-h8pq / CVE-2026-41907 | moderate | 7.5 | `api > exceljs@4.4.0 > uuid@^8.3.0 → 8.3.2` | Sí | `exceljs@3.4.0` | **Sí** (`isSemVerMajor: true`) |
| 4 | `exceljs` | 4.4.0 (directa) | — (transitiva vía `uuid`) | moderate | — | `api > exceljs` | Sí | `exceljs@3.4.0` | **Sí** (`isSemVerMajor: true`) |

Detalle de los advisories raíz:

- **GHSA-pm4m-ph32-ghv5** — `js-yaml`: *Exponential parsing time in flow collections leads to denial of service*. CWE-407. Rango vulnerable `>=5.0.0 <=5.2.1`.
- **GHSA-w5hq-g745-h8pq / CVE-2026-41907** — `uuid`: *Missing buffer bounds check in v3/v5/v6 when buf is provided*. CWE-787, CWE-1285. Rango vulnerable `<11.1.1`, parcheado `>=11.1.1`.

Obsérvese que el fix propuesto por npm para `uuid` **no es actualizar `uuid`**, sino **retroceder `exceljs` de 4.4.0 a 3.4.0** — un salto mayor hacia atrás. `exceljs` no publica una versión ≥4 que dependa de `uuid >=11.1.1`.

#### A.1-bis — Lo que realmente contiene el árbol despachado (vía pnpm)

Los mismos cuatro paquetes, medidos sobre `pnpm-lock.yaml`:

| Paquete | Versión instalada real | GHSA / CVE | Sev. | Cadena real | Parcheado en |
|---|---|---|---|---|---|
| `js-yaml` | **4.1.1** | GHSA-52cp-r559-cp3m / CVE-2026-59869 | high | `apps__api>@nestjs/swagger>js-yaml` | `>=4.3.0` |
| `js-yaml` | **4.1.1** | GHSA-h67p-54hq-rp68 / CVE-2026-53550 | moderate | `apps__api>@nestjs/swagger>js-yaml` | `>=4.2.0` |
| `uuid` | **8.3.2** | GHSA-w5hq-g745-h8pq / CVE-2026-41907 | moderate | `apps__api>exceljs>uuid` | `>=11.1.1` |
| `uuid` | **10.0.0** | GHSA-w5hq-g745-h8pq / CVE-2026-41907 | moderate | `apps__api>resend>svix>uuid` | `>=11.1.1` |
| `@nestjs/swagger` | **11.4.4** | — | — | directa | — |
| `exceljs` | **4.4.0** | — | — | directa | — |

Títulos de los advisories de `js-yaml` realmente aplicables:

- **CVE-2026-59869** (high, CVSS 7.5, CWE-400/407): *js-yaml: YAML merge-key chains can force quadratic CPU consumption*.
- **CVE-2026-53550** (moderate, CVSS 5.3, CWE-407): *JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases*.

Ambos son defectos de la ruta de **parseo**. Ver A.3.

#### A.1-ter — La distinción prod/dev NO determina lo que llega a la imagen

El enunciado asume que aparecer en `audit-prod` equivale a "llega a la imagen". En este `Dockerfile` esa equivalencia **no se sostiene**. Dos líneas de [apps/api/Dockerfile](apps/api/Dockerfile):

- [Dockerfile:9](apps/api/Dockerfile:9) — `RUN pnpm install --frozen-lockfile --filter api...` — **sin `--prod`**, de modo que el builder instala también las `devDependencies`.
- [Dockerfile:21](apps/api/Dockerfile:21) — `COPY --from=builder /app/apps/api/node_modules ./node_modules` — copia ese árbol completo a la etapa `runner`.

No hay ningún paso de `prune` ni una segunda instalación con `--prod` entre ambas. En consecuencia, los **66 findings** del árbol completo (no solo los 53 de producción) corresponden a ficheros presentes en la imagen final. Los paquetes que aparecen únicamente en el árbol de desarrollo y que igualmente viajan: `@babel/core`, `fast-uri`, `flatted`, `picomatch`, y las rutas de `js-yaml@3.14.2` vía `jest` y `js-yaml@4.1.1` vía `@nestjs/cli`.

Resumen por módulo del subárbol `apps__api` (findings pnpm, no advisories únicos):

| Módulo | Árbol completo | Solo producción |
|---|---:|---:|
| `axios` | 28 | 28 |
| `undici` | 7 | 7 |
| `brace-expansion` | 7 | 4 |
| `js-yaml` | 4 | 2 |
| `picomatch` | 4 | — |
| `fast-uri` | 4 | — |
| `uuid` | 2 | 2 |
| `multer` | 2 | 2 |
| `flatted` | 2 | — |
| `postcss` (vía `sanitize-html`) | — | 3 |
| `form-data`, `follow-redirects`, `qs`, `sanitize-html`, `tmp` | 1 c/u | 1 c/u |
| `@babel/core` | 1 | — |
| **Total** | **66** | **53** |

### A.2 — Árbol del runner en aislamiento

Reproducción exacta de [Dockerfile:27](apps/api/Dockerfile:27) (`RUN npm install prisma@5.10.2`) en un directorio limpio:

```
npm init -y ; npm install prisma@5.10.2
added 6 packages, and audited 7 packages
found 0 vulnerabilities
```

`npm audit --json` sobre ese árbol: `info 0, low 0, moderate 0, high 0, critical 0, total 0`.

Árbol completo instalado:

```
prisma@5.10.2
└── @prisma/engines@5.10.2
    ├── @prisma/debug@5.10.2
    ├── @prisma/engines-version@5.10.0-34.5a9203d0590c951969e85a7d07215503f4672eb9
    ├── @prisma/fetch-engine@5.10.2
    └── @prisma/get-platform@5.10.2
```

**Comparación pedida:**

- ¿Cuáles de las 4 vulns del punto 1 aparecen aquí? **Ninguna.** El árbol del runner son 6 paquetes, todos del scope `@prisma/`, sin dependencias fuera de él.
- ¿Aparece alguna que NO esté en el árbol principal? **Ninguna.** El árbol está limpio.

Es decir: la instalación de `prisma` en la etapa `runner` no añade superficie de vulnerabilidad. Toda la superficie proviene del `node_modules` copiado en [Dockerfile:21](apps/api/Dockerfile:21).

### A.3 — ¿Runtime del servidor o solo `prisma migrate deploy`?

El contenedor ejecuta [Dockerfile:28](apps/api/Dockerfile:28): `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]`. Son dos fases distintas. Resultado para cada paquete vulnerable que llega a la imagen:

| Paquete | Fase | Evidencia |
|---|---|---|
| `@nestjs/swagger` | **Runtime del servidor**, en bootstrap | [main.ts:72](apps/api/src/main.ts:72) `SwaggerModule.createDocument(app, swaggerConfig)` y [main.ts:73](apps/api/src/main.ts:73) `SwaggerModule.setup('api/docs', app, document)`. **Sin guarda de `NODE_ENV`** ni bandera de entorno: se ejecuta siempre. |
| `js-yaml` | Cargado en el proceso, **ruta vulnerable no alcanzada** | Ver análisis abajo. |
| `exceljs` | **Runtime del servidor**, bajo petición HTTP | [spec-prefill/strategies/excel.strategy.ts:6](apps/api/src/spec-prefill/strategies/excel.strategy.ts:6) `import { Workbook } from 'exceljs';` |
| `uuid` | **Runtime del servidor** (transitivo), **ruta vulnerable no alcanzada** | Ver análisis abajo. |
| `multer` | **Runtime del servidor**, bajo petición HTTP | `diskStorage` en 4 controladores + `memoryStorage` en 1: [clients.controller.ts:24](apps/api/src/clients/clients.controller.ts:24), [users.controller.ts:18](apps/api/src/users/users.controller.ts:18), [templates.controller.ts:18](apps/api/src/templates/templates.controller.ts:18), [proposals.controller.ts:25](apps/api/src/proposals/proposals.controller.ts:25), [spec-options.controller.ts:24](apps/api/src/spec-options/spec-options.controller.ts:24), [spec-prefill.controller.ts:10](apps/api/src/spec-prefill/spec-prefill.controller.ts:10) |
| `axios` | **Runtime del servidor**, salidas HTTP | [trm.service.ts:2](apps/api/src/proposals/trm.service.ts:2), [gemini.client.ts:2](apps/api/src/spec-prefill/gemini.client.ts:2), [lenovo-psref.service.ts:7](apps/api/src/spec-prefill/services/lenovo-psref.service.ts:7), [hp-part-number.strategy.ts:2](apps/api/src/spec-prefill/strategies/hp-part-number.strategy.ts:2) |
| `sanitize-html` / `postcss` | **Runtime del servidor**, bajo petición HTTP | [common/sanitize.ts:2](apps/api/src/common/sanitize.ts:2) `require('sanitize-html')` (top-level, corre en bootstrap). Invocado en [pages.service.ts:323](apps/api/src/proposals/pages.service.ts:323) y `:358`, [proposals.service.ts:148](apps/api/src/proposals/proposals.service.ts:148), `:149`, `:380`, [scenarios.service.ts:96](apps/api/src/proposals/scenarios.service.ts:96) y `:118`. `postcss` entra por `apps__api>sanitize-html>postcss` |
| `tmp` | **Runtime del servidor**, **su propia API sí se ejecuta en bootstrap** | `exceljs/lib/exceljs.nodejs.js:7` carga `WorkbookReader` de forma eager aunque el API nunca lo use; `stream/xlsx/workbook-reader.js:6` `require('tmp')` y **`:17` `tmp.setGracefulCleanup();` como sentencia top-level**, que registra un hook de salida de proceso. `tmp.file()` (`:115`) queda en la ruta de streaming, que el API no usa (`grep WorkbookReader` en `apps/api/src` = 0). |
| `qs` | **Runtime del servidor**, `qs.parse()` **por petición** | Entra por `@nestjs/platform-express/adapters/express-adapter.js:10`; Nest registra el parser urlencoded por defecto (`:188`, `:191` `extended: true`, `:195`). `body-parser/lib/types/urlencoded.js:18` `require('qs')`, `:63` extended, `:69` `depth: 32`, `:99` `qs.parse(body, {...})`. Negativo relevante: `express/lib/application.js:97` fija `query parser: 'simple'` → los query strings los parsea `node:querystring`, **no** `qs`. |
| `undici` | Cargado en bootstrap, **API nunca ejercitada** | [trm.service.ts:3](apps/api/src/proposals/trm.service.ts:3) importa `cheerio`; `cheerio/dist/commonjs/index.js:59` `require('undici')` es top-level → 110 ficheros de `undici@7.24.4` entran al proceso. Pero `undici` solo se usa dentro del helper `fromURL()` de cheerio (`:210`, `:211`, `:215`, `:247`), y `grep fromURL` en `apps/api/src` = 0 hits. `trm.service.ts:84` hace `cheerio.load()` sobre una cadena ya descargada por axios. |
| `form-data` | Cargado en bootstrap, **constructor nunca invocado** | `axios/dist/node/axios.cjs:4` `require('form-data')` top-level. El constructor solo se alcanza en la rama multipart de `toFormData` (`:1746-1755`). Ningún punto de `apps/api/src` envía multipart saliente: los 3 hits de `multipart` en el código son decoradores `@ApiConsumes` y un comentario. |
| `flatted`, `picomatch`, `fast-uri`, `@babel/core`, `js-yaml@3.14.2` | **Ninguna de las dos fases** | Solo alcanzables desde `eslint` / `jest` / `@nestjs/cli`, que están en la imagen (A.1-ter) pero no se invocan ni en `migrate deploy` ni en `node dist/src/main.js`. `js-yaml@3.14.2` tiene como único dependiente `@istanbuljs/load-nyc-config` (cobertura de jest). |

Ningún paquete de la lista se ejecuta **exclusivamente** durante `prisma migrate deploy`: esa fase solo usa el árbol de A.2, que está limpio.

Distinción que conviene retener, porque cambia la lectura de la tabla: **estar cargado en el proceso no es lo mismo que ejecutarse**. De los paquetes vulnerables, los únicos cuya función defectuosa es alcanzable con el código actual son `qs` (parseo de cuerpos urlencoded en cada petición) y, parcialmente, `multer`, `axios` y `sanitize-html`. `tmp` es el único cuyo propio API se invoca con certeza en bootstrap, aunque la función invocada (`setGracefulCleanup`) no es la señalada por el advisory. `undici`, `form-data`, `js-yaml` y `uuid` residen en memoria sin que su ruta vulnerable llegue a ejecutarse.

**Análisis de alcanzabilidad de las dos rutas vulnerables** (leído sobre el código instalado, no inferido):

**`js-yaml` vía `@nestjs/swagger@11.4.4`.** El único uso de `js-yaml` dentro del paquete instalado es:

```
[swagger-module.js] const jsyaml = __importStar(require("js-yaml"));
[swagger-module.js] const yamlDocument = jsyaml.dump(documentToSerialize, {
```

Es decir, `@nestjs/swagger` **solo llama a `dump()`** (serialización). No hay ninguna llamada a `load()`, `loadAll()` ni `safeLoad()`. Ambos advisories aplicables (CVE-2026-59869 y CVE-2026-53550) describen consumo cuadrático de CPU en el manejo de **merge keys y alias durante el parseo**. La función `dump()` no parsea. El módulo se carga en memoria, pero la función defectuosa no se invoca por esta vía.

Precisiones adicionales, todas verificadas sobre el paquete instalado:

- `require("js-yaml")` en `swagger-module.js:58` es **top-level**: los 25 ficheros de `js-yaml@4.1.1` entran al proceso en el arranque, aunque nadie los llame.
- `jsyaml.dump()` (`swagger-module.js:228`) se ejecuta **solo dentro del handler de una ruta**. `setup()` (`:236`) deriva `finalYAMLDocumentPath` en `:249-251` como `${finalPath}-yaml`; como [main.ts:73](apps/api/src/main.ts:73) pasa solo 3 argumentos, `raw` toma su valor por defecto `true` (`:253`) y se registra la ruta en `:221`. Sin prefijo global en `main.ts`, esa ruta es **`GET /api/docs-yaml`**.
- `grep -rni yaml` sobre `apps/api/src` devuelve **cero** resultados: ningún código de aplicación emite ni parsea YAML.
- Dato colateral de seguridad, no de dependencias: la ruta se registra con `httpAdapter.get()`, es decir **fuera del router de Nest**, por lo que el `APP_GUARD` `ThrottlerGuard` de [app.module.ts:38](apps/api/src/app.module.ts:38) **no la cubre**. Helmet, CORS y compression sí aplican, porque se montan con `app.use()` antes ([main.ts:17-33](apps/api/src/main.ts:17)).

**`uuid` vía `exceljs` y vía `resend > svix`.** El advisory es específico: *missing buffer bounds check in **v3/v5/v6** when **buf** is provided*. Uso real medido:

- `exceljs@4.4.0`, `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`: `const {v4: uuidv4} = require('uuid');` — solo `v4`, invocado como `uuidv4()` sin argumento `buf`. Conteo sobre `dist/exceljs.min.js`: `v3(` = 0, `v5(` = 0, `v6(` = 0.
- `svix@1.90.0`, `request.js`: `this.headerParams["idempotency-key"] = \`auto_${(0, uuid_1.v4)()}\`;` — solo `v4`, sin `buf`.

Ninguna de las dos rutas usa `v3`, `v5` ni `v6`, ni pasa el parámetro `buf`. La función defectuosa no se invoca por ninguna de las dos vías.

`resend` sí es código de runtime: [auth/email-verification.service.ts:7](apps/api/src/auth/email-verification.service.ts:7) `import { Resend } from 'resend';`.

#### A.3-bis — `express` es una dependencia no declarada (hallazgo colateral)

Detectado al rastrear la cadena de `qs`. [main.ts:8](apps/api/src/main.ts:8) hace `import { json, urlencoded } from 'express';` y el build emite `const express_1 = require("express");` en `dist/src/main.js:12`. Sin embargo:

```
dependencies.express            : (ABSENT)
devDependencies.express         : (ABSENT)
devDependencies @types/express  : ^5.0.0
node -e "require.resolve('express')"  →  MODULE_NOT_FOUND
```

`express` **no figura en `apps/api/package.json`** ni en `dependencies` ni en `devDependencies`; solo están sus tipos. `require.resolve('express')` desde `apps/api` falla. El paquete existe únicamente bajo `node_modules/.pnpm/node_modules/express`, que está en la ruta de resolución de los paquetes que viven dentro de `.pnpm`, pero no en la de los ficheros propios de `apps/api`.

En producción el arranque no se rompe porque `@nestjs/platform-express` trae `express` por su cuenta (`adapters/express-adapter.js:10`) y Nest registra el parser urlencoded por defecto con `extended: true` (`:188-195`) — es decir, el comportamiento de `main.ts:19-20` se obtendría igual sin esas dos líneas. Pero el import de `main.ts:8` depende de un detalle de layout de pnpm, no de una dependencia declarada. No se midió el impacto de esto; se registra como dato observado.

### A.4 — ¿Algún fix obligaría a mover `prisma` / `@prisma/client` fuera de 5.10.2?

**No, en ninguno de los cuatro CVE.**

| CVE / advisory | ¿Obliga a mover prisma? | Evidencia |
|---|---|---|
| GHSA-pm4m-ph32-ghv5 (`js-yaml` 5.x) | **No** | El fix vive en la cadena `@nestjs/swagger > js-yaml`; no comparte ningún nodo con `prisma`. |
| CVE-2026-59869 / CVE-2026-53550 (`js-yaml` 4.1.1) | **No** | Ídem. |
| CVE-2026-41907 (`uuid` vía `exceljs`) | **No** | El fix propuesto (`exceljs@3.4.0`) no toca el subárbol de `prisma`. |
| CVE-2026-41907 (`uuid` vía `resend > svix`) | **No** | Ídem. |

Comprobación transversal ejecutada sobre ambos árboles de pnpm (completo y de producción): **ninguna ruta de advisory contiene `prisma` ni `@prisma/client`** en ningún segmento. En el lockfile npm sintético, `prisma@5.10.2` y `@prisma/client@5.10.2` se resuelven exactamente a la versión pineada y no figuran como dependientes de `js-yaml`, `uuid`, `exceljs` ni `@nestjs/swagger`.

---

## BLOQUE B — Composición del bundle de `apps/web`

### B.5 — Método y desviación

`rollup-plugin-visualizer@7.0.1` se instaló **fuera del árbol del proyecto**, en el directorio de scratchpad de la sesión, y se referenció desde `vite.config.ts` por ruta absoluta.

Motivo de la desviación respecto al `npm install --no-save` pedido: `apps/web/node_modules` es un árbol de enlaces gestionado por pnpm. Ejecutar `npm install` dentro de él —incluso con `--no-save`— reescribe y poda la estructura, lo que habría dejado el árbol de trabajo en un estado distinto al del lockfile. La instalación fuera del árbol produce la misma medición sin ese riesgo y sin tocar `package.json` (que quedó intacto, como pedía el enunciado).

Build ejecutado: `npm run build` en `apps/web` (`tsc -b && vite build`), salida limpia, exit 0, 2644 módulos transformados en 36.38 s.

### B.6 — Chunks mayores de 500 kB

Dos chunks superan 500 kB en disco. Se incluye el chunk de entrada como tercera fila porque es el único que se descarga en la carga inicial (ver B.7), aunque quede por debajo del umbral.

| Chunk | Raw (disco, minificado) | Gzip | ¿Carga inicial? |
|---|---:|---:|---|
| `assets/RichTextEditor-Cx_PJmPg.js` | **1 021,08 kB** | **312,40 kB** | No |
| `assets/FileSaver.min-toCP5K6r.js` | **939,20 kB** | **271,73 kB** | No |
| `assets/index-Cr2afobK.js` (entrada) | 462,54 kB | 152,26 kB | **Sí** |

> Nota sobre unidades: la columna "raw" es el tamaño del fichero minificado en `dist/`, tal como lo reporta Vite. Las tablas de módulos que siguen usan los tamaños *parsed* de rollup-plugin-visualizer (fuente de cada módulo tal como entra al chunk, **antes** de minificar el chunk completo). Por eso los totales del visualizer son mayores: `RichTextEditor` suma 2 001,7 kB parsed → 1 021,08 kB en disco. `FileSaver.min` suma 928,5 kB parsed ≈ 939,20 kB en disco porque su contenido ya venía minificado desde el paquete.

#### `RichTextEditor-Cx_PJmPg.js` — 94 módulos, 2 001,7 kB parsed / 494,2 kB gzip

| # | Módulo | Parsed | Gzip |
|---|---|---:|---:|
| 1 | `html2canvas-pro@2.0.2/dist/html2canvas-pro.esm.js` | 508,8 kB | 98,5 kB |
| 2 | `jspdf@4.2.1/dist/jspdf.es.min.js` | 335,2 kB | 106,8 kB |
| 3 | `prosemirror-view@1.41.7/dist/index.js` | 238,7 kB | 57,7 kB |
| 4 | `@tiptap/core@3.20.5/dist/index.js` | 170,2 kB | 35,6 kB |
| 5 | `prosemirror-model@1.25.4/dist/index.js` | 121,2 kB | 28,7 kB |
| 6 | `pako@2.1.0/dist/pako.esm.mjs` | 104,3 kB | 24,7 kB |
| 7 | `prosemirror-transform@1.11.0/dist/index.js` | 80,7 kB | 18,8 kB |
| 8 | `linkifyjs@4.3.2/dist/linkify.mjs` | 59,4 kB | 20,4 kB |
| 9 | `prosemirror-state@1.4.4/dist/index.js` | 35,2 kB | 9,0 kB |
| 10 | `@tiptap/extension-list@3.20.5/dist/index.js` | 31,0 kB | 6,2 kB |

Reparto: 1 948,6 kB de `node_modules`, 53,1 kB de código de aplicación.

#### `FileSaver.min-toCP5K6r.js` — 7 módulos, 928,5 kB parsed / 251,7 kB gzip

| # | Módulo | Parsed | Gzip |
|---|---|---:|---:|
| 1 | `exceljs@4.4.0/dist/exceljs.min.js` | 925,2 kB | 250,0 kB |
| 2 | `file-saver@2.0.5/dist/FileSaver.min.js` | 2,8 kB | 1,3 kB |
| 3 | `commonjs-dynamic-modules` (shim) | 0,2 kB | 0,2 kB |
| 4-7 | shims `?commonjs-es-import` / `?commonjs-module` de ambos | < 0,1 kB c/u | — |

El nombre del chunk es engañoso: rollup lo bautizó por `FileSaver.min.js`, pero **el 99,6 % de su peso es `exceljs`**.

#### `index-Cr2afobK.js` (entrada) — 400 módulos, 1 319,0 kB parsed / 333,6 kB gzip

| # | Módulo | Parsed | Gzip |
|---|---|---:|---:|
| 1 | `react-dom@19.2.4/cjs/react-dom-client.production.js` | 539,9 kB | 93,2 kB |
| 2 | `tailwind-merge@3.5.0/dist/bundle-mjs.mjs` | 97,1 kB | 16,0 kB |
| 3 | `react-router@7.13.1/dist/development/chunk-LFPYN7LY.mjs` | 81,1 kB | 19,8 kB |
| 4 | `motion-dom@12.35.0/.../create-projection-node.mjs` | 66,8 kB | 13,7 kB |
| 5 | `axios@1.13.6/lib/utils.js` | 22,8 kB | 6,5 kB |
| 6 | `framer-motion@12.35.0/.../VisualElementDragControls.mjs` | 22,8 kB | 5,5 kB |
| 7 | `react@19.2.4/cjs/react.production.js` | 17,9 kB | 4,4 kB |
| 8 | `motion-dom@12.35.0/.../animation-state.mjs` | 16,4 kB | 4,3 kB |
| 9 | `motion-dom@12.35.0/.../VisualElement.mjs` | 13,3 kB | 3,6 kB |
| 10 | `scheduler@0.27.0/cjs/scheduler.production.js` | 10,9 kB | 2,6 kB |

Reparto: 1 255,3 kB de `node_modules`, 63,7 kB de código de aplicación. Nota: entra la build `development` de `react-router` (nombre del fichero resuelto), no la de producción.

### B.7 — Cadenas de import de `exceljs`, `file-saver`, `html2canvas-pro`, `jspdf` y `@tiptap/*`

**Ninguno de los cinco entra al bundle inicial.** La premisa del enunciado no se sostiene, y la evidencia es directa sobre `dist/`, no inferida:

1. `dist/index.html` referencia **un solo script**: `<script type="module" crossorigin src="/assets/index-Cr2afobK.js">`. No hay ningún `<link rel="modulepreload">`.
2. El chunk de entrada `index-Cr2afobK.js` no contiene **ningún** import estático `./…`. Sus únicas referencias a otros chunks son 12 `import()` dinámicos, uno por ruta.
3. No existe ninguna ruta `/` en la aplicación. `App.tsx:96` define `<Route path="*" element={<Navigate to="/login" replace />} />`, de modo que `/` cae en el comodín y redirige a `/login`, servido por el `Login` importado estáticamente en `App.tsx:7`. Los 12 componentes de página están en `React.lazy` (`App.tsx:10-21`).

Por tanto la carga inicial en `/` es exactamente: `index-Cr2afobK.js` (462,54 kB / 152,26 kB gzip) + `index-DYmKUZWv.css` (89,80 kB / 13,18 kB gzip).

Sitios de import estático y ruta que los activa:

| Paquete | Fichero y línea del import estático | Chunk destino | ¿Carga en `/`? | Ruta que lo dispara |
|---|---|---|---|---|
| `exceljs` | [lib/exportDashboard.ts:1](apps/web/src/lib/exportDashboard.ts:1) `import ExcelJS from 'exceljs';` | `FileSaver.min` | **No** | `/dashboard` |
| `exceljs` | [lib/exportProjectionReport.ts:1](apps/web/src/lib/exportProjectionReport.ts:1) | `FileSaver.min` | **No** | `/dashboard` |
| `exceljs` | [lib/exportExcel.ts:1](apps/web/src/lib/exportExcel.ts:1) | `FileSaver.min` | **No** | `/proposals/:id/calculations` |
| `exceljs` | [lib/exportProposalExcel.ts:1](apps/web/src/lib/exportProposalExcel.ts:1) | `exportProposalExcel` | **No** | doble aislamiento: `import()` dinámico en [PdfPreviewModal.tsx:153](apps/web/src/components/proposals/PdfPreviewModal.tsx:153), dentro de rutas ya lazy |
| `file-saver` | [lib/exportDashboard.ts:2](apps/web/src/lib/exportDashboard.ts:2) `import { saveAs } from 'file-saver';` | `FileSaver.min` | **No** | `/dashboard` |
| `file-saver` | [lib/exportProjectionReport.ts:2](apps/web/src/lib/exportProjectionReport.ts:2) | `FileSaver.min` | **No** | `/dashboard` |
| `file-saver` | [lib/exportExcel.ts:2](apps/web/src/lib/exportExcel.ts:2) | `FileSaver.min` | **No** | `/proposals/:id/calculations` |
| `file-saver` | [lib/exportProposalExcel.ts:2](apps/web/src/lib/exportProposalExcel.ts:2) | `exportProposalExcel` | **No** | ídem que arriba |
| `html2canvas-pro` | [components/proposals/PdfPreviewModal.tsx:8](apps/web/src/components/proposals/PdfPreviewModal.tsx:8) `import html2canvas from 'html2canvas-pro';` | `RichTextEditor` | **No** | `/proposals/:id/document`, `/admin/templates` |
| `jspdf` | [components/proposals/PdfPreviewModal.tsx:9](apps/web/src/components/proposals/PdfPreviewModal.tsx:9) `import { jsPDF } from 'jspdf';` | `RichTextEditor` | **No** | ídem |
| `@tiptap/html` | [components/proposals/PdfPreviewModal.tsx:3](apps/web/src/components/proposals/PdfPreviewModal.tsx:3) | `RichTextEditor` | **No** | ídem |
| `@tiptap/starter-kit` | [PdfPreviewModal.tsx:4](apps/web/src/components/proposals/PdfPreviewModal.tsx:4) y [RichTextEditor.tsx:2](apps/web/src/components/proposals/RichTextEditor.tsx:2) | `RichTextEditor` | **No** | ídem |
| `@tiptap/extension-text-align` | [PdfPreviewModal.tsx:5](apps/web/src/components/proposals/PdfPreviewModal.tsx:5) y [RichTextEditor.tsx:3](apps/web/src/components/proposals/RichTextEditor.tsx:3) | `RichTextEditor` | **No** | ídem |
| `@tiptap/react` | [RichTextEditor.tsx:1](apps/web/src/components/proposals/RichTextEditor.tsx:1) `import { useEditor, EditorContent } from '@tiptap/react';` | `RichTextEditor` | **No** | ídem |

Cadenas completas hasta la frontera lazy:

- **`exceljs` + `file-saver`** → `lib/export*.ts` ← [Dashboard.tsx:13](apps/web/src/pages/Dashboard.tsx:13) y [Dashboard.tsx:15](apps/web/src/pages/Dashboard.tsx:15) (estático) ← **`App.tsx:10` `lazy(() => import('./pages/Dashboard'))`**. Segunda cadena: `lib/exportExcel.ts` ← [ProposalCalculations.tsx:11](apps/web/src/pages/proposals/ProposalCalculations.tsx:11) ← **`App.tsx:14`** (lazy).
- **`html2canvas-pro` + `jspdf` + `@tiptap/*`** → `PdfPreviewModal.tsx` ← [ProposalDocBuilder.tsx:17](apps/web/src/pages/proposals/ProposalDocBuilder.tsx:17) y [DefaultPagesAdmin.tsx:14](apps/web/src/pages/admin/DefaultPagesAdmin.tsx:14) ← **`App.tsx:15` y `App.tsx:17`** (lazy). Cadena adicional de `@tiptap`: `RichTextEditor.tsx` ← [BlockEditor.tsx:7](apps/web/src/pages/proposals/components/BlockEditor.tsx:7) ← [PageEditor.tsx:10](apps/web/src/pages/proposals/components/PageEditor.tsx:10) ← [ProposalDocBuilder.tsx:29](apps/web/src/pages/proposals/ProposalDocBuilder.tsx:29) ← **`App.tsx:15`** (lazy).

Comprobado además que nada fuerza estos paquetes a un chunk eager: `vite.config.ts` no define `manualChunks`, ni `build.rollupOptions.output`, ni `resolve.alias`; no hay ficheros barrel (`index.ts`) en `apps/web/src`; y no se usa `import.meta.glob` en ninguna parte.

#### Grafo de carga real (medido sobre `dist/`)

| Al entrar en | Se descarga además | Coste gzip añadido |
|---|---|---|
| `/` → redirige a `/login` | nada | 0 |
| `/dashboard` | `Dashboard` + **`FileSaver.min`** (estático desde `Dashboard`) | 22,53 + **271,73** kB |
| `/proposals/:id/calculations` | `ProposalCalculations` + **`FileSaver.min`** | 13,52 + **271,73** kB |
| `/proposals/:id/document` | `ProposalDocBuilder` + **`RichTextEditor`** | 9,88 + **312,40** kB |
| `/admin/templates` | `DefaultPagesAdmin` + **`RichTextEditor`** | 5,10 + **312,40** kB |
| Abrir el modal de PDF | `html2canvas.esm`, `index.es`, `purify.es`, `exportProposalExcel` (`import()` desde `RichTextEditor`) | 47,43 + 53,09 + 8,67 + 2,03 kB |

Es decir: `FileSaver.min` y `RichTextEditor` **no son lazy respecto a su ruta** — son imports estáticos de los chunks de ruta, así que se descargan completos al entrar en ella, no al pulsar el botón de exportar.

#### Hallazgo colateral: dos librerías de captura de pantalla

El chunk `html2canvas.esm-DXEQVQnt.js` (201,04 kB / 47,43 kB gzip) contiene **`html2canvas@1.4.1`**, que es un paquete **distinto** de `html2canvas-pro@2.0.2`. Entra como dependencia opcional de `jspdf`, no desde código de aplicación. El bundle transporta por tanto las dos librerías. En la misma línea, `index.es-Dxqws-c8.js` (158,91 kB / 53,09 kB gzip) son las dependencias opcionales de `jspdf` para SVG: `canvg@3.0.11` (165,3 kB parsed), `svg-pathdata`, `stackblur-canvas` y ~30 polyfills de `core-js@3.49.0`.

### B.8 — Reversión de `vite.config.ts`

Revertido con `git checkout -- apps/web/vite.config.ts`. Verificación:

```
$ git status --porcelain
(vacío)
$ git diff
(vacío)
$ git diff --stat master
(vacío)
```

El fichero quedó byte-idéntico a `master`. `apps/web/dist/` no aparece en `git status` porque `apps/web/.gitignore:11` ignora `dist`.

---

## BLOQUE C — nginx

Fichero único que sirve `apps/web`: [apps/web/nginx.conf](apps/web/nginx.conf), 42 líneas, copiado a la imagen por el `Dockerfile` multi-stage de `apps/web` (etapa `runner` con `nginx:alpine`).

Respuestas textuales:

| Pregunta | Respuesta |
|---|---|
| ¿Existe `gzip on`? | **No.** La cadena `gzip` no aparece en el fichero. |
| ¿Qué `gzip_types` están declarados? | **Ninguno.** La directiva no existe. |
| ¿Hay `gzip_min_length`? | **No.** |
| ¿Brotli? | **No.** No hay `brotli`, `brotli_static` ni `brotli_types`, ni carga del módulo. |

Contenido íntegro de las directivas presentes:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /assets/ {
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location / {
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ /index.html;
    }
}
```

No hay ninguna otra directiva: el fichero solo define `listen`, `root`, `index`, cuatro cabeceras de seguridad a nivel `server`, y dos bloques `location` que repiten esas cabeceras y añaden `Cache-Control` y `try_files`.

Dato asociado, ya medido en el Bloque B: la imagen `nginx:alpine` por defecto trae `gzip off`. Las cifras "gzip" de las tablas del Bloque B son las que **calcula Vite en build**, no las que el servidor entrega hoy. Con la configuración actual, un cliente que entra en `/dashboard` descarga `FileSaver.min-toCP5K6r.js` **sin comprimir: 939,20 kB en lugar de 271,73 kB**. Lo mismo aplica a los demás `.js` y al `.css`.

---

## Preguntas abiertas

1. **Origen de las "4 vulnerabilidades" del enunciado.** Coinciden exactamente con el `npm audit` sintético (2 moderate + 2 high), pero no con el árbol despachado ni con el del runner (0). No se pudo determinar de qué ejecución concreta salió ese número ni en qué fecha, y por tanto tampoco si en su momento describía el mismo conjunto de paquetes que hoy.

2. **¿Se resuelven realmente los enlaces de pnpm en la imagen?** [Dockerfile:21](apps/api/Dockerfile:21) copia `apps/api/node_modules`, que con pnpm es un árbol de enlaces simbólicos hacia `/app/node_modules/.pnpm/` — directorio que **no** se copia a la etapa `runner`. No se pudo verificar sin construir la imagen (el build local de Docker está roto por un problema preexistente de junctions en Windows, registrado aparte). Si los enlaces quedan colgando, el inventario real de la imagen sería menor que los 66 findings reportados; si Docker los deshace al copiar, el inventario es el reportado. **Esta pregunta condiciona la cifra de A.1-ter y debería resolverse antes de actuar sobre ella.**

3. **`postcss` aparece en el árbol de producción de `apps__api` (3 findings, vía `sanitize-html`) pero no en el listado del árbol completo.** Es contradictorio y parece un artefacto de deduplicación de `pnpm audit` cuando el mismo módulo es alcanzable desde varios paquetes del workspace. No se determinó la causa.

4. **Severidad efectiva de los advisories de `axios` (28 findings, el módulo con más peso del Bloque A).** Es el hueco principal que queda. Se estableció que `axios` se ejecuta en runtime y desde dónde ([trm.service.ts:45](apps/api/src/proposals/trm.service.ts:45) y `:74`, [gemini.client.ts:84](apps/api/src/spec-prefill/gemini.client.ts:84), [lenovo-psref.service.ts:122](apps/api/src/spec-prefill/services/lenovo-psref.service.ts:122) `:136` `:203` `:242`, [hp-part-number.strategy.ts:123](apps/api/src/spec-prefill/strategies/hp-part-number.strategy.ts:123) `:124`), pero **no** se analizó advisory por advisory cuáles de los 28 son alcanzables con ese uso concreto. Queda pendiente lo mismo para `follow-redirects` y para los 3 advisories de `postcss` vía `sanitize-html`. Sí quedó resuelto para `js-yaml`, `uuid`, `tmp`, `qs`, `undici` y `form-data` (sección A.3).

5. **`react-router` resuelto a la build `development`.** El módulo que entra al chunk de entrada es `react-router/dist/development/chunk-LFPYN7LY.mjs` (81,1 kB parsed). No se determinó si es solo el nombre del fichero resuelto por el campo `exports` del paquete o si efectivamente se está empaquetando la variante de desarrollo en la build de producción.

6. **`@tiptap/extension-underline` y `@tiptap/pm` están declarados en `apps/web/package.json` pero no tienen ningún sitio de import en `apps/web/src`.** No se determinó si son dependencias muertas o peers requeridos por otros paquetes de `@tiptap`.

7. **Alcance real del `express` no declarado (A.3-bis).** No se determinó si el import de [main.ts:8](apps/api/src/main.ts:8) llega a resolverse dentro del contenedor. Depende de la misma incógnita de la pregunta 2: si el `COPY` de `node_modules` preserva el layout de `.pnpm` o no. Tampoco se comprobó si `pnpm build` fallaría en un entorno con `node-linker=isolated` estricto.

8. **Cifras de gzip reales servidas.** Todas las cifras gzip del Bloque B las calcula Vite en build. Dado el Bloque C (`gzip off`), no se midió qué entrega realmente el nginx de producción ni si Railway interpone alguna capa de compresión en el edge por delante del contenedor.

---

# Anexo: exposición de Swagger

**Fecha de medición:** 2026-07-24. **Rama:** `chore/audit-deps-y-bundle` @ `7033683`, árbol de trabajo limpio.
**Alcance:** solo diagnóstico. **No se modificó `main.ts` ni ningún otro código de aplicación.** El fix de la sección D.11–D.12 está redactado pero **no aplicado**.
**Servicio medido:** servicio Railway `novotechflow` (el API NestJS), entorno `production`.

> Nota sobre el commit desplegado: el despliegue activo es `410db2f` (`SUCCESS`, 2026-07-24T18:12:57Z), dos commits por detrás de la rama local. `git diff 410db2f 7033683 -- apps/api/src/main.ts apps/api/src/app.module.ts apps/api/src/auth/auth.controller.ts` sale **vacío**: los tres ficheros relevantes son idénticos entre lo desplegado y lo medido en local. Los dos commits de diferencia son `17b4979` (docs) y `7033683` (nginx de `apps/web`). Las mediciones de red y la lectura de código describen, por tanto, el mismo código.

---

## A — Código

### A.1 — `apps/api/src/main.ts`, línea 60 al final del bootstrap

Transcripción textual:

```ts
60	    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
61	  }
62	
63	  // Serve uploaded images as static files
64	  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });
65	
66	  // Swagger / OpenAPI
67	  const swaggerConfig = new DocumentBuilder()
68	    .setTitle('NovoTechFlow API')
69	    .setDescription('API de cotizaciones comerciales para NOVOTECHNO')
70	    .setVersion('1.0')
71	    .addBearerAuth()
72	    .build();
73	  const document = SwaggerModule.createDocument(app, swaggerConfig);
74	  SwaggerModule.setup('api/docs', app, document);
75	
76	  await app.listen(process.env.PORT ?? 3000);
77	}
78	bootstrap();
```

> Corrección de numeración respecto al enunciado y al diagnóstico previo: el bloque de Swagger está en **[main.ts:66-74](apps/api/src/main.ts:66)**, no en 72-73. Las líneas 72-73 citadas antes corresponden a `.build();` y `createDocument(...)`. El fichero completo tiene 78 líneas.

**Confirmado: no hay ninguna guarda de entorno.** Entre `app.useStaticAssets(...)` ([main.ts:64](apps/api/src/main.ts:64)) y `await app.listen(...)` ([main.ts:76](apps/api/src/main.ts:76)) no existe ningún `if`, ningún ternario, ni ninguna lectura de `process.env` distinta de `PORT`. El bloque se ejecuta incondicionalmente en todo arranque del proceso.

### A.2 — Variables de entorno que controlen Swagger

**No existe ninguna.** Búsquedas ejecutadas y su resultado:

| Búsqueda | Ámbito | Resultado |
|---|---|---|
| `SWAGGER｜API_DOCS｜DOCS_｜_DOCS｜docs-yaml｜SwaggerModule｜DocumentBuilder` (case-insensitive) | `apps/api/` completo | 23 hits, **todos** son `import` de decoradores (`ApiTags`, `ApiProperty`, `ApiBearerAuth`, `ApiOperation`), la dependencia en `package.json:33`, y las 4 líneas de `main.ts`. Ninguno es una lectura de entorno. |
| `SWAGGER｜DOCS｜NODE_ENV` (case-insensitive) | todos los `.env*` del repo (`.env`, `apps/api/.env`, `apps/api/.env.example`, backup) | **0 coincidencias** |

Contenido íntegro de las variables declaradas en [apps/api/.env.example](apps/api/.env.example): `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. **No hay ninguna entrada relativa a Swagger, docs ni `NODE_ENV`**, ni usada ni muerta.

### A.3 — `NODE_ENV` en producción

Servicio identificado con `railway status` (el CLI está enlazado a proyecto `novotechflow` / entorno `production`, sin servicio fijado). El servicio del API se llama **`novotechflow`** — no `api`:

```
Services
  - api-external:  Online · https://api-external-production-9ce0.up.railway.app
  - novotechflow:  Online · https://novotechflow-production.up.railway.app
  - web:           Online · https://web-production-55504.up.railway.app
```

`railway variable list --json --service novotechflow` respondió correctamente. **`NODE_ENV` existe y vale `production`.**

> Advertencia operativa: `railway variable list --json` imprime los **valores en claro** de todos los secretos del servicio (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY`). Es el comportamiento conocido del CLI v5.23.3, también con salida de tabla. Ninguno de esos valores se ha transcrito a este documento. Si el comando se ejecuta en un terminal compartido o cuya salida se registra, conviene tenerlo presente.

Variables no sensibles relevantes para este anexo:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `RAILWAY_PUBLIC_DOMAIN` | `novotechflow-production.up.railway.app` |
| `CORS_ORIGIN` | `https://web-production-55504.up.railway.app` |

El servicio declara **8 variables propias** (el resto son inyectadas por Railway). `NODE_ENV=production` está correctamente fijado, lo cual hace **técnicamente viable** la opción de derivar la guarda de `NODE_ENV` (se evalúa en D.11).

---

## B — Alcanzabilidad real

### B.4 — Dominio público

**`novotechflow-production.up.railway.app`**, tomado de `RAILWAY_PUBLIC_DOMAIN` y confirmado por `railway status`. Servicio `Online`, región `us-west2`, **`numReplicas = 1`** (dato que importa en la sección C).

### B.5 — Medición con `curl.exe`, sin credenciales

Ninguna petición de esta sección llevó cabecera `Authorization`, cookie ni credencial de ningún tipo. Cliente anónimo desde una máquina Windows doméstica, fuera de la red de Railway.

| Endpoint | HTTP | Bytes | Content-Type | Tiempo |
|---|---:|---:|---|---:|
| `/api/docs` | **200** | 3 126 | `text/html; charset=utf-8` | 0,523 s |
| `/api/docs-yaml` | **200** | 44 413 | `text/yaml; charset=utf-8` | 0,444 s |
| `/api/docs-json` | **200** | 34 151 | `application/json; charset=utf-8` | 0,415 s |
| `/api/docs/swagger-ui-init.js` | **200** | 75 480 | `application/javascript; charset=utf-8` | — |

Las dos últimas filas no estaban en el enunciado. Se añaden porque `SwaggerModule.setup()` registra **cuatro** rutas, no una, y omitirlas daría una imagen incompleta de la superficie expuesta (ver B.7-bis).

### B.6 — Interpretación

**Sí. Los cuatro endpoints responden `200 OK` a un cliente anónimo desde internet, sin autenticación de ningún tipo.** No hay 401, no hay 403, no hay 404, no hay redirección. El cuerpo se entrega completo y es directamente legible.

### B.7 — Qué se está publicando

Primeras 40 líneas de `GET /api/docs-yaml`:

```yaml
openapi: 3.0.0
paths:
  /:
    get:
      operationId: AppController_getHello
      parameters: []
      responses:
        '200':
          description: ''
      tags:
        - App
  /app-settings/inactivity-timeout:
    get:
      operationId: AppSettingsController_getInactivityTimeout
      parameters: []
      responses:
        '200':
          description: ''
      security:
        - bearer: []
      summary: Obtener timeout de inactividad (minutos)
      tags:
        - app-settings
    patch:
      operationId: AppSettingsController_updateInactivityTimeout
      parameters: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateInactivityTimeoutDto'
      responses:
        '200':
          description: ''
      security:
        - bearer: []
      summary: Actualizar timeout de inactividad (solo admin)
      tags:
        - app-settings
```

Dimensión del spec (contado sobre `/api/docs-json`, que es el mismo documento en JSON):

| Métrica | Valor |
|---|---:|
| **Rutas distintas (claves de `paths`)** | **65** |
| Operaciones (pares ruta+método) | 93 |
| Esquemas en `components.schemas` | 43 |
| Líneas del YAML | 1 895 |
| Esquemas de seguridad | 1 (`bearer`) |

Reparto de las 65 rutas por primer segmento:

| Grupo | Rutas | | Grupo | Rutas |
|---|---:|---|---|---:|
| `proposals` | 26 | | `billing-projections` | 2 |
| `admin` | 11 | | `catalogs` | 2 |
| `templates` | 6 | | `presence` | 2 |
| `app-settings` | 4 | | `suppliers` | 2 |
| `auth` | 3 | | `clients` | 1 |
| `users` | 3 | | `spec-options` | 1 |
| `/` (raíz) | 1 | | `spec-prefill` | 1 |

Es decir: se publica el **mapa completo de la API**, incluidas las 11 rutas bajo `/admin`, los nombres de operación internos (`AppSettingsController_updateInactivityTimeout`), las descripciones en lenguaje natural de cada endpoint (`"solo admin"`), y los 43 esquemas de request/response con sus campos y tipos. El spec **no contiene secretos ni datos de negocio** — es metadatos de la superficie HTTP —, pero equivale a entregar la documentación de reconocimiento completa a cualquiera que pida la URL.

### B.7-bis — `/api/docs-yaml` no es el único vector

Dato que condiciona la elección del fix (D.11): **el HTML de `/api/docs` no carga el spec desde `/api/docs-yaml` ni desde `/api/docs-json`.** `SwaggerModule.serveSwaggerUi()` genera `/api/docs/swagger-ui-init.js` con el documento **incrustado en el propio JavaScript**. Verificado: ese fichero pesa 75 480 bytes (más que el YAML y que el JSON) y contiene los marcadores `"swaggerDoc"`, `AppController_getHello` y `securitySchemes`.

Consecuencia práctica: **bloquear `/api/docs-yaml` y dejar `/api/docs` no oculta nada.** El spec íntegro seguiría descargable en `/api/docs/swagger-ui-init.js`, y además en `/api/docs-json`.

---

## C — Throttle

### C.10 — Configuración del `ThrottlerModule`

[app.module.ts:35](apps/api/src/app.module.ts:35), forma de array sin nombre (es decir, el throttler `default`):

```ts
ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
```

**`ttl = 60000 ms` (60 s), `limit = 30` peticiones.** Registrado como guarda global en [app.module.ts:38](apps/api/src/app.module.ts:38):

```ts
providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
```

Sobrescrituras por ruta encontradas en `apps/api/src`:

| Decorador | Ubicación | Efecto |
|---|---|---|
| `@Throttle({ default: { limit: 5, ttl: 60000 } })` | [auth.controller.ts:20](apps/api/src/auth/auth.controller.ts:20) (`POST /auth/login`) | 5 / 60 s |
| `@Throttle({ default: { limit: 5, ttl: 60000 } })` | [auth.controller.ts:34](apps/api/src/auth/auth.controller.ts:34) (`POST /auth/verify-code`) | 5 / 60 s |
| `@Throttle({ default: { limit: 3, ttl: 60000 } })` | [auth.controller.ts:41](apps/api/src/auth/auth.controller.ts:41) (`POST /auth/resend-code`) | 3 / 60 s |
| `@SkipThrottle()` | `app-settings.controller.ts:58` y `:105`, `presence.controller.ts:29` y `:37`, `proposals.controller.ts:81` | exentos |

Versión instalada: `@nestjs/throttler@6.5.0`.

### C.8 — 10 peticiones secuenciales a `/api/docs-yaml`

| # | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| HTTP | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |

**Ningún 429.** El hallazgo previo no queda desmentido por esta prueba.

> **Pero esta prueba, por sí sola, no demuestra nada.** Con `limit = 30` por ventana de 60 s, 10 peticiones **no pueden** disparar un 429 ni siquiera en una ruta correctamente protegida. El resultado es exactamente el que se obtendría con el throttler funcionando. Se ejecutó tal como se pidió, pero la conclusión hay que sostenerla con la evidencia de C.8-bis, no con esta tabla.

### C.8-bis — Prueba decisiva: cabeceras `X-RateLimit-*` (sin carga adicional)

`ThrottlerGuard` de v6.5.0 escribe tres cabeceras en **toda** respuesta que pase por él (`throttler.guard.js:135-137`):

```js
res.header(`${this.headerPrefix}-Limit...`, limit);
res.header(`${this.headerPrefix}-Remaining...`, Math.max(0, limit - totalHits));
res.header(`${this.headerPrefix}-Reset...`, timeToExpire);
```

Su presencia o ausencia es una firma directa de si la guarda se ejecutó. Medido:

| Petición | Cabeceras devueltas |
|---|---|
| `GET /api/docs-yaml` | `HTTP/1.1 200 OK` — **ninguna cabecera `X-RateLimit-*`, ninguna `Retry-After`** |
| `POST /auth/login` | `HTTP/1.1 401` + `x-ratelimit-limit: 5` + `x-ratelimit-remaining: 4` + `x-ratelimit-reset: 60` |

**Conclusión firme: el `ThrottlerGuard` nunca se ejecuta para `/api/docs-yaml`.** No es que permita las peticiones — es que la ruta no atraviesa el pipeline de guardas de Nest en absoluto. Esto confirma el mecanismo apuntado en el diagnóstico previo, y ahora verificado sobre el paquete instalado: `swagger-module.js` registra las rutas con `httpAdapter.get()` (líneas `197`, `198`, `210`, `221`), es decir, directamente sobre el adaptador Express, por debajo del router de Nest. El `APP_GUARD` de [app.module.ts:38](apps/api/src/app.module.ts:38) solo cubre rutas resueltas por el router.

### C.9 — Control contra una ruta del router de Nest

Se eligió `POST /auth/login` con credenciales inválidas a propósito (`nonexistent@example.invalid` / `deliberately-wrong`), porque su `@Throttle` de **5/60 s** sí permite superar el umbral dentro del presupuesto de 10 peticiones.

**Primer intento — inválido, se descarta.** Las 10 peticiones devolvieron `400`:

| # | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| HTTP | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 | 400 |

Causa: el escapado `'{\"email\":...}'` en PowerShell llega literal a `curl.exe`, produciendo JSON malformado. El `400` lo emite el middleware `body-parser` de Express, que corre **antes** que cualquier guarda de Nest. Las peticiones nunca alcanzaron el `ThrottlerGuard`, así que la prueba no medía nada. Se repitió con el cuerpo en fichero (`--data-binary "@login.json"`).

**Segundo intento — válido:**

| # | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| HTTP | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 |

`401` confirma que la petición llega al handler. Pero **tampoco aparece ningún 429**, pese a que el límite de esa ruta es 5 y se hicieron 10 peticiones.

**El control falló en su propósito: no demuestra que el throttler funcione en general. Demuestra lo contrario.**

### C.9-bis — Hallazgo no previsto: el throttler es inoperante en producción para todas las rutas

Tres peticiones consecutivas a `POST /auth/login`, leyendo la cabecera:

```
req 1 : 401 | x-ratelimit-limit: 5 | x-ratelimit-remaining: 4 | x-ratelimit-reset: 60
req 2 : 401 | x-ratelimit-limit: 5 | x-ratelimit-remaining: 4 | x-ratelimit-reset: 60
req 3 : 401 | x-ratelimit-limit: 5 | x-ratelimit-remaining: 4 | x-ratelimit-reset: 60
```

`remaining` se queda clavado en **4** y `reset` en **60**. Como el valor es `limit - totalHits`, un `remaining` de 4 significa `totalHits = 1`: **cada petición estrena su propio contador**. La guarda se ejecuta, cuenta, y escribe en una clave distinta cada vez.

Hipótesis descartadas:

- **Varias réplicas con almacenamiento en memoria separado.** Descartada: el manifiesto del despliegue declara `numReplicas = 1` en `us-west2`.
- **Código desplegado sin los decoradores.** Descartada: `git show 410db2f:apps/api/src/auth/auth.controller.ts` contiene los tres `@Throttle`, y el diff contra `7033683` es vacío. Además la cabecera `x-ratelimit-limit: 5` prueba que el decorador está activo.

Causa identificada: `ThrottlerGuard.getTracker()` devuelve `req.ip` (`throttler.guard.js:141-142`), y la clave se deriva de ese valor. Express solo resuelve `req.ip` desde `X-Forwarded-For` si `trust proxy` está habilitado. **Verificado: `trust proxy` no se configura en ningún punto de `apps/api/src`** — `main.ts` no contiene `app.set('trust proxy', ...)`. Detrás del proxy de Railway, `req.ip` toma la dirección de origen de la conexión interna, que varía entre peticiones. Resultado: una clave distinta por petición y un límite que nunca se alcanza.

**Esto queda fuera del alcance que Luis pidió y no se ha tocado.** Se registra aquí porque (a) es material —`/auth/login` no tiene protección efectiva contra fuerza bruta, ni la tiene ninguna otra ruta—, (b) apareció como resultado directo del control solicitado, y (c) cambia la lectura del hallazgo original: `/api/docs-yaml` no es *la excepción* a un throttler que funciona; es una ruta sin guarda dentro de un sistema cuyo throttler tampoco está limitando el resto. Merece su propia decisión, aparte de este anexo.

### C — Resumen de la evidencia

| Afirmación | Estado | Prueba |
|---|---|---|
| `/api/docs-yaml` no pasa por el `ThrottlerGuard` | **Confirmado** | Ausencia total de cabeceras `X-RateLimit-*` (C.8-bis) |
| 10 peticiones a `/api/docs-yaml` sin 429 | Confirmado, **no concluyente por sí solo** | `limit=30` > 10 (C.8) |
| El throttler protege el resto de rutas | **Refutado** | `remaining` fijo en 4 en `/auth/login` (C.9-bis) |

### Carga generada

~18 peticiones a los endpoints de docs y ~23 `POST` a `/auth/login` con credenciales deliberadamente inválidas contra una cuenta inexistente (`@example.invalid`). No hay lógica de bloqueo de cuenta en el código, y ninguna cuenta real fue objetivo. Las 10 peticiones extra a `/auth/login` fueron necesarias porque la primera tanda nunca alcanzó la capa medida.

---

## D — Fix propuesto (NO aplicado)

### D.11 — Comparación de las tres opciones

| Opción | Cierra `/api/docs-json` y `swagger-ui-init.js` | Default seguro | Acoplamiento | Veredicto |
|---|---|---|---|---|
| **1. `SWAGGER_ENABLED` dedicada, default off** | Sí | Sí (ausente ⇒ desactivado) | Ninguno | **Recomendada** |
| **2. Derivar de `NODE_ENV`** | Sí | Sí | Alto | Viable, peor |
| **3. Dejar `/api/docs`, proteger solo `/api/docs-yaml`** | **No** | — | — | **Descartada** |

**Opción 3 — descartada por ineficaz.** Es la que el enunciado plantea como posible compromiso, y la medición de B.7-bis la invalida: el spec completo viaja incrustado en `/api/docs/swagger-ui-init.js` (75 480 bytes) y además está en `/api/docs-json`. Proteger únicamente `/api/docs-yaml` deja dos rutas abiertas que publican exactamente lo mismo. Cerraría el vector citado en el diagnóstico previo sin reducir la superficie real.

**Opción 2 — técnicamente viable, pero peor.** `NODE_ENV=production` está correctamente fijado en Railway (A.3), así que `if (process.env.NODE_ENV !== 'production')` funcionaría hoy. Se descarta por dos motivos concretos:

- Acopla la visibilidad de la documentación a una variable que gobierna muchas otras cosas (verbosidad de errores de Nest, caché de vistas de Express, comportamiento de librerías de terceros). Para ver la doc en producción habría que poner `NODE_ENV=development` en producción, lo que es inaceptable.
- Deja de existir cualquier vía de acceso legítima a la doc en el entorno desplegado: la respuesta pasa a ser siempre "no, salvo que degrades el entorno".

**Opción 1 — recomendada.** Una variable dedicada, con la comprobación en positivo (`=== 'true'`), de modo que **ausente, vacía o con cualquier otro valor significa desactivado**. Ventajas: un solo propósito, el default es el seguro, no depende de que `NODE_ENV` esté bien puesto, y permite habilitar la doc puntualmente sin tocar nada más. Cierra las cuatro rutas de golpe, porque envuelve `SwaggerModule.setup()` entero.

### D.11-bis — Qué hacer en Railway para no perder el acceso a la doc

**No hay que hacer nada en Railway al aplicar el fix.** `SWAGGER_ENABLED` no existe hoy en el servicio `novotechflow`; al desplegar el cambio, `process.env.SWAGGER_ENABLED` será `undefined`, la condición dará `false` y las cuatro rutas dejarán de registrarse. Ese es el estado deseado en producción.

Para consultar la documentación cuando haga falta, en orden de preferencia:

1. **En local (recomendado).** Añadir `SWAGGER_ENABLED=true` a `apps/api/.env` y levantar el API. La doc describe la *forma* de la API, que es idéntica en local y en producción — no hace falta el entorno desplegado para leerla. Sin ventana de exposición.
2. **Generar el spec como artefacto.** Un script que llame a `SwaggerModule.createDocument()` y escriba el YAML a fichero, sin servirlo. Útil si se quiere versionar la doc.
3. **Activarlo temporalmente en producción**, solo si hay una razón concreta. Poner `SWAGGER_ENABLED=true` en el servicio `novotechflow` y **quitarla al terminar**. Dos advertencias: (a) cambiar una variable en Railway **provoca un redespliegue**, así que son dos reinicios del servicio, uno al activar y otro al desactivar; (b) mientras esté activa, la doc está abierta a internet igual que hoy, porque el fix no añade autenticación — solo un interruptor.

Si en el futuro se quisiera doc permanentemente accesible en producción pero no pública, la vía sería montarla detrás de un guard de Nest o de basic-auth a nivel de middleware; eso es un cambio mayor y no se propone aquí.

Complemento sugerido: documentar la variable en [apps/api/.env.example](apps/api/.env.example), que hoy no la menciona (A.2). Es un segundo fichero, fuera del diff mínimo, y queda a criterio de Luis.

### D.12 — Diff propuesto

**No aplicado.** `apps/api/src/main.ts` permanece intacto en `7033683`.

```diff
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -63,15 +63,19 @@ async function bootstrap() {
   // Serve uploaded images as static files
   app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });
 
-  // Swagger / OpenAPI
-  const swaggerConfig = new DocumentBuilder()
-    .setTitle('NovoTechFlow API')
-    .setDescription('API de cotizaciones comerciales para NOVOTECHNO')
-    .setVersion('1.0')
-    .addBearerAuth()
-    .build();
-  const document = SwaggerModule.createDocument(app, swaggerConfig);
-  SwaggerModule.setup('api/docs', app, document);
+  // Swagger / OpenAPI — desactivado salvo opt-in explícito.
+  // setup() registra 4 rutas mediante httpAdapter.get(), fuera del router de
+  // Nest: /api/docs, /api/docs-json, /api/docs-yaml y
+  // /api/docs/swagger-ui-init.js (este último lleva el spec incrustado).
+  if (process.env.SWAGGER_ENABLED === 'true') {
+    const swaggerConfig = new DocumentBuilder()
+      .setTitle('NovoTechFlow API')
+      .setDescription('API de cotizaciones comerciales para NOVOTECHNO')
+      .setVersion('1.0')
+      .addBearerAuth()
+      .build();
+    const document = SwaggerModule.createDocument(app, swaggerConfig);
+    SwaggerModule.setup('api/docs', app, document);
+  }
 
   await app.listen(process.env.PORT ?? 3000);
 }
```

Notas sobre el diff:

- Los `import` de [main.ts:2](apps/api/src/main.ts:2) (`SwaggerModule`, `DocumentBuilder`) **se conservan**. Quitarlos no aporta: `@nestjs/swagger` seguiría en el proceso de todos modos, porque los decoradores `ApiTags` / `ApiProperty` de los 18 controladores y DTO lo importan igualmente.
- La comparación es contra el literal `'true'`, no `Boolean(process.env.SWAGGER_ENABLED)`, para que `SWAGGER_ENABLED=false` desactive en lugar de activar (toda variable de entorno es una cadena, y `Boolean('false')` es `true`).
- El cambio es puramente aditivo en el arranque: si la variable no está, el proceso se salta el bloque y llama a `listen()` igual que hoy.

### Verificación posterior al despliegue del fix

Cuando Luis apruebe y aplique el cambio, la comprobación es la misma medición de B.5. Esperado: **404** en las cuatro rutas.

```bash
for p in /api/docs /api/docs-yaml /api/docs-json /api/docs/swagger-ui-init.js; do curl.exe -s -o NUL -w "$p -> %{http_code}\n" "https://novotechflow-production.up.railway.app$p"; done
```

---

## Preguntas abiertas de este anexo

9. **El `ThrottlerGuard` no limita nada en producción (C.9-bis).** Diagnosticado hasta la causa (`req.ip` variable por falta de `trust proxy`), pero **no verificado desde dentro del contenedor**: no se inspeccionó el valor real de `req.ip` ni la cabecera `X-Forwarded-For` que inyecta Railway, porque eso exige desplegar código instrumentado. La conclusión se apoya en evidencia externa (el `remaining` clavado en 4) y en la ausencia de `trust proxy` en el código. Requiere decisión aparte; es independiente de la exposición de Swagger.

10. **Otras rutas registradas fuera del router de Nest.** Solo se auditó Swagger. `app.useStaticAssets(uploadsPath, { prefix: '/uploads/' })` ([main.ts:64](apps/api/src/main.ts:64)) también monta un servidor de ficheros por debajo del router, y no se midió qué expone ni si el `ThrottlerGuard` lo cubre (previsiblemente no, por el mismo mecanismo).

11. **Ventana de exposición histórica.** No se determinó desde qué fecha `/api/docs*` es accesible públicamente ni si hubo accesos de terceros. Los logs de Railway no se consultaron en esta auditoría.

---

# Anexo: throttler inoperante y trust proxy

**Fecha:** 2026-07-24 · **Rama:** `chore/audit-deps-y-bundle` @ `0bdbfb7` · **Alcance:** solo diagnóstico; ningún fichero de código modificado.

Este anexo cierra la pregunta abierta n.º 9 del anexo de Swagger: el `ThrottlerGuard` se ejecuta pero no limita nada en producción (`x-ratelimit-remaining` clavado en 4 en `/auth/login`). Aquí se delimita el alcance real, se aporta la evidencia empírica que faltaba, se decide el valor correcto de `trust proxy` con su análisis de spoofing, y se deja el diff propuesto sin aplicar.

## A — Alcance real del problema

### A.1 — Configuración completa del ThrottlerModule

[app.module.ts:35](apps/api/src/app.module.ts:35):

```ts
ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
```

- **ttl:** 60 000 ms. **limit:** 30. Throttler `default` (forma de array sin nombre).
- **storage:** no se pasa la opción `storage` → almacenamiento **en memoria del proceso** (`ThrottlerStorageService` por defecto). Coherente con `numReplicas = 1`; si algún día se escala a más réplicas, cada una contará por separado.
- **Guarda global:** [app.module.ts:38](apps/api/src/app.module.ts:38) — `{ provide: APP_GUARD, useClass: ThrottlerGuard }`. Cubre todas las rutas del router de Nest (no las registradas con `httpAdapter.get()`, como se demostró en el anexo de Swagger).
- Versión instalada: `@nestjs/throttler@6.5.0`.

Mapa completo de qué cree tener límite cada ruta (`apps/api/src`, exhaustivo):

| Ruta / grupo | Límite que cree tener | Origen |
|---|---|---|
| `POST /auth/login` | 5 / 60 s | [auth.controller.ts:20](apps/api/src/auth/auth.controller.ts:20) |
| `POST /auth/verify-code` | 5 / 60 s | [auth.controller.ts:34](apps/api/src/auth/auth.controller.ts:34) |
| `POST /auth/resend-code` | 3 / 60 s | [auth.controller.ts:41](apps/api/src/auth/auth.controller.ts:41) |
| `GET /app-settings/maintenance-banner` | exento | `@SkipThrottle()` [app-settings.controller.ts:58](apps/api/src/app-settings/app-settings.controller.ts:58) |
| `GET /app-settings/price-thresholds` | exento | `@SkipThrottle()` [app-settings.controller.ts:105](apps/api/src/app-settings/app-settings.controller.ts:105) |
| `POST /presence/heartbeat` | exento | `@SkipThrottle()` [presence.controller.ts:29](apps/api/src/presence/presence.controller.ts:29) |
| `GET /presence/active` | exento | `@SkipThrottle()` [presence.controller.ts:37](apps/api/src/presence/presence.controller.ts:37) |
| Ruta de `proposals` marcada | exenta | `@SkipThrottle()` [proposals.controller.ts:81](apps/api/src/proposals/proposals.controller.ts:81) |
| Todo lo demás en el router de Nest | 30 / 60 s | global de `forRoot` |
| `/api/docs*`, `/uploads/*` | **sin guarda** | fuera del router (anexo de Swagger) |

En producción, hoy, la columna "límite que cree tener" es ficción para todas las filas: ninguna ruta limita de facto (ver C del anexo previo y B.3 abajo).

### A.2 — Todos los usos de la IP en `apps/api/src`

Barrido de `req.ip`, `.ip`, `.ips`, `x-forwarded-for`, `x-real-ip`, `remoteAddress`, `getTracker`, más `@Ip()`, middleware, gateways WebSocket e interceptores:

**Resultado: cero usos en código propio.** El único consumidor de la IP del cliente en todo el API es el `getTracker()` heredado del paquete (`node_modules`, `@nestjs/throttler@6.5.0`, `throttler.guard.js:141-142`):

```js
async getTracker(req) {
    return req.ip;
}
```

Comprobado además:

- No hay logs de auditoría ni registro de sesiones por IP. `schema.prisma` no tiene ningún campo de IP (grep de `ip|ipAddress|userAgent|audit`: sin resultados).
- Los `@Req()` de los controladores (`app-settings`, `presence`, `users`, `templates`, `suppliers`) solo leen `req.user` (los `interface AuthenticatedRequest` locales declaran únicamente `user`).
- `presence` registra `last_seen_at` por id de usuario, no por IP.
- No hay `@WebSocketGateway`, ni `NestMiddleware`/`MiddlewareConsumer`, ni `createParamDecorator`, ni `@Ip()` en ninguna parte.

Consecuencia: el daño de la IP basura está hoy **acotado al throttler**. No hay logs de auditoría contaminados que limpiar. Pero también significa que cualquier consumidor futuro de `req.ip` nacería roto si no se arregla la causa.

### A.3 — Confirmación: `trust proxy` no se configura en ningún punto

- [main.ts:15](apps/api/src/main.ts:15): `NestFactory.create<NestExpressApplication>(AppModule)` **sin objeto de opciones**; ninguna llamada a `app.set(...)` en todo el bootstrap.
- Grep de `trust proxy` / `trustProxy` en todo el repo (excluyendo `node_modules`): las únicas apariciones son las menciones en este mismo documento.
- Arranque en producción: `Dockerfile` del API, `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]` — no hay ningún otro punto de configuración de Express.
- Default de Express 5.2.1 (el que resuelve el runtime, vía `@nestjs/platform-express@11`): `this.set('trust proxy', false)` (`application.js:99`). Con `false`, el getter de `req.ip` (`request.js:327-330`) ignora `X-Forwarded-For` por completo y devuelve la dirección del socket.

## B — La cadena de proxies de Railway

### B.1 — Documentación oficial

De `docs.railway.com/networking/edge-networking` y `docs.railway.com/networking/public-networking/specs-and-limits` (consultadas hoy):

- Topología documentada: `Usuario → Edge POP (anycast, termina TLS) → enrutado interno → región de despliegue → servicio`. El edge proxy "termina TLS, añade cabeceras y reenvía al despliegue". **La documentación no publica un número fijo de saltos** entre el edge y el contenedor.
- Cabeceras de petición **oficialmente documentadas** que inyecta Railway:
  - **`X-Real-IP` — "for identifying client's remote IP"** (la cabecera oficial para la IP del cliente).
  - `X-Forwarded-Proto` — siempre `https`.
  - `X-Forwarded-Host` — host original.
  - `X-Railway-Edge` (POP), `X-Request-Start`, `X-Railway-Request-Id`, `X-Railway-Debug`/`X-Railway-Upstream-Zone`.
- **`X-Forwarded-For` no aparece en la lista oficial.** Su comportamiento en Railway solo está descrito en el foro (Central Station), y con contradicciones entre empleados: uno afirma "we do strip X-Forwarded-For at our edge and ensure clients cannot overwrite it" y que puede verse "another hop as the request is forwarded through our network" (phin, staff); otro, "use X-Forwarded-For and take the first IP […] our edge proxy appends to the chain" (sam-a, staff). *Strip* y *append* son incompatibles; se declara la contradicción y no se resuelve desde aquí — el fix elegido en C no depende de cuál sea cierta.
- El mismo hilo del foro reporta que `X-Real-IP` tuvo un bug cuando la ruta CDN de Railway está activa (staff: se corregirá para que "always reflect the true client IP regardless of routing path"). Estado actual no verificable desde este entorno.

### B.2 — Evidencia empírica: los logs del despliegue no imprimen IP

`railway logs --deployment -n 200 --service novotechflow` (ejecutado hoy): las 200 líneas son exclusivamente `prisma:query …`. Ni Nest ni ningún middleware loguea la IP de origen — coherente con A.2 (no existe ese código). **Por esta vía el dato no se puede obtener, y no se inventa.**

### B.3 — Evidencia empírica alternativa (sin desplegar código): los logs HTTP del edge

Lo que sí existe es la capa de **logs HTTP** de Railway, que registra `srcIp` — "the client's IP address that made the request" según `docs.railway.com/observability/logs` — visto **desde el edge**, antes de la red interna. Comando:

```bash
railway logs --http --json -n 500 --service novotechflow --since 7d --filter "@path:/auth/login"
```

Resultado (hoy, 43 filas): las tres tandas de sondas del anexo anterior están ahí, y **todas las peticiones de cada tanda salen con el mismo `srcIp`**:

| Tanda (UTC) | Peticiones | `srcIp` | `edgeRegion` |
|---|---|---|---|
| 19:59:31–19:59:36 (10 × `400`, C.9 primer intento) | 10 | `181.71.137.142` (constante) | `us-west2` |
| 20:00:05–20:00:09 (10 × `401`, C.9 segundo intento) | 10 | `181.71.137.142` (constante) | `us-west2` |
| 20:01:42–20:01:43 (3 × `401`, C.9-bis) | 3 | `181.71.137.142` (constante) | `us-west2` |

Esto cierra el razonamiento con evidencia directa, sin depender ya del `x-ratelimit-remaining`:

1. El edge de Railway vio **una sola IP de cliente, constante**, en las 23 peticiones.
2. La app, sin embargo, abrió **un contador nuevo por petición** (`remaining` clavado en 4 ⇒ `totalHits = 1` cada vez).
3. Con `trust proxy = false`, `req.ip` = dirección del socket = el extremo interno de Railway que conecta con el contenedor. Ergo **esa dirección interna es lo que varía por petición**; la variación no viene del cliente.

Lo único que sigue sin poderse observar desde este entorno es el **valor literal** de `req.ip` y de `X-Forwarded-For`/`X-Real-IP` dentro del contenedor (exigiría desplegar instrumentación o abrir un shell en el contenedor, que Railway no ofrece). Se declara como no medido. Nota: los logs HTTP también registran `upstreamAddress` — p. ej. `http://[fd12:…]:3000` — pero esa es la dirección **del contenedor** (destino), no la del extremo que origina la conexión interna.

## C — El valor correcto de `trust proxy` y sus riesgos

### C.1 — Mecánica exacta (verificada sobre los paquetes instalados)

`req.ip` en Express 5.2.1 delega en `proxy-addr@2.0.7` + `forwarded@0.2.0`: se construye la lista `[socket, XFF de derecha a izquierda]` y se recorre mientras cada dirección sea de confianza; `req.ip` es el último elemento de la cadena truncada — la primera dirección **no** confiable cuando existe, o el último elemento sin testear si todo resultó confiable (con `1` y sin cabecera XFF: el propio socket). Con `trust proxy = N` (entero), la función de confianza es `(addr, i) => i < N` (`utils.js:202-205`): **posicional, no inspecciona el valor** — confía en la dirección del socket y en las `N - 1` entradas más a la derecha de la cabecera, sean cuales sean.

Los cinco casos relevantes se trazaron a mano sobre el código instalado (verificación adversarial, 3 agentes independientes, veredicto CONFIRMED en los tres): con `1`, una XFF forjada por el cliente queda siempre a la izquierda del punto de truncado y se descarta, tanto si el edge stripea como si appendea; con `true` y edge que appendea, `req.ip` es la entrada más a la izquierda — la del atacante.

### C.2 — Comparación de opciones (análisis de spoofing)

El escenario de ataque: un cliente externo envía `X-Forwarded-For: <valor falso>` (o `X-Real-IP` falso) intentando que cada petición parezca venir de una IP distinta y así evadir el límite — exactamente el comportamiento accidental de hoy, pero deliberado.

| Opción | `req.ip` resultante | ¿Spoofeable desde fuera? | Veredicto |
|---|---|---|---|
| `true` | entrada **más a la izquierda** de XFF | **Depende de si el edge hace strip o append.** Si Railway *stripea* la XFF entrante (afirmación de un empleado), no. Si *appendea* (afirmación del otro), la entrada más a la izquierda es la que puso el atacante → **evasión total, igual que hoy pero controlada por el atacante**. | **Rechazada.** Su seguridad descansa por completo en un comportamiento no documentado y sobre el que el propio staff se contradice. |
| **`1` (entero)** | dirección más a la derecha de XFF (la única entrada que el edge controla) | **No, bajo cualquiera de los dos comportamientos.** Si el edge stripea: XFF = `cliente` → `req.ip` = cliente. Si el edge appendea: XFF = `falso…, cliente` → el recorrido se detiene en la entrada más a la derecha (índice 1, ya no confiable) → `req.ip` = cliente; lo falso queda a la izquierda, ignorado. | **Elegida.** Ver análisis de fallo abajo. |
| Función / lista de IPs de confianza | como `1`, pero confiando solo en rangos concretos | No (mismo mecanismo que `1`) | **Rechazada por inviable hoy:** Railway no documenta los rangos internos de su edge (el foro menciona `100.0.0.0/8`, sin respaldo oficial). Un rango adivinado se rompe en silencio cuando Railway cambie su infraestructura, y el modo de fallo es volver al estado actual (socket = basura). Reconsiderar solo si algún día Railway publica los rangos. |
| `getTracker()` custom sin `trust proxy` | n/a (el throttler dejaría de usar `req.ip`) | Con `X-Real-IP`: no spoofeable **si** el edge sobreescribe la cabecera entrante (implícito en que la documenten como "the client's remote IP", pero no verificable desde aquí; además el foro reporta un bug con la ruta CDN). Con "XFF más a la derecha": idéntico a `trust proxy = 1`. | **Alternativa válida pero peor como primera opción:** más código (subclase de guarda + provider), y arregla solo el throttler dejando `req.ip` roto para cualquier consumidor futuro. Queda como plan B (ver C.4). |

### C.3 — Modos de fallo de `trust proxy = 1` (el caso decidido)

- **Si hay exactamente 1 salto proxy** (la topología documentada: el edge): correcto en todos los casos.
- **Si Railway interpone un segundo salto interno** (el "you may see another hop" del staff): con `1`, `req.ip` sería la IP del salto intermedio — pocas IPs internas para todos los clientes → **sobre-limitación** (429 a usuarios legítimos). Es un fallo *cerrado*: visible de inmediato en las cabeceras `x-ratelimit-*` y en 429 inesperados, y corregible subiendo a `2`. Nunca reabre la evasión.
- **Si Railway no enviara `X-Forwarded-For` en absoluto** (no está en la lista oficial de cabeceras): `req.ip` vuelve a ser la dirección del socket — exactamente el statu quo, ni mejor ni peor. También fallo visible con la misma prueba.
- **Si alguien alcanza el socket de la app sin pasar por el edge** (red privada de Railway u otro servicio del mismo proyecto): la confianza es posicional, así que ese peer sería "confiable" y su XFF forjada decidiría `req.ip`. En esta topología solo los propios servicios del proyecto están en esa red; riesgo aceptado y documentado.
- **Si algún día se pone un CDN delante** (p. ej. Cloudflare): habría 2 saltos y `1` devolvería la IP del CDN → sobre-limitación global. En ese momento habrá que reevaluar (no subir el entero a ciegas: cada salto de más que se confía es una posición de XFF que pasa a poder escribir el cliente).

La asimetría decide: los modos de fallo de `1` son sobre-limitar o quedarse igual; el modo de fallo de `true` es entregarle la evasión al atacante. Por eso `1`, aunque `true` "funcionaría" igual de bien en el camino feliz.

### C.4 — ¿Cabecera propia de Railway más fiable que XFF?

Sí existe: **`X-Real-IP` es la cabecera oficialmente documentada** para la IP del cliente (specs-and-limits), mientras que XFF ni siquiera aparece en la documentación. A su favor: es inmune al número de saltos internos. En contra: el bug reportado con la ruta CDN (B.1) y que consumirla exige el `getTracker()` custom (no pasa por `req.ip`). Decisión: empezar por `trust proxy = 1`; si la verificación en producción (D.2) muestra el problema del segundo salto, migrar el throttler a `X-Real-IP` con un guard custom en vez de subir el entero a ciegas.

### C.5 — Efectos colaterales de `trust proxy = 1` en esta app

`trust proxy` afecta en Express 5 a `req.ip`, `req.ips`, `req.protocol`, `req.secure`, `req.hostname`/`req.host` y `req.subdomains`. Barrido de consumidores en este API:

- **Código propio:** cero usos de `req.protocol`, `req.hostname`, `req.secure`, `res.redirect` o `@Redirect` en `apps/api/src`. No se emite ninguna cookie de servidor (no hay `res.cookie`, ni `cookie-parser`, ni `express-session`; la autenticación es JWT por cabecera `Authorization`). Las únicas menciones a cookies son de *cliente saliente* hacia Lenovo PSREF.
- **CORS** ([main.ts:34](apps/api/src/main.ts:34)): el paquete `cors@2.8.6` compara exclusivamente `req.headers.origin` contra `CORS_ORIGIN` (`lib/index.js:37,219`); no consulta `req.protocol` ni `req.hostname`. Sin efecto.
- **helmet 8.1.0** ([main.ts:22](apps/api/src/main.ts:22)): el `index.cjs` compilado no contiene ninguna lectura de propiedades de `req`; todas las cabeceras (CSP, HSTS) son estáticas. Sin efecto.
- **compression 1.8.1, body parsers (body-parser 2.3.0), ValidationPipe, serve-static 2.2.1 (`/uploads`)**: verificados sobre el código instalado — ninguno consulta esos getters; el único redirect de serve-static (directorio → barra final) construye la `Location` solo con el path, sin protocolo ni host. Sin efecto.
- **Swagger** (`@nestjs/swagger@11.4.4`): desactivado por defecto tras `0bdbfb7` (`SWAGGER_ENABLED`); además su dist no usa `req.protocol`/`req.hostname` (URLs relativas). Sin efecto.
- En general, `response.js` de Express 5 nunca consulta `trust proxy`: ningún mecanismo de respuesta (redirects incluidos) cambia por sí solo.
- **Efecto real n.º 1 y único:** el `getTracker()` del throttler pasa a recibir la IP real del cliente. Colateral cosmético: `req.protocol` pasaría de `http` (mentira actual, la TLS termina en el edge) a `https` vía `X-Forwarded-Proto` — hoy nadie lo lee, pero deja de estar mal para el futuro.

Superficie de efectos colaterales: **en la práctica, cero**. Este es el argumento que inclina la balanza frente al `getTracker()` custom: mismo beneficio, una línea, y sin dejar `req.ip` roto.

## D — Fix propuesto (NO aplicado) y plan de verificación

### D.1 — Diff propuesto

En [main.ts](apps/api/src/main.ts), inmediatamente después de crear la app (la llamada `app.set()` está expuesta por `NestExpressApplication` precisamente para esto — es el ejemplo literal de la documentación del tipo):

```diff
 async function bootstrap() {
   const app = await NestFactory.create<NestExpressApplication>(AppModule);

+  // Railway termina TLS en su edge proxy y reenvia por su red interna;
+  // sin esto req.ip es la direccion interna (variable por peticion) y el
+  // ThrottlerGuard abre un contador nuevo en cada request. Confiar en
+  // exactamente 1 salto: req.ip = entrada mas a la derecha de
+  // X-Forwarded-For, la unica que el edge controla (no spoofeable).
+  app.set('trust proxy', 1);
+
   app.use(compression());
```

Sin cambios en `app.module.ts`, sin variables de entorno nuevas, sin cambios en Railway.

### D.2 — Plan de verificación

**Local, antes del push (no regresión):**

1. `pnpm --filter api exec tsc --noEmit` — comparar A/B contra `HEAD`: los ~29 errores preexistentes de `*.spec.ts` no cuentan; el gate es que no aparezca ninguno nuevo.
2. Build + arranque local (recordatorio: entrypoint `dist/src/main.js` y `NODE_PATH` para `express`, que no es dependencia directa). Gate: el API arranca y responde.
3. Throttle funcional en local — 6 peticiones directas (sin proxy delante, `req.ip` = `127.0.0.1` constante):

   ```bash
   for i in 1 2 3 4 5 6; do curl.exe -s -o NUL -w "req $i -> %{http_code} remaining=%{header{x-ratelimit-remaining}}\n" -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" --data-binary "@login.json"; done
   ```

   (`login.json` con credenciales inválidas, en fichero por la lección del C.9: el escapado inline de PowerShell corrompe el JSON.) Esperado: `401` con `remaining` 4→0 en las 5 primeras y **`429` en la 6.ª**. Esto ya valida la mecánica del throttler y que `trust proxy = 1` no rompe conexiones directas.
4. Selección de la entrada correcta de XFF, simulando el edge en local: `curl.exe -X POST http://localhost:3000/auth/login -H "X-Forwarded-For: 6.6.6.6, 203.0.113.7" …` 6 veces. Con `trust proxy = 1` el tracker debe ser `203.0.113.7` (la de la derecha): la 6.ª da `429` aunque se varíe `6.6.6.6` en cada petición. Si se varía la de la *derecha*, cada petición estrena contador — correcto, porque en producción esa posición solo la escribe el edge.
5. Humo del resto: `GET /uploads/...` estático, un preflight CORS (`OPTIONS` con `Origin`), y un endpoint autenticado cualquiera.

**Producción, después del push (acotado — es la producción propia):**

6. La prueba mínima que puede dar el veredicto son **6 peticiones** (limit 5 + 1) dentro de una ventana de 60 s contra `/auth/login` con credenciales inválidas desde una única máquina:

   ```bash
   for i in 1 2 3 4 5 6; do curl.exe -s -o NUL -w "req $i -> %{http_code} remaining=%{header{x-ratelimit-remaining}}\n" -X POST https://novotechflow-production.up.railway.app/auth/login -H "Content-Type: application/json" --data-binary "@login.json"; done
   ```

   - **Éxito:** `remaining` desciende 4→0 y la 6.ª responde `429`. (Hoy: clavado en 4, nunca 429.)
   - **Sobre-limitación (segundo salto interno, C.3):** si aparecieran `429` antes de la 6.ª o con `remaining` compartido con otras fuentes, activar el plan B de C.4.
   - Acotación: son 6 peticiones una sola vez, y la IP de la máquina de Luis queda bloqueada para `/auth/login` **como máximo 60 s** tras la prueba. Hacerla fuera de una sesión de trabajo activa de los usuarios y no repetirla en bucle.
7. Contraste con el edge, sin generar carga adicional:

   ```bash
   railway logs --http --json -n 20 --service novotechflow --filter "@path:/auth/login"
   ```

   El `srcIp` de las 6 peticiones debe ser la IP pública de la máquina que probó — el mismo valor que ahora debería estar usando el throttler como clave.

## Datos no obtenibles desde este entorno (declarados, no inferidos)

1. El **valor literal** de `req.ip` y de `X-Forwarded-For` / `X-Real-IP` dentro del contenedor en producción (exige instrumentación desplegada; Railway no da shell al contenedor).
2. Si el edge de Railway **stripea o appendea** una `X-Forwarded-For` enviada por el cliente (docs silentes, staff contradictorio). El fix elegido es seguro bajo ambas hipótesis, que es precisamente por qué se eligió.
3. El **número exacto de saltos** de la red interna de Railway y sus rangos de IP (no documentados). Cubierto por el modo de fallo cerrado de C.3 y el plan B de C.4.
4. El estado actual del **bug de `X-Real-IP` con la ruta CDN** reportado en el foro (sin fecha de resolución publicada).
