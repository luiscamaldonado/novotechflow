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
