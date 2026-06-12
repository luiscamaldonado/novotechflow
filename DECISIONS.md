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
**Fix aplicado (abril 2026):** Se reemplazaron caracteres no-ASCII en strings de JS
por Unicode escapes (`\u00b5` para µ, `\u00f3` para ó, etc.) en 16 archivos.
Solución encoding-agnóstica. Se agregó `.gitattributes` (fuerza UTF-8+LF) y
`ENV LANG=C.UTF-8` en ambos Dockerfiles. En texto JSX se usan caracteres reales
(los archivos ya son UTF-8). Se limpió la tabla `pdf_templates` en Railway para
re-seedear con datos correctos.

---

## ADR-011: Validación de uploads — defensa en profundidad (abril 2026)

**Fecha:** Abril 2026 (Sesión de ciberseguridad)
**Estado:** Vigente

**Problema:** Los endpoints de upload de archivos (CSV e imágenes) solo validaban
el MIME type del header HTTP, que es trivial de falsificar. Un atacante podía subir
un ejecutable renombrado a .csv o .png.

**Decisión:** Implementar validación en 3 capas:
- **Capa 1 (Frontend):** `accept` en inputs + magic bytes client-side + validación
  de estructura CSV (delimitadores) en `lib/file-validation.ts`
- **Capa 2 (Multer):** `fileFilter` + `limits.fileSize` en cada endpoint
- **Capa 3 (Backend):** Magic bytes manuales en `common/upload-validation.ts` +
  validación estructural CSV + rechazo de CSV injection

**Decisión sobre file-type:** Se eliminó la dependencia `file-type@19` porque es
ESM-only e incompatible con NestJS CommonJS en producción (Railway). Se implementó
`detectMimeFromMagicBytes()` inline que detecta 8 formatos binarios (JPEG, PNG, GIF,
WebP, PDF, ZIP, EXE, ELF) sin dependencias externas.

**Decisión sobre CSV injection:** Se rechaza en lugar de sanitizar. La función
`validateCsvCellValue()` lanza `BadRequestException` si detecta patrones peligrosos
(`=`, `@`, `+CMD`, `|`, `!`, `%`). Los CSV de este proyecto solo contienen texto
plano — fórmulas son siempre maliciosas.

**Límites de tamaño:** CSV: 401KB, Imágenes: 2MB. Los archivos maliciosos más
peligrosos pesan desde 20 bytes — el límite es defensa contra DoS, no contra malware.

**Bug importante:** El flujo real del frontend es: PapaParse parsea localmente →
envía a `/bulk` como JSON. La validación de `/import-csv` no se ejecutaba. Fix:
aplicar `validateCsvCellValue` en `bulkCreate()` de los services, no solo en los
controllers de import.

---

## ADR-012: Cierre de sesión por inactividad (abril 2026)

**Fecha:** Abril 2026 (Sesión de ciberseguridad)
**Estado:** Vigente

**Decisión:** Auto-logout a los 5 minutos de inactividad con modal de advertencia
a los 4 minutos (cuenta regresiva de 60 segundos).

**Implementación:** Hook `useInactivityTimeout` en `hooks/useInactivityTimeout.ts`
monitorea 7 eventos de actividad (mousedown, mousemove, keydown, scroll, touchstart,
click, wheel). Throttled a 1 segundo para evitar churn. Modal en
`components/InactivityWarningModal.tsx`. Integrado en `AppLayout.tsx`.

**Solo activo cuando hay token** — si el usuario no está logueado, los timers no corren.

---

## ADR-013: Autenticación de doble factor — 2FA por email (abril 2026)

**Fecha:** Abril 2026 (Sesión de ciberseguridad)
**Estado:** Vigente

**Decisión:** Implementar 2FA como paso obligatorio en el login. El JWT solo se
emite después de verificar un código de 6 dígitos enviado por email.

**Flujo:**
1. `POST /auth/login` → valida credenciales → envía código → retorna
   `{ requiresVerification: true, userId, email }`
2. `POST /auth/verify-code` → valida código → retorna `{ access_token, user }`
3. `POST /auth/resend-code` → reenvía código (máx 3 en 15 min)

**Seguridad del código:**
- Hasheado con SHA-256 antes de almacenar (nunca en texto plano)
- Expira en 5 minutos
- Máximo 3 intentos por código (después se invalida)
- Máximo 3 códigos en 15 minutos (anti-spam)
- Código anterior se invalida al generar uno nuevo
- Rate limiting: 5 req/min en verify-code, 3 req/min en resend-code

**Servicio de email:** Resend (resend.com). Tier gratuito: 100 emails/día.
Con `onboarding@resend.dev` solo envía al correo del owner de la cuenta Resend.
Para enviar a cualquier correo → verificar dominio `novotechno.com` en Resend
(registros DNS).

**Decisión futura:** Migrar de email OTP a Windows Authenticator (TOTP) cuando
la empresa lo requiera. El modelo `VerificationCode` se puede reutilizar o
reemplazar con un campo `totpSecret` en el modelo `User`.

**Tabla:** `verification_codes` con índices en `user_id` y `expires_at`.
`onDelete: Cascade` desde `User`.

---

## ADR-014: Persistencia de uploads en Railway — base64 en PostgreSQL (abril 2026)

**Fecha:** Abril 2026 (Sesión de deploy Railway)
**Estado:** Vigente

**Problema:** Railway usa filesystem efímero — todos los archivos creados en runtime
se pierden con cada redeploy. Las firmas de comerciales (`uploads/signatures/`),
imágenes de bloques del documento (`uploads/`) e imágenes de plantillas
(`uploads/templates/`) desaparecían después de cada push a GitHub.

**Problema adicional:** Tres errores de configuración impedían que incluso los
archivos por defecto llegaran a producción:
1. `.gitignore` tenía `uploads/` → los defaults nunca se subían a GitHub
2. `.dockerignore` tenía `uploads/` → Docker los ignoraba en el build
3. El Dockerfile hacía `RUN mkdir -p uploads/...` sin copiar archivos → directorios vacíos
4. `.gitignore` tenía `*.sql` → las migraciones de Prisma no llegaban a Railway

**Decisión — archivos estáticos (portada):**
- `.gitignore` cambiado de `uploads/` a `uploads/*` + `!uploads/defaults/`
- `.dockerignore` ya no excluye `uploads/`
- Dockerfile agrega `COPY --from=builder /app/apps/api/uploads/defaults ./uploads/defaults`
- La portada por defecto (`portada.png`) se trackea en Git y se incluye en la imagen Docker

**Decisión — archivos dinámicos (firmas, imágenes de documento, imágenes de plantillas):**
- Se almacenan como data URIs base64 directamente en PostgreSQL
- Firmas: campo `signatureUrl` cambiado de `@db.VarChar(500)` a `@db.Text` en el modelo User
- Imágenes de bloques de propuesta y plantillas: almacenadas en campos `Json` (JSONB), que no tienen límite de tamaño

**Patrón de implementación (igual en los 3 endpoints):**
```typescript
// Multer guarda temp file → validar magic bytes → leer buffer → base64 → borrar temp
await validateImageFileSize(file);
await validateImageMagicBytes(file);
const buffer = await readFile(file.path);
const dataUri = `data:${file.mimetype};base64,${buffer.toString('base64')}`;
await unlink(file.path);
```
El `diskStorage` de Multer se mantiene como almacenamiento temporal porque
`validateImageMagicBytes` necesita leer el archivo del disco.

**Endpoints modificados:**
- `POST /users/:id/signature` → `users.controller.ts`
- `POST /proposals/pages/upload-image` → `proposals.controller.ts`
- `POST /templates/:templateId/blocks/:blockId/image` → `templates.controller.ts`

**Consideraciones de tamaño:**
- Firmas: ~18KB → ~24KB en base64 (trivial)
- Imágenes de documento: hasta 2MB (límite Multer) → ~2.7MB en base64
- JSONB en PostgreSQL no tiene límite práctico de tamaño para estos volúmenes
- A la escala de NOVOTECHNO (decenas de propuestas), el impacto en la BD es mínimo

**Decisión futura:** Si el volumen de imágenes crece significativamente (miles de
propuestas con múltiples imágenes pesadas), migrar a almacenamiento externo
(Supabase Storage, Cloudinary, o S3). Por ahora PostgreSQL es suficiente y evita
dependencias externas.

---

## ADR-015: resolveImageUrl — compatibilidad data URI y rutas relativas (abril 2026)

**Fecha:** Abril 2026 (Sesión de deploy Railway)
**Estado:** Vigente

**Problema:** `PdfPreviewModal.tsx` construía todas las URLs de imagen concatenando
`apiBase` + `url`. Con el cambio a base64, las URLs ahora pueden ser data URIs
(`data:image/jpeg;base64,...`) o rutas relativas (`/uploads/defaults/portada.png`).
La concatenación producía URLs inválidas: `https://api.railway.app/data:image/jpeg;base64,...`.

**Decisión:** Crear helper `resolveImageUrl()` en `PdfPreviewModal.tsx`:
```typescript
const resolveImageUrl = (url: string): string => {
    if (url.startsWith('data:')) return url;
    return `${apiBase}${url}`;
};
```

**Aplicado en 3 puntos:**
1. Bloques IMAGE tipo firma (dentro de `buildVisualPages`)
2. Bloques IMAGE genéricos (dentro de `buildVisualPages`)
3. Componente `CoverPageContent` (recibe `resolveImageUrl` como prop)

**Principio:** Cualquier componente que renderice imágenes de la BD debe usar
este patrón. Las imágenes antiguas (pre-migración) siguen siendo rutas relativas
y siguen funcionando. Las nuevas son data URIs y también funcionan.

---

## ADR-016: .gitignore — no bloquear migraciones Prisma (abril 2026)

**Fecha:** Abril 2026 (Sesión de deploy Railway)
**Estado:** Vigente

**Problema:** El `.gitignore` tenía `*.sql` para excluir database dumps sueltos.
Esto también excluía los archivos `migration.sql` dentro de
`apps/api/prisma/migrations/`, impidiendo que llegaran a Railway.

**Caso real:** La migración `change_signature_url_to_text` (que cambia
`signatureUrl` de `VarChar(500)` a `Text`) se aplicó localmente pero nunca se
subió a GitHub. Railway reportaba "No pending migrations to apply" mientras la
columna seguía siendo `VarChar(500)`. Al intentar guardar un base64 de ~24,000
caracteres, Prisma lanzaba `The provided value for the column is too long`.

**Decisión:** Reemplazar `*.sql` por `*.dump.sql` en `.gitignore`. Las migraciones
de Prisma (`migration.sql`) ahora se trackean correctamente.

**Regla:** Nunca agregar patrones genéricos al `.gitignore` que puedan atrapar
archivos de infraestructura (migraciones, configs, schemas). Preferir patrones
específicos como `*.dump.sql`, `*.backup.sql`.

---

## ADR-017: Cabeceras de hardening HTTP en apps/web vía nginx (abril 2026)

**Fecha:** Abril 2026 (Sesión de remediación Invicti)

**Estado:** Vigente

**Problema:** El escáner Invicti reportó dos hallazgos sobre el dominio
`web-production-55504.up.railway.app`:

1. "Password Transmitted over Query String" (MEDIUM) — el formulario de
   login en `apps/web/src/pages/Login.tsx` no tenía `method="POST"`
   explícito y en ciertos flujos de navegación enviaba el password en
   el query string.
2. "HSTS Policy Not Enabled" (MEDIUM, CVSS 7.7) — el `nginx.conf` que
   sirve `apps/web` no emitía ninguna cabecera de seguridad.

El segundo hallazgo tenía un agravante: `apps/web` y `apps/api` son
servicios Railway separados con dominios distintos. El `helmet()` que
ya protege `apps/api` no aplica al dominio del front.

**Falso comienzo (lección registrada):** En una primera iteración se
intentó añadir un servidor Express propio (`apps/web/server.mjs`) con
Helmet y un `railway.json` que fijaba `startCommand: "node server.mjs"`.
El enfoque era incorrecto para esta arquitectura:

- `apps/web/Dockerfile` es un multi-stage explícito cuyo runner es
  `nginx:alpine`. Railway prioriza el Dockerfile sobre cualquier
  `railway.json`.
- El runner final no tiene Node instalado, por lo que `node server.mjs`
  habría fallado de todas formas.
- `server.mjs` nunca llegaba a la imagen final: el `COPY --from=builder`
  del runner solo trae `/app/apps/web/dist`.

Además, la regeneración local del `pnpm-lock.yaml` con pnpm 9.0.0 (para
añadir las deps de Express) rompió los builds de Railway porque los
Dockerfiles tenían pineado `pnpm@8.15.5`, que no puede leer el formato
del lockfile nuevo. Error: `ERR_PNPM_LOCKFILE_BREAKING_CHANGE`.

**Decisión:** Tres commits atómicos:

1. **Bump de pnpm en Dockerfiles** — `apps/api/Dockerfile` (builder +
   runner) y `apps/web/Dockerfile` (builder) pasan de `pnpm@8.15.5` a
   `pnpm@9.0.0`, alineados con el `packageManager` declarado en el
   `package.json` raíz.
2. **Revert del intento Express** — eliminar `apps/web/server.mjs`,
   `apps/web/railway.json`, el script `"start": "node server.mjs"` y
   las dependencias `express`, `helmet`, `compression` de
   `apps/web/package.json`. Regenerar `pnpm-lock.yaml`.
3. **Headers en nginx** — añadir a `apps/web/nginx.conf`, a nivel
   `server`, las cuatro cabeceras de hardening con el modificador
   `always` para que se emitan también en respuestas 4xx/5xx:

```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
   add_header X-Frame-Options "DENY" always;
   add_header X-Content-Type-Options "nosniff" always;
   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

El hallazgo del password en query string se atacó en paralelo con
`method="POST"` explícito en `apps/web/src/pages/Login.tsx`.

**Verificación en producción:**

- `curl -I https://web-production-55504.up.railway.app/` → 200 OK con
  las cuatro cabeceras presentes.
- `curl -I -X PATCH https://web-production-55504.up.railway.app/` → 405
  Method Not Allowed **con las cuatro cabeceras presentes**, lo que
  confirma que el modificador `always` funciona en respuestas de error.

**CSP — diferido:** `Content-Security-Policy` queda sin emitir. El
bundle de Vite requiere una política con nonces o hashes para no
romperse bajo CSP estricta. Se registra como TODO para un ADR futuro
que defina la política compatible con el bundler.

**Regla:** Antes de proponer hardening HTTP en el front, leer
`apps/web/Dockerfile` para identificar qué sirve los estáticos en
producción (nginx, Node, caddy). El fix siempre vive en la capa de
serving real, no en el framework de frontend. Paralelamente: todo
cambio a dependencias de un workspace debe ir acompañado de una
verificación de que los Dockerfiles pueden leer el `pnpm-lock.yaml`
resultante (coincidencia entre `packageManager` del root y la versión
pineada en los Dockerfiles).
## ADR-018: Consecutivo inicial de cotizaciones por usuario (abril 2026)

**Fecha:** Abril 2026 (Sesión de feature edición de usuarios)

**Estado:** Vigente

**Problema:** Al crear los 5 comerciales reales en NovoTechFlow, cada uno ya tenía
un historial de cotizaciones previo fuera del sistema (ej. Denis Ortiz iba en
COT-DO0046 en su Excel histórico). El método `generateProposalCode` calcula el
próximo número haciendo `MAX(proposalCode)` filtrado por usuario, lo que para un
comercial nuevo sin propuestas locales arrancaba siempre en 0001. Esto rompía la
continuidad del consecutivo desde el punto de vista comercial: la primera
cotización emitida desde el sistema iba a ser COT-DO0001, no COT-DO0047.

**Alternativas consideradas:**
1. Persistir el contador real en la DB y mantenerlo con cada inserción
   (`proposalCounter` incremental). Descartado: agrega un punto de fallo (race
   conditions, drift) cuando hoy el cálculo derivado funciona bien.
2. Importar al sistema todas las cotizaciones históricas como registros reales.
   Descartado: requiere migrar PDFs, datos de cliente, escenarios — esfuerzo
   desproporcionado para un solo objetivo.
3. Permitir que el admin edite el consecutivo en cualquier momento. Descartado:
   abre la puerta a saltos arbitrarios en la numeración, rompe trazabilidad.

**Decisión:** Agregar al modelo User un campo `proposalCounterStart Int @default(0)`
que actúa como **piso** para el contador derivado. La lógica en
`generateProposalCode` aplica:

```ts
nextNumber = Math.max(nextNumber, user.proposalCounterStart + 1);
```

El campo es **inmutable post-creación** (solo aparece en el formulario de
creación de usuario, no en el de edición). Esto preserva trazabilidad: una vez
fijado al alta, el offset no puede cambiar.

**Comportamiento:**
- Usuario nuevo, counterStart=0, sin propuestas → COT-XX0001-1 (igual que antes)
- Usuario nuevo, counterStart=46, sin propuestas → COT-XX0047-1 (continúa desde histórico)
- Cuando las propuestas reales superan al counterStart, el campo deja de tener
  efecto automáticamente (el MAX real toma precedencia).

**Regla:** No agregar lógica de "consecutivo" o "numeración secuencial por
usuario" fuera de `generateProposalCode`. Si en el futuro hay otros consecutivos
(facturas, órdenes, etc.), aplicar el mismo patrón derivado + offset opcional —
nunca persistir contadores incrementales en la DB.

**Decisiones de diseño relacionadas:**
- Reset de password admin: directo desde edición, sin pedir la actual (acción
  puramente administrativa).
- Cambio de nomenclatura post-creación: solo afecta cotizaciones futuras; las
  históricas conservan su código original (no se renumera retroactivamente).
- Self-protection en `updateUser`: un admin no puede quitarse a sí mismo el rol
  ADMIN ni desactivarse.

---

## ADR-019: `/dashboard` como destino único por defecto y `/admin` reservado para panel administrativo futuro (mayo 2026)

**Fecha:** Mayo 2026 (Sesión de corrección de navegación)

**Estado:** Vigente

**Problema:** Un usuario con rol `ADMIN`, al hacer click en el ítem "Dashboard"
del sidebar o al loguearse, era redirigido a `/admin` en vez de a `/dashboard`.
La ruta `/admin` apunta al componente `AdminPanel`, que está vacío / en
construcción. El usuario percibía esto como "el dashboard se borró después de
crear una propuesta".

La causa raíz era una lógica condicional
`user?.role === 'ADMIN' ? '/admin' : '/dashboard'` duplicada en dos lugares: el
ítem "Dashboard" del `Sidebar.tsx` y la función `navigateByRole` de `Login.tsx`.
Esa lógica asumía que el admin debía caer en una ruta distinta a la del
comercial, pero `Dashboard.tsx` ya tiene lógica condicional por rol que muestra
"Resumen Global de Actividad" + columna de asesor para ADMIN, y "Mis Propuestas"
para COMERCIAL. Es decir: la ruta `/dashboard` ya estaba preparada para servir a
ambos roles correctamente, y la ruta `/admin` no debía ser destino de ningún
redirect automático todavía.

**Alternativas consideradas:**

1. Construir el contenido faltante de `AdminPanel` y mantener el redirect a
   `/admin`: descartada porque el "Resumen Global de Actividad" en `/dashboard`
   ya cumple ese rol para el admin. Duplicar funcionalidad llevaría a
   inconsistencias.
2. Sub-rutas `/dashboard/admin` y `/dashboard/commercial`: descartada por
   sobre-ingeniería. La diferenciación dentro del componente con `user?.role` es
   suficiente y ya está implementada.

**Decisión:**

1. `/dashboard` es el único destino por defecto tras login y para el ítem
   "Dashboard" del sidebar, independiente del rol. La diferenciación
   admin/comercial se resuelve dentro del componente `Dashboard.tsx` mediante
   `user?.role === 'ADMIN'`.
2. `/admin` queda reservado en `App.tsx` como ruta válida pero sin entrada en el
   sidebar ni redirect automático hacia ella. Se activará cuando se construya el
   panel administrativo real.
3. Prohibido reintroducir lógica `navigateByRole` o equivalentes que decidan ruta
   por rol fuera del propio componente de destino. Si en el futuro un panel admin
   necesita un destino propio, se agrega como ítem separado en el sidebar (ej.
   "Panel Admin" con icono distinto, visible solo si `isAdmin`), nunca como
   reemplazo del ítem "Dashboard".

**Consecuencias:**

- Positivas: elimina la sorpresa del admin cayendo en una página vacía.
  Centraliza la lógica de vista por rol en un solo lugar (`Dashboard.tsx`). Deja
  la ruta `/admin` libre para futuro uso sin acoplarse al routing del dashboard.
- Negativas: ninguna identificada.
- Migración: ninguna. Cambio de frontend puro, sin schema ni datos afectados.

**Archivos modificados:**

- `apps/web/src/layouts/Sidebar.tsx` (línea 31): ítem "Dashboard" apunta siempre
  a `/dashboard`.
- `apps/web/src/pages/Login.tsx` (líneas 22-29 y 52): eliminada función
  `navigateByRole`, reemplazada por `navigate('/dashboard')` directo.

**Commit:** `32445de` — fix(web): admin sidebar y login redirect apuntan a
/dashboard

---

## ADR-020: Persistencia de ciudad de emisión en propuestas (mayo 2026)

**Fecha:** Mayo 2026 (Sesión de corrección de pérdida de datos en builder)

**Estado:** Vigente

**Problema:** El campo "Ciudad de emisión" en `ProposalDocBuilder` era state local
con default `'Bogotá D.C.'` sin persistencia. El usuario seleccionaba una
ciudad, generaba el documento, y al recargar la página o reabrir la propuesta
el valor volvía al default. La ciudad se usaba en `proposalVariables`
(reemplazo de placeholders en plantillas) pero nunca se guardaba en DB.

**Alternativas consideradas:**
1. Autosave onChange con debounce: descartada — disparaba PATCH por cada
   selección del combobox; ruido innecesario para un campo de baja frecuencia
   de edición.
2. Reutilizar `useProposalBuilder.updateProposal` desde el builder: descartada
   por scope. `ProposalDocBuilder` no usa ese hook actualmente; integrarlo
   requeriría refactor mayor (el hook también carga items y catálogos), fuera
   del alcance de la corrección puntual.
3. Botón "Guardar" general que cubriera múltiples campos del builder:
   descartada por YAGNI — hoy el único campo de metadata editable en el
   builder es la ciudad.

**Decisión:**
1. Nuevo campo `Proposal.issueCity` opcional (`VARCHAR(100) NULL`).
2. Default `'Bogotá D.C.'` vive solo en UI; en DB el valor persiste como
   `NULL` hasta que el usuario guarde explícitamente. Una propuesta sin
   ciudad asentada no miente diciendo que es de Bogotá.
3. Botón compacto inline al lado del `CityCombobox` en `ProposalDocBuilder`,
   visible solo cuando `selectedCity !== savedCity`. Persiste vía
   `PATCH /proposals/:id` con payload `{ issueCity }`.
4. Doble estado local (`selectedCity` y `savedCity`) para detectar cambios
   pendientes incluso cuando la DB tiene `NULL` y el usuario quiere asentar
   Bogotá explícitamente. Sin `savedCity` separado, ese caso nunca dispararía
   el botón.
5. Decisión consciente de no usar `useProposalBuilder.updateProposal` aquí.
   `ProposalDocBuilder` hace `api.patch` local, igual que ya hacía con
   `api.get` en línea 62. Deuda técnica registrada: cuando se refactorice el
   builder a consumir `useProposalBuilder`, este `api.patch` debe migrarse a
   la whitelist del hook, que ya incluye `'issueCity'`.

**Consecuencias:**
- Positivas: la ciudad persiste correctamente; UX mínima sin botones
  intrusivos; backend extensible (DTO + service ya soportan el campo);
  whitelist del hook ya queda lista con `'issueCity'` para cuando se migre el
  builder al patrón §A.
- Negativas: deuda técnica de §A (componentes de UI no deben importar `api`)
  preexistente en el archivo, no agravada pero tampoco resuelta.
- Migración: `20260505154055_add_issue_city_to_proposal` aplicada en local y
  desplegada a Railway en el mismo commit.

**Archivos modificados:**
- `apps/api/prisma/schema.prisma`: campo `issueCity` en modelo `Proposal`.
- `apps/api/prisma/migrations/20260505154055_add_issue_city_to_proposal/migration.sql`:
  nueva migración.
- `apps/api/src/proposals/dto/proposals.dto.ts`: `UpdateProposalDto.issueCity?`
  con `@MaxLength(100)`.
- `apps/api/src/proposals/proposals.service.ts`: `updateProposal` mapea
  `issueCity` con patrón `data.X ?? undefined`.
- `apps/web/src/lib/types.ts`: `ProposalDetail.issueCity?`.
- `apps/web/src/pages/proposals/ProposalDocBuilder.tsx`: estados `savedCity` y
  `savingCity`, handler `handleSaveCity`, botón inline de guardado.

**Commit:** `9da3884` — feat(proposals): agregar ciudad de emision a propuesta

---

## ADR-021: Cascade en scenario_items.itemId para permitir borrado de propuestas

**Fecha:** 2026-05-05
**Estado:** Aceptada

**Contexto:**
Borrar una propuesta desde el dashboard fallaba con HTTP 500 y error de Prisma:
"violates RESTRICT setting of foreign key constraint scenario_items_item_id_fkey".
La cascade de Proposal → ProposalItem existía, pero la FK scenario_items.item_id
usaba RESTRICT por defecto, bloqueando el borrado en cadena cuando la propuesta
tenía escenarios con ítems.

**Decisión:**
Declarar `onDelete: Cascade` en la relación ScenarioItem.item dentro de
schema.prisma, y emitir una migración SQL que ejecuta DROP CONSTRAINT + ADD
CONSTRAINT con ON DELETE CASCADE sobre scenario_items_item_id_fkey.

**Consecuencias:**
- Borrar una propuesta ahora elimina en cadena: proposal → proposal_items →
  scenario_items, sin intervención del service.
- Borrar un proposal_item individual también elimina sus scenario_items.
  Esto es el comportamiento esperado: un scenario_item sin proposal_item
  referenciado no tiene sentido de negocio.
- No se requiere lógica adicional en proposals.service.ts.
## ADR-022: `manualAmount` como monto inicial de propuesta para proyección en dashboard (mayo 2026)

**Fecha:** Mayo 2026 (Sesión de feature de monto inicial estimado)

**Estado:** Vigente

**Problema:** Al crear una propuesta nueva, el escenario está vacío y por lo
tanto la suma de ítems es cero. Esto significaba que en el dashboard la
propuesta aparecía con subtotal `null` (raya) hasta que el comercial entrara a
construir el detalle de los ítems. Para propuestas que se migran desde sistemas
externos o que el comercial registra rápido y construye después, el dashboard
no reflejaba ningún valor proyectable, dejando huecos en las billing cards,
forecast por trimestre y filtros de monto USD.

El comercial necesitaba poder declarar un monto estimado inicial al crear la
propuesta — útil sobre todo durante la migración desde la herramienta anterior
y para cotizaciones tempranas en estado `ELABORACION` —, sin que ese monto
contaminara los cálculos reales de la propuesta (PDF, Excel export, totales del
constructor) cuando ya existieran ítems con valor.

**Alternativas consideradas:**

1. **Modal separado "Nueva Proyección de Facturación rápida"**: descartada por
   sobre-ingeniería. Implicaba un modelo nuevo (`BillingProjection`-like),
   migración de Prisma, dos flujos paralelos de creación, y trazabilidad
   adicional con consecutivo legacy. La solución vive en el modelo `Proposal`
   existente sin abrir flujos paralelos.
2. **`manualAmount` con switch irreversible**: una vez el comercial agrega
   cualquier ítem, el dashboard ignora `manualAmount` para siempre. Descartada
   porque borrar todos los ítems devolvería al usuario a un dashboard en cero
   sin recurso, dañando la UX en escenarios de exploración o reset.
3. **`manualAmount` con moneda configurable (`COP` | `USD`)**: descartada por
   alcance. Sumaba columna nueva al schema, validación cruzada en el service y
   un selector en el formulario que el usuario consideró innecesario.
   Convergimos en USD fijo, coherente con la moneda con la que el dashboard
   alimenta las billing cards.
4. **Lógica del fallback fuera de `pricing-engine.ts`** (en el hook): descartada
   por sección J de `CONVENTIONS.md`. Cualquier cálculo financiero — incluido
   el de "qué monto mostrar para una propuesta" — vive en el engine.

**Decisión:**

1. Nuevo campo `Proposal.manualAmount: Decimal? @db.Decimal(15, 2)`, opcional,
   nullable, sin default. Patrón consistente con los demás campos monetarios
   opcionales del modelo (`unitPriceOverride`, etc.). La moneda se asume USD por
   convención del dashboard; no existe campo `manualAmountCurrency`.
2. El backend acepta y persiste el campo vía `CreateProposalDto` y
   `UpdateProposalDto` con `@IsOptional() @IsNumber() @Min(0)`. El service no
   aplica lógica de cálculo: solo persiste lo recibido. La regla
   `forbidNonWhitelisted: true` (ADR-006) obliga a declarar el campo en los
   DTOs para que el frontend pueda enviarlo.
3. Función nueva `getDashboardAmount(proposal)` en
   `apps/web/src/lib/pricing-engine.ts`. Lógica: si el escenario con menor
   subtotal calculado por `computeMinSubtotal` da `> 0`, retorna ese valor con
   su moneda real. En caso contrario, si existe `manualAmount > 0`, retorna ese
   valor con `currency: 'USD'`. Si no hay nada, retorna `null`. Devuelve además
   un flag `isManual: boolean` para distinguir el origen del valor.
4. Como parte de esta decisión, se movió `computeMinSubtotal` (que vivía como
   función local en `useDashboard.ts`) hacia `pricing-engine.ts` y se exportó
   junto con su tipo `MinSubtotalResult`. Esto cumple la regla absoluta de la
   sección J: ningún cálculo financiero vive fuera del engine.
5. El indicador visual en la tabla del dashboard es un caracter `~` discreto en
   gris claro a la izquierda del valor, con `title` HTML nativo:
   *"Monto estimado inicial. Sin ítems cargados aún."* No se introduce un
   componente de badge ni una dependencia de UI nueva.
6. **Alcance excluido explícitamente**:
   - El `manualAmount` no se propaga a PDF, Excel export del constructor, ni
     totales del escenario. Es un valor exclusivo del dashboard.
   - `exportDashboard.ts` consume `manualAmount` automáticamente vía
     `getSubtotalUsd` porque el flag `currency: 'USD'` ya lo deja pasar sin
     conversión TRM. No requirió cambio.
   - La UI de edición post-creación se implementó en chat siguiente
     (mayo 2026); ver Adenda al final del ADR. El backend ya soportaba
     `PATCH /proposals/:id` desde la primera implementación.

**Consecuencias:**

- Positivas: el dashboard refleja propuestas tempranas o migradas desde el
  primer momento. La función `getDashboardAmount` es la fuente única de verdad
  para "qué monto mostrar por propuesta en el dashboard"; cualquier consumidor
  futuro debe pasar por ahí. La transición desde `manualAmount` a suma de
  escenarios es automática: en cuanto un escenario produce subtotal `> 0`, el
  dashboard cambia al cálculo real sin intervención del usuario.
- Negativas: como el switch a "suma de escenarios" es por valor `> 0`, un
  comercial que cargue ítems con costo cero (placeholders, drafts) seguirá
  viendo el `manualAmount`. Aceptado como protección frente a dashboards que se
  irían a cero accidentalmente.
- Migración: agrega columna nullable `manual_amount numeric(15,2)`. Cero
  impacto en filas existentes; todas quedan con `NULL` y siguen calculando
  desde escenarios como hoy.

**Archivos modificados:**

- `apps/api/prisma/schema.prisma`: nuevo campo `manualAmount` en modelo
  `Proposal`.
- `apps/api/prisma/migrations/20260505212618_add_proposal_manual_amount/migration.sql`:
  agrega columna `manual_amount`.
- `apps/api/src/proposals/dto/proposals.dto.ts`: campo `manualAmount?: number`
  en `CreateProposalDto` y `UpdateProposalDto`.
- `apps/api/src/proposals/proposals.service.ts`: persistencia del campo en
  `createProposal` y `updateProposal`.
- `apps/web/src/lib/types.ts`: campo `manualAmount?: string | null` en
  `ProposalSummary`.
- `apps/web/src/lib/pricing-engine.ts`: tipo `MinSubtotalResult` y función
  `computeMinSubtotal` movidos desde el hook; nueva función
  `getDashboardAmount`.
- `apps/web/src/hooks/useDashboard.ts`: importa del engine en lugar de
  función local; agrega `isManual` al pipeline de filas del dashboard.
- `apps/web/src/pages/proposals/NewProposal.tsx`: campo nuevo "Monto estimado
  inicial" con sufijo USD en el formulario de creación.
- `apps/web/src/pages/Dashboard.tsx`: indicador `~` cuando `row.isManual`.

**Adenda — mayo 2026 (cierre de UI de edición post-creación):**

Se completó la edición de `manualAmount` después de la creación de la
propuesta, dentro del header del constructor de items. Esto cierra el
bullet diferido del punto 6.

Patrón de implementación:

- El input se agregó como cuarta columna en el grid del header de
  `ProposalItemsBuilder.tsx`, junto a `issueDate`, `validityDays` y
  `validityDate`. Submit explícito vía el form existente; sin autosave.
- La coerción string→number (necesaria porque el tipo
  `ProposalDetail.manualAmount` es `string | null` para lectura, pero
  el DTO de escritura espera `number`) se centralizó en el hook
  `updateProposal`, no en el componente. Un solo punto de coerción
  para todos los consumidores futuros del PATCH.
- Input vacío → `null` al backend → campo limpiado en DB. Esto permite
  revertir el monto manual sin tener que crear escenarios.

Bug encontrado y corregido durante la implementación:

En `proposals.service.ts`, la línea original
`manualAmount: data.manualAmount ?? undefined` silenciaba los `null`
enviados desde el frontend (porque `null ?? undefined === undefined`,
y Prisma trata `undefined` como "no tocar el campo"). El usuario veía
200 OK pero el campo no se limpiaba. Se reemplazó por
`manualAmount: data.manualAmount === undefined ? undefined : data.manualAmount`
para distinguir explícitamente "no enviado" (preservar) de "enviado
como null" (limpiar).

**Patrón generalizable:** para cualquier campo opcional-nullable en
`prisma.update`, NO usar `field ?? undefined` cuando el frontend pueda
enviar `null` con intención de limpiar. Usar
`field === undefined ? undefined : field`. El operador `??` solo es
seguro cuando el frontend nunca envía `null`.

Archivos modificados en la adenda:

- `apps/web/src/hooks/useProposalBuilder.ts`: `'manualAmount'` agregado
  al array `allowed` del whitelist; bloque de coerción string→number
  centralizado antes del `api.patch`.
- `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx`: input nuevo
  con icono `DollarSign` en el header del form; payload extendido en
  `handleUpdateProposal`.
- `apps/web/src/lib/types.ts`: campo `manualAmount?: string | null`
  agregado a `ProposalDetail` (faltaba; solo estaba en
  `ProposalSummary`).
- `apps/api/src/proposals/proposals.service.ts`: fix del `??` por
  ternario explícito en la línea de `manualAmount` dentro de
  `updateProposal`.
  ---

## ADR-023: Consecutivo manual de propuestas para migración del sistema legado (mayo 2026)

### Contexto

NOVOTECHNO está migrando propuestas comerciales del sistema viejo a NovoTechFlow. Las propuestas viejas tienen consecutivos en rangos altos (cerca de 4000–5000) que el comercial necesita preservar al cargarlas, sin alterar el flujo de numeración automática que usa el equipo para emisión nueva. El generador automático previo (a) ordenaba códigos alfabéticamente —bug latente con padding mixto—, (b) padeaba a 4 dígitos —insuficiente para los rangos del sistema viejo—, y (c) no contemplaba la coexistencia de números asignados manualmente con la secuencia automática.

### Decisión

1. **Flag `consecutiveSource: AUTO | MANUAL`** como enum Prisma en el modelo `Proposal`, con `@default(AUTO)` que cubre por backfill todas las propuestas previas. Inmutable post-creación.

2. **Padding 5 dígitos** en todos los códigos nuevos (`COT-{NOM}{NÚMERO_PADEADO_5}-{VERSIÓN}`). Códigos históricos en 4 dígitos no se reescriben; conviven sin problema porque el generador refactorizado calcula el siguiente número de forma **numérica** (no alfabética) parseando con regex `/(\d+)-\d+$/`.

3. **Permisos:** cualquier usuario logueado puede emitir manuales. La nomenclatura aplicada es siempre la del usuario logueado; el comercial escribe solo el número, las letras las pone NovoTechFlow.

4. **Reglas del número manual:**
   - Entero entre 1 y 99999.
   - Estrictamente menor al próximo automático del usuario (`< nextAuto`) — el manual existe **por debajo** del contador, nunca por arriba.
   - El manual **no mueve** el contador automático. Si el siguiente automático candidato choca con un número ya emitido (manual o automático), avanza secuencialmente hasta encontrar uno libre.
   - Si conflicta con un código ya emitido del mismo usuario, **bloqueo duro**; el backend sugiere el siguiente número libre hacia arriba dentro del rango (`< nextAuto`), o `null` si no hay espacio.
   - Inmutable post-creación de la propuesta.

5. **Clonación:**
   - `NEW_VERSION` copia `consecutiveSource` del original (clonar una manual mantiene el carácter manual con sufijo de versión incrementado).
   - `NEW_PROPOSAL` siempre genera con `consecutiveSource = AUTO`.

6. **Pre-requisito habilitado:** `proposalCounterStart` deja de ser inmutable post-creación (relaja ADR-018) — ADMIN puede editarlo desde el modal de usuarios, con validación server-side que rechaza valores menores o iguales al máximo número secuencial ya emitido por el usuario.

### Implementación

- **Schema (`apps/api/prisma/schema.prisma`):** enum `ConsecutiveSource` y campo `consecutiveSource ConsecutiveSource @default(AUTO) @map("consecutive_source")` en `Proposal`. Migración `20260506193743_add_consecutive_source_to_proposal`.
- **Backend (`apps/api/src/proposals/proposals.service.ts`):**
  - Helpers privados `getNextAutoNumber(userId)` (filtra solo AUTO + aplica `proposalCounterStart`) y `getTakenNumbers(userId)` (Set con todos los números del usuario).
  - `generateProposalCode` refactorizado: cálculo numérico, padding 5, salto de números tomados, cap en 99999.
  - Nuevo método público `validateManualConsecutive(userId, number)` que retorna unión discriminada `ManualConsecutiveValidation`: `{ ok: true } | { ok: false; reason: 'OUT_OF_RANGE' | 'GTE_AUTO' | 'TAKEN'; conflict?: string; suggestion: number | null }`.
  - `createProposal` con re-validación server-side obligatoria del manual; nunca confiar solo en cliente.
- **Endpoint:** `GET /proposals/validate-manual?n=<number>` con `JwtAuthGuard`, `userId` tomado de `req.user` (no del query — IDOR).
- **DTO (`apps/api/src/proposals/dto/proposals.dto.ts`):** campo opcional `manualConsecutive?: number` (`@IsInt`, `@Min(1)`, `@Max(99999)`).
- **Frontend (`apps/web/src/pages/proposals/NewProposal.tsx`):** toggle Automático/Manual, input numérico con validación local (rango) y remota (debounce 500 ms), feedback inline (spinner / check verde / error con sugerencia aplicable como botón), payload condicional, submit bloqueado cuando manual no validado. Tipo `ManualConsecutiveValidation` espejo en `apps/web/src/lib/types.ts`.

### Consecuencias

**Positivas:**
- Migración del sistema viejo posible sin alterar la numeración automática.
- Bug latente de orden alfabético con padding mixto eliminado.
- Validación previa en el form (UX) + re-validación server-side (seguridad).
- `proposalCounterStart` ahora ajustable, lo que da control administrativo para arrancar la numeración automática por encima del rango migrado.

**Negativas / a vigilar:**
- El generador automático ahora hace dos queries (`getNextAutoNumber` + `getTakenNumbers`) en cada creación. Aceptable al volumen actual; revisar si en el futuro hay cuellos de botella en alta concurrencia.
- El mensaje de error `GTE_AUTO` en el frontend es genérico ("Debe ser menor al próximo automático del usuario") porque el backend no expone el `nextAuto` en la respuesta. Si en algún momento se quiere mostrar el número exacto, requiere una pequeña adición al backend.
- El manual no fija la versión en el `conflict` retornado (`COT-LMA00001` sin sufijo `-1`), decisión deliberada para que el frontend no tenga que parsear ni asumir versiones.

### Alternativas descartadas

- **Boolean `isManualCode`** en lugar de enum: descartada por extensibilidad (un futuro `IMPORTED`, `LEGACY`, etc. cabe sin migración de tipo).
- **Padding variable** (4 dígitos hasta 9999, sin padding arriba): descartada por inconsistencia visual y complejidad innecesaria del generador.
- **Reescribir códigos históricos a 5 dígitos**: descartada por trazabilidad con clientes que ya tienen propuestas emitidas.
- **Sugerencia bidireccional** (más cercano al pedido): descartada en favor de "siguiente hacia arriba" por simplicidad y porque el caso de uso real es migración secuencial.
- **Editable post-creación** (`consecutiveSource` y/o número manual): descartada para preservar trazabilidad con el cliente final.
- **Solo validar en el POST**: descartada por UX en un form largo; agregar el endpoint separado `validate-manual` permite feedback temprano sin necesidad de submit.

## ADR-024: Bloqueo de versiones históricas de propuestas (mayo 2026)

**Fecha:** Mayo 2026
**Estado:** Vigente

**Problema:**
Cada propuesta puede tener múltiples versiones (`COT-LMA05001-1`, `-2`, `-3`...) generadas vía `POST /proposals/:id/clone` con `cloneType=NEW_VERSION`. Antes de este cambio, todas las versiones eran igualmente editables y exportables. Riesgos: (1) un comercial podía alterar una versión vieja después de haberla enviado al cliente, rompiendo el record histórico de lo que se cotizó; (2) los exportadores PDF/Excel reflejaban siempre el estado actual de la fila, no el snapshot enviado; (3) `cloneProposal NEW_VERSION` calculaba la nueva versión como `versión actual + 1`, lo que generaba conflictos con `proposalCode @unique` cuando se clonaba desde una versión vieja existiendo una más nueva.

**Decisión:**
Activar el campo `Proposal.isLocked` (que ya existía en el schema sin uso) como invariante: solo la última versión de cada grupo está unlocked, todas las anteriores quedan locked. El bloqueo se aplica en backend (autoridad) y se refleja en frontend (UX).

**Reglas:**
- Una propuesta es **latest** del grupo si su `proposalCode` tiene la mayor versión (sufijo numérico tras el último `-`) entre las propuestas con el mismo prefijo. Solo la latest puede tener `isLocked=false`.
- Backend rechaza con 403 toda mutación contra una propuesta con `isLocked=true`. Aplica a: `updateProposal`, `addProposalItem`, `updateProposalItem`, `removeProposalItem`, `deleteProposal`, todos los mutadores de scenarios y pages/blocks.
- `cloneProposal` con `cloneType=NEW_VERSION` se ejecuta dentro de `prisma.$transaction`: calcula `max(versión del grupo) + 1`, lockea todo el grupo con `updateMany`, y crea la nueva versión con `isLocked=false`. Atomicidad garantiza que nunca quede el grupo lockeado sin nueva versión creada.
- Clonar una propuesta locked sigue **permitido**. Es la única salida del usuario para "editar" una versión vieja: clona como NEW_VERSION (continúa la cadena) o NEW_PROPOSAL (rompe en propuesta nueva).
- `deleteProposal` sobre locked **no permitido**. Preserva la genealogía completa del grupo.
- Frontend: hook `useProposalReadOnly(proposal)` devuelve `{ isReadOnly: !!proposal?.isLocked }`. Componente `ReadOnlyBanner` se muestra arriba de las 3 pantallas del constructor cuando `isReadOnly=true`. Inputs mutables: `disabled={isReadOnly}`. Botones destructivos y de "agregar X": ocultos. Botones de export PDF/Excel: ocultos. Botones de clonar y de visualización: intactos.
- Botón "Editar" por fila en la tabla de ítems se mantiene visible en read-only: abre el form inline con todos los inputs deshabilitados, función "ver qué hay" útil para inspección histórica.
- Componentes con prop `readOnly`/`disabled` opcional pre-existente (`RichTextEditor`) se aprovechan sin modificación. Componentes que la necesitan (`AutocompleteInput`) se extienden de forma aditiva: nueva prop opcional con default `false`, backwards-compatible.

**Patrón de implementación backend:**
- Helper único `assertProposalNotLocked(proposal)` en `apps/api/src/proposals/proposals-lock.helper.ts`. Recibe cualquier objeto con `{ isLocked, proposalCode }`, lanza `ForbiddenException` si `isLocked=true`. Si `proposal` es null/undefined, no hace nada (caller maneja el NotFound).
- En `proposals.service.ts`: aplicado directamente después de `verifyProposalOwnership` (que ya retorna el objeto completo del modelo).
- En `scenarios.service.ts` y `pages.service.ts`: aplicado dentro de los métodos privados existentes `verifyScenarioOwnership` y `verifyPageOwnership`. Esos métodos son usados exclusivamente por mutadores; los GETs no los tocan. Esto cubre todos los mutadores en una sola intervención por servicio.

**Patrón de implementación frontend:**
- Hook `useProposalReadOnly` en `apps/web/src/hooks/`. Fuente única de verdad. Permite migración futura a Context si crece.
- Banner `ReadOnlyBanner` en `apps/web/src/components/proposals/`. Mensaje fijo: "Esta es una versión histórica bloqueada. Solo la última versión es editable. Para continuar editando, clónala como nueva versión."
- Prop drilling explícito de `isReadOnly` desde la página al subcomponente. No Context. Decisión consciente: consistente con patrón actual de hooks que reciben props, profundidad ≤3 niveles.
- Defensa en profundidad: aunque el frontend deje pasar una mutación por bug, backend rechaza con 403.

**Migration de datos:**
- `apps/api/prisma/migrations/20260507_lock_historic_proposal_versions/migration.sql` — UPDATE puro sin schema change. Marca `is_locked = true` en toda fila cuyo grupo (prefijo de `proposal_code` antes del último `-N`) tenga otra fila con versión mayor. Aplicada en local; pendiente aplicar en Railway en el deploy del feature.

**Consecuencias positivas:**
- Integridad histórica: lo que se envió al cliente queda inmutable.
- Defensa en profundidad: backend autoritativo + frontend UX coherente.
- Reusa campo `Proposal.isLocked` ya existente en el schema. Sin migración estructural.
- `cloneProposal NEW_VERSION` ahora es atómico (antes hacía 5+ writes secuenciales sin transacción).
- Invariante "solo max(version) unlocked" se mantiene robusta: cada NEW_VERSION lockea el grupo entero antes de crear, blindando incluso contra estados sucios previos.

**Consecuencias negativas:**
- No se puede borrar una propuesta locked individualmente. Decisión consciente para preservar genealogía. Si la propuesta entera fue un error y se quiere eliminar el grupo completo, queda como debt para un feature futuro de "borrar grupo de versiones".
- Edge case: si el usuario borra la latest unlocked manualmente, el grupo entero queda locked sin ninguna versión editable. La única salida actual es clonar una de las locked como NEW_PROPOSAL (rompe la cadena con código nuevo) o NEW_VERSION (calcula `max+1`, queda como nueva latest editable). Acceptable por ahora.
- Componente `RichTextEditor` ya soportaba `readOnly`. `AutocompleteInput` se extendió de forma aditiva. Otros componentes genéricos que pudieran usarse a futuro requerirán el mismo patrón.

**Alternativas consideradas:**
- **Campo derivado al vuelo** (calcular `isLatestVersion` parseando `proposalCode` en cada GET): descartada. Aunque evita mantener un boolean sincronizado, requiere parsing de strings en cada read y agrupación por prefijo. `Proposal.isLocked` ya existía sin uso, aprovecharlo es más simple y performante.
- **Borrar versiones viejas en lugar de lockear**: descartada. Pierde el histórico de lo enviado al cliente, que es justamente lo que se quiere preservar.
- **Permitir borrado de propuestas locked**: descartada (opción 1 en la decisión de producto). Rompería la genealogía del grupo.
- **Bloquear todo clone desde locked**: descartada. Por experiencia de negocio, proyectos descartados a veces "renacen" y son difíciles de remodelar; clonar desde una vieja debe seguir disponible.
- **`NEW_VERSION` desde locked usando `versión actual + 1`** (comportamiento previo): descartada. Genera conflictos con `proposalCode @unique` si existe una versión más nueva. Reemplazada por `max(versión del grupo) + 1`.
- **Context Provider para `isReadOnly` en lugar de prop drilling**: deferida. Profundidad actual ≤3 niveles, prop drilling es consistente con el patrón del repo. Si crece, se considera para refactor futuro.

**Archivos modificados:**
- Backend (commit a792d69):
  - `apps/api/src/proposals/proposals-lock.helper.ts` (nuevo)
  - `apps/api/src/proposals/proposals.service.ts`
  - `apps/api/src/proposals/scenarios.service.ts`
  - `apps/api/src/proposals/pages.service.ts`
  - `apps/api/prisma/migrations/20260507_lock_historic_proposal_versions/migration.sql` (nuevo)
- Frontend foundation + Cálculos (commit 36ef99e):
  - `apps/web/src/lib/types.ts`
  - `apps/web/src/hooks/useProposalReadOnly.ts` (nuevo)
  - `apps/web/src/components/proposals/ReadOnlyBanner.tsx` (nuevo)
  - `apps/web/src/pages/proposals/ProposalCalculations.tsx`
  - `apps/web/src/pages/proposals/components/ScenarioSidebar.tsx`
  - `apps/web/src/pages/proposals/components/ScenarioHeader.tsx`
  - `apps/web/src/pages/proposals/components/ScenarioItemRow.tsx`
- Frontend Constructor (commit d569c65):
  - `apps/web/src/pages/proposals/ProposalDocBuilder.tsx`
  - `apps/web/src/pages/proposals/components/PageEditor.tsx`
  - `apps/web/src/pages/proposals/components/BlockEditor.tsx`
  - `apps/web/src/pages/proposals/components/CityCombobox.tsx`
- Frontend Items (commit f3dd0e2):
  - `apps/web/src/components/AutocompleteInput.tsx`
  - `apps/web/src/components/proposals/SpecFieldsSection.tsx`
  - `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx`

**Commits:**
- `a792d69` — backend
- `36ef99e` — frontend foundation + Cálculos
- `d569c65` — frontend Constructor de Propuesta
- `f3dd0e2` — frontend Items
## ADR-025 — Consolidación de items en la Propuesta Técnica del PDF

**Fecha:** 2026-05-07
**Estado:** Aceptado

### Contexto

La sección "Propuesta Técnica" del PDF se generaba iterando `for scenario → for visibleItem`, lo que producía una ficha por item por cada escenario donde aparecía. Si un mismo item estaba visible en N escenarios, su ficha técnica se imprimía N veces en el PDF, generando documentos largos con información redundante. La sección "Propuesta Técnica" debe describir cada item una sola vez, no repetirlo por escenario, ya que la información técnica del item no cambia entre escenarios (lo que cambia es precio/cantidad, que viven en la Propuesta Económica).

### Decisión

Se introduce un módulo puro `apps/web/src/lib/consolidateTechnicalItems.ts` que recibe `processedScenarios` y devuelve:
- `items: ConsolidatedTechItem[]` — items deduplicados con `globalIndex` 1..N y `variantLabel` opcional ("Config A", "Config B", ...).
- `variantLabelByScenarioItemId: Map<string, string | null>` — mapa para etiquetar las apariciones individuales en la Propuesta Económica.

**Reglas de deduplicación:**
- Dedup key: `${itemType}::${name.trim().toLowerCase()}`. Mismo nombre con distinto `itemType` → items distintos.
- Items con el mismo `name+itemType` pero `technicalSpecs` distintos (hash canónico: trim valores, descartar vacíos, sort keys, JSON.stringify) → variantes "Config A", "Config B", etc. Solo se etiquetan cuando hay ≥2 variantes en el grupo.
- Items diluidos no entran (ya excluidos por `scenario.visibleItems`). Un item visible en al menos un escenario entra una sola vez.

**Orden:** primero las variantes que aparecen en el primer escenario, en su orden de `visibleItems`; luego las que aparecen por primera vez en escenarios posteriores.

**Render:**
- `TechnicalSpecSheet.tsx` ya no muestra precio (vive solo en la económica) ni nombre del escenario en el subtítulo. El header pasa a "Item N de M" + pill `Config X` opcional. El badge "Gravado/No Gravado" se mueve al lado del nombre del item como info técnica.
- `EconomicProposalTable.tsx` recibe `variantLabelByScenarioItemId` y appendea ` — Config X` al nombre cuando aplica, para que el cliente pueda distinguir variantes en la cotización.
- `IndexPageContent` genera una sola entrada "Propuesta Técnica" en el índice (en vez de una por escenario).
- `VirtualSectionPreview.tsx` (preview en pantalla del constructor) y el contador del sidebar de `ProposalDocBuilder.tsx` consumen el mismo helper vía `useMemo`, para mantener consistencia entre lo que se ve en pantalla y lo que sale en el PDF.
- La consolidación en `PdfPreviewModal.tsx` se calcula con `useMemo` derivado de `processedScenarios`, no con `useState`, para que esté disponible desde el primer render y funcione aunque la propuesta no tenga página INDEX.

### Consecuencias

- **Retroactivo:** el cambio es 100% en la capa de render. Las propuestas existentes en la base de datos no se migran; al regenerar el PDF salen con el nuevo formato automáticamente.
- **Sin precio en la ficha técnica:** decisión consciente para evitar duplicar información que ya vive en la Propuesta Económica. La separación queda más limpia: la técnica describe el qué, la económica describe el cuánto.
- **Variantes etiquetadas en ambos lados:** garantiza trazabilidad cuando un mismo nombre tiene specs distintos. El cliente puede mapear `Laptop Dell — Config A` de la económica a la ficha técnica con badge `Config A`.
- **Helper reutilizable:** la lógica de consolidación es función pura sin dependencias de React, y se reutiliza en tres puntos (PdfPreviewModal, VirtualSectionPreview, ProposalDocBuilder sidebar) sin duplicación.
- **Performance:** la consolidación es O(items) en cada escenario, agrupada en un Map. No hay impacto perceptible para propuestas con cientos de items.

## ADR-026 — Configuración global del timeout de inactividad por sesión

**Fecha:** 2026-05-10
**Estado:** Aceptado
**Contexto:** El cierre automático de sesión por inactividad estaba hardcoded en el frontend (`apps/web/src/hooks/useInactivityTimeout.ts`, constante `INACTIVITY_LIMIT_MS = 5 * 60 * 1000`). Cualquier ajuste requería un commit + redeploy. Se necesita que el administrador pueda modificar este tiempo desde la UI, aplicando para todos los usuarios.

**Decisión:** 
1. Crear tabla genérica `AppSetting` (modelo Prisma `AppSetting` con `@@map("app_settings")`) clave-valor con `key UNIQUE`, `value` string, `description`, `updatedAt`, `updatedById` (FK a `users` con `ON DELETE SET NULL`). El diseño es extensible: en el futuro otros settings globales (validez por defecto, footers de PDF, etc.) usan la misma tabla.
2. Backend: módulo nuevo `apps/api/src/app-settings/` con dos endpoints:
   - `GET /app-settings/inactivity-timeout` (`JwtAuthGuard`) — cualquier autenticado.
   - `PATCH /app-settings/inactivity-timeout` (`JwtAuthGuard + AdminGuard`) — admin only.
   Body validado con `class-validator`: `IsInt + Min(2) + Max(60)`. Service hace upsert idempotente para garantizar que la key siempre existe (default 5).
3. Constante de dominio: clave fija `inactivity_timeout_minutes` exportada como `INACTIVITY_TIMEOUT_KEY` desde el service (no magic string).
4. Frontend: 
   - `authStore` extendido con `inactivityTimeoutMinutes: number | null` y action `loadInactivityTimeout` que hace el GET, valida rango [2, 60] y persiste en localStorage (`inactivity_timeout_minutes`).
   - `useInactivityTimeout` lee del store, calcula `inactivityLimitMs` dinámicamente y reinicia timers cuando el valor cambia. Fallback a 5 min si el GET falló o el valor es inválido.
   - `Login.tsx` dispara `loadInactivityTimeout()` después del login (con o sin 2FA), antes de navegar al dashboard.
   - `App.tsx` dispara la carga tras `checkAuth()` cuando rehidrata sesión sin caché en localStorage.
5. UI admin: nueva página `apps/web/src/pages/admin/SettingsAdmin.tsx` (ruta `/admin/settings` bajo `AdminRoute`), un solo campo numérico hoy con validación cliente espejo del backend. Al guardar, dispara `loadInactivityTimeout()` para que el cambio aplique de inmediato a la sesión actual del admin. El ítem "Configuración" del sidebar (que ya existía apuntando a `/settings` muerto) ahora apunta a la ruta nueva.

**Alcance:** El cambio del setting NO se refleja en sesiones ya abiertas de otros usuarios. Aplica al próximo login de cada usuario, o al recargar la app si la rehidratación de sesión dispara `loadInactivityTimeout` (caso sin caché). Para el admin que está editando, sí aplica de inmediato porque la UI llama explícitamente a `loadInactivityTimeout` post-guardado.

**Patrón visual:** Sin librería de toast (el proyecto no tiene react-hot-toast ni sonner). Mensajes inline con auto-clear vía `setTimeout`, mismo patrón que `DefaultPagesAdmin.tsx` (`savedMsg`).

**Migración:** `20260510181712_add_app_settings`. Seed extendido para upsert idempotente de `inactivity_timeout_minutes = 5` con descripción.

**Commits:**
- `387f88a` — backend: modelo + endpoints + seed
- `2af9020` — frontend: consumo del setting + refactor de useInactivityTimeout
- `3c5b5dd` — frontend: UI admin de configuración

## ADR-027 — Paginación de la propuesta económica en el PDF

**Fecha:** 2026-05-11
**Estado:** Cerrado (superseded por ADR-029)

### Contexto
El PDF se genera client-side con html2canvas-pro + jsPDF en `PdfPreviewModal.tsx`, capturando cada `[data-pdf-page]` (1056px de alto, `overflow: hidden`) como imagen. `EconomicProposalTable` renderizaba todos los `visibleItems` de un escenario más el bloque de totales en una sola hoja, y cuando los items no cabían, el contenido se recortaba visualmente sin emitir nuevas páginas (html2canvas no maneja paginación nativa).

### Decisión
Introducir paginación lógica en el DOM: el escenario se parte en N slices antes de renderizarse, y cada slice produce su propio `VisualPage` con su `[data-pdf-page]`. El loop existente que captura una hoja PDF por `[data-pdf-page]` queda intocado.

- Helper puro `paginateEconomicProposal(scenario): EconomicPageSlice[]` en `apps/web/src/lib/paginateEconomicProposal.ts`. Es lógica de presentación, no financiera; no va al pricing-engine.
- Límites por página en `ECONOMIC_PDF_PAGINATION` (constants.ts), valores conservadores 7/10/12/7: SINGLE_PAGE_MAX_ITEMS, FIRST_PAGE_ITEMS, MIDDLE_PAGE_ITEMS, LAST_PAGE_ITEMS.
- Regla de la última hoja: siempre lleva items + totales. Nunca hay hoja huérfana solo con totales. Si el remanente tras la primera y las intermedias excede LAST_PAGE_ITEMS, se promueve una intermedia adicional.
- Header indigo grande solo en `isFirstSlice`; en continuaciones, header compacto con sufijo "— Continuación". El `<thead>` con columnas se repite en cada slice por estar dentro del componente.
- Cada escenario sigue arrancando en hoja propia (el primer slice del siguiente escenario tiene `isFirstSlice: true`).

### Consecuencias
- Positivas: filas no se cortan a mitad, totales nunca quedan huérfanos, `IndexPageContent` no requiere cambios porque ya filtra `isContinuation`.
- Negativas: límites por página fijos (no medidos dinámicamente), pueden generar desperdicio si las filas son cortas. Aceptable como primera iteración; los números son ajustables en una sola constante.
- Patrón reutilizable: si más adelante `TechnicalSpecSheet` u otra sección desborda, se aplica el mismo enfoque (helper puro de slicing + `VisualPage` por slice + componente consciente de `isFirstSlice` / `showTotals`).

### Archivos
- `apps/web/src/lib/constants.ts` (+`ECONOMIC_PDF_PAGINATION`)
- `apps/web/src/lib/paginateEconomicProposal.ts` (nuevo)
- `apps/web/src/components/proposals/EconomicProposalTable.tsx`
- `apps/web/src/components/proposals/PdfPreviewModal.tsx`

### Pendientes
- Validar contra propuestas con muchos items (>30) en producción.
- ~~Considerar medición dinámica de altura si los valores fijos generan desperdicio notorio.~~ Resuelto en ADR-029.
## ADR-028 — Persistencia de `unitPriceOverride` para evitar round-trip de precisión

**Estado:** Aceptada e implementada
**Fecha:** 2026-05-11

### Contexto

En la pantalla de cálculos, al editar el precio unitario de un ítem, el flujo previo era:

1. Frontend toma el precio escrito.
2. Calcula `marginPct = calculateMarginFromPrice(price, effectiveLandedCost)`.
3. Persiste solo `marginPctOverride` (`Decimal(10, 4)`).
4. En el siguiente render, `calculateItemDisplayValues` recalcula `unitPrice = effectiveLandedCost * (1 + marginPctOverride / 100)`.

El paso (4) introducía pérdida de precisión: aunque `marginPctOverride` tiene 4 decimales y los `Number` de JS son float64, el costo efectivo suele tener decimales largos por conversión TRM y dilución, y el margen redondeado no permitía reconstruir el precio exacto que el usuario tecleó. Resultado: el usuario tecleaba `1500` y veía `1499.99...`.

El schema ya definía dos columnas no usadas: `unitPriceOverride Decimal(15,2)` y `unitCostOverride Decimal(15,2)`. La columna existía en DB pero el código nunca la leía ni la escribía.

### Decisión

Cablear `unitPriceOverride` end-to-end. Cuando el usuario edita el precio unitario, persistimos el valor directo. El pricing-engine lo respeta como fuente de verdad del precio:

- Si `unitPriceOverride != null`: `unitPrice = Number(si.unitPriceOverride)` y el margen mostrado se deriva inverso vía `calculateMarginFromPrice` solo para display, sin persistirlo.
- Si `unitPriceOverride == null`: comportamiento previo (precio derivado de `marginPctOverride` o `item.marginPct`).

**Regla de "última acción manda"**: cualquier acción que invalida la suposición de "precio fijo" limpia el override automáticamente:

- Editar el margen ítem por ítem → `PATCH { marginPct, unitPriceOverride: null }`.
- Aplicar margen global al escenario → `applyMarginToEntireScenario` setea `unitPriceOverride: null` en todos los items en la misma `updateMany`.
- Cambiar la moneda del escenario → `updateScenario` envuelve el cambio en una `$transaction` Prisma que primero hace `scenarioItem.updateMany({ where: { scenarioId }, data: { unitPriceOverride: null } })` y luego el `scenario.update` con la moneda nueva.

`unitCostOverride` queda fuera de scope: no se usa en ningún sitio y no hay caso de uso documentado.

### Implementación

**Backend** (`apps/api`):
- `UpdateScenarioItemDto` acepta `unitPriceOverride?: number | null` con `@IsOptional() + @ValidateIf(v !== null) + @IsNumber()`.
- `scenarios.service.ts::updateScenarioItem` persiste con el patrón `data.unitPriceOverride === undefined ? undefined : data.unitPriceOverride` para distinguir "no tocar" (undefined) de "limpiar" (null) de "fijar" (number).
- `cloneScenario` propaga `unitPriceOverride` tanto en items raíz como en hijos (sin esto los overrides se perdían al clonar).

**Frontend** (`apps/web`):
- `unitPriceOverride` agregado al tipo `ScenarioItem` en `lib/types.ts` y a la interfaz interna del pricing-engine.
- `calculateItemDisplayValues` y `calculateScenarioTotals` respetan el override como precio canónico cuando está presente; el margen de display se deriva inverso.
- `updateUnitPrice` simplificado: PATCH directo `{ unitPriceOverride: val }`, sin cálculo inverso de margen.
- Nueva acción `clearUnitPriceOverride(siId)` expuesta por el hook.
- `ScenarioItemRow.tsx` muestra indicador visual (badge "fijo" + ícono de candado + fondo indigo) y botón ✕ para limpiar el override cuando está activo.

### Consecuencias

- Round-trip de precisión eliminado de raíz. Lo tecleado es lo persistido y lo mostrado. Display sigue formateado a 2 decimales.
- `pricing-engine.ts` mantiene su rol de fuente única; el nuevo branch del override vive ahí.
- Los registros existentes (`unitPriceOverride = NULL`) no cambian de comportamiento.
- El override desaparece en cualquier cambio de contexto del escenario (moneda, margen global, margen item). El usuario que necesite un precio fijo en el nuevo contexto lo re-aplica.
- Casos cubiertos por las transacciones atómicas: si el `update` del escenario falla, los overrides no quedan limpiados a medias.

### Alternativas consideradas

- **Subir precisión de `marginPctOverride` a `Decimal(10, 6)` o más**: mitiga pero no cura. Siempre habrá un costo efectivo que requiera más decimales. Descartado.
- **Convertir `unitPriceOverride` al cambiar moneda en lugar de limpiarlo**: introduce ambigüedad sobre qué TRM usar para la conversión y des-conversión. Si la TRM del día cambia, el número persistido pierde significado. Descartado.
- **Persistir `unitPriceOverrideCurrency` junto al override**: viable pero pesado (migración + propagación end-to-end). No hay caso de uso documentado que lo justifique hoy. Diferido.
- **Eliminar `marginPctOverride`**: rompe la aplicación de margen global y la edición de margen ítem por ítem. Descartado.

## ADR-029 — Paginación height-aware de la propuesta económica en el PDF

**Fecha:** 2026-05-14
**Estado:** Cerrado
**Supersede:** ADR-027 (enfoque de paginación por conteo fijo)

### Contexto
ADR-027 paginó la propuesta económica cortando los slices por conteo fijo de items (`ECONOMIC_PDF_PAGINATION`, 7/10/12/7). El supuesto de altura uniforme por fila no se sostiene: nombres de item largos envuelven en varias líneas y la descripción rápida + U.M varían la altura real del `<tr>`. Un slice válido por conteo podía renderizar más alto que los 1056px del `[data-pdf-page]`, y html2canvas lo recortaba. Síntoma: el preview web se veía completo pero el PDF descargado se cortaba al final, perdiendo filas y/o el bloque de totales.

### Intento fallido previo (registrado para no repetirlo)
Antes del fix definitivo se intentó (commit `c453a77`, revertido en `d96c405`) cambiar las opciones de html2canvas en `generatePdf` para usar `el.offsetWidth` / `el.offsetHeight` y `windowWidth` apuntando al viewport real, en vez de los valores hardcoded 816 / `PAGE_HEIGHT`. Resultado: el PDF salió sin estilos Tailwind (sin header oscuro, sin bordes, sin zebra). Causa: `windowWidth` apuntando al viewport real impide que el clon interno de html2canvas resuelva el CSS. Conclusión: las dimensiones de captura de html2canvas deben quedar fijas; el problema de desborde se resuelve en la paginación, no en la captura.

### Decisión
Hacer `paginateEconomicProposal` height-aware: medir la altura real de cada fila en el DOM y cortar las hojas por altura acumulada, no por conteo.

- Nueva firma: `paginateEconomicProposal(scenario, rowHeights: Map<string, number>)`. Sigue siendo helper puro de presentación; no va al pricing-engine.
- Medición: `PdfPreviewModal` monta un contenedor oculto (`economicMeasureRef`) que renderiza un `EconomicProposalTable` por escenario con un slice de medición (todos los `visibleItems`, `showTotals: false`). Cada `<tr>` lleva `data-measure-row={scenarioItem.id}`. Un `useEffect` lee las alturas reales con `getBoundingClientRect()` y las pasa a estado (`rowHeights`); `buildVisualPages` depende de `rowHeights` y se redispara cuando la medición está lista.
- Algoritmo de dos pasadas: (1) empaquetar filas por altura acumulada contra el budget de la hoja — una fila sola siempre entra aunque exceda, para evitar loop infinito; (2) acomodar el bloque de totales en la última hoja, empujando filas a una hoja nueva si no cabe, con corte de seguridad a 1 fila.
- Bloques fijos (headers, `<thead>`, bloque de totales) no se miden: se estiman con constantes `ECONOMIC_PDF_HEIGHTS` en constants.ts. `ECONOMIC_PDF_PAGINATION` se eliminó.
- Las constantes se recalibraron con alturas reales medidas en el DOM tras detectar que los valores iniciales estimados causaban corte (header de continuación y `<thead>` subestimados) y hojas de una sola fila (bloque de totales sobreestimado). Valores finales: `USABLE_HEIGHT` 928, `FIRST_SLICE_HEADER_HEIGHT` 88, `CONTINUATION_HEADER_HEIGHT` 88, `TABLE_HEAD_HEIGHT` 80 (incluye margen inferior de la tabla), `TOTALS_BLOCK_HEIGHT` 256, `FALLBACK_ROW_HEIGHT` 80.

### Consecuencias
- Positivas: los slices respetan la altura real de página; el corte en el PDF desaparece. El reparto se ajusta solo a contenido de filas variable.
- Negativas: los bloques fijos siguen estimados, no medidos; si su diseño cambia (tipografía, padding del header o del bloque de totales) hay que recalibrar `ECONOMIC_PDF_HEIGHTS`. La medición agrega un render oculto extra por escenario.
- Patrón: la medición en contenedor oculto + helper puro de slicing es reutilizable si otra sección tabular del PDF desborda.

### Archivos
- `apps/web/src/lib/paginateEconomicProposal.ts` (reescrito: firma + algoritmo height-aware)
- `apps/web/src/components/proposals/PdfPreviewModal.tsx` (contenedor de medición, estado `rowHeights`, wiring)
- `apps/web/src/components/proposals/EconomicProposalTable.tsx` (atributo `data-measure-row`)
- `apps/web/src/lib/constants.ts` (+`ECONOMIC_PDF_HEIGHTS`, −`ECONOMIC_PDF_PAGINATION`)

### Commits
- `7be02f1` — paginación height-aware (algoritmo + medición)
- `1417fd6` — recalibración de `ECONOMIC_PDF_HEIGHTS` con valores medidos

### Pendientes
- Validar contra propuestas con muchos items (>30) en producción.

## ADR-030 — Campo sortOrder en ScenarioItem para orden estable de items

**Fecha:** 2026-05-29
**Estado:** Cerrado

### Contexto
El endpoint `GET /proposals/:id/scenarios` devolvía los `scenarioItems` sin orden explícito: el `include` anidado no tenía `orderBy`. La pantalla de cálculos (`useScenarios.ts`) mantiene el orden en memoria de forma estable porque todas sus operaciones usan `.map()`/`.filter()` (nunca reordena), pero el PDF (`useProposalScenarios.ts`) re-consulta el endpoint, y tras un PATCH sobre un item Postgres devolvía las filas en otro orden físico (MVCC: un UPDATE reescribe el tuple). Síntoma: el usuario ordenaba los items en cálculos y en el PDF aparecían en distinto orden.

`ScenarioItem` no tenía ningún campo de orden (ni `sortOrder` ni `createdAt`), por lo que no había forma de expresar "orden de inserción" de forma estable ni de soportar reordenamiento manual.

### Decisión
Agregar `sortOrder Int @default(0) @map("sort_order")` a `ScenarioItem`, con índice compuesto `@@index([scenarioId, sortOrder])` para que el `orderBy` sea eficiente.

- El orden aplica solo a items padre (`parentId = null`). Los children son sub-items de costo: están atados al padre por `parentId`, suman al landed cost vía el pricing-engine, y no se renderizan como filas propias en el PDF ni se ordenan por `sortOrder`. Al mover un padre, sus children lo siguen por la relación, no por posición.
- `@default(0)` (no nullable): el `orderBy` siempre necesita un valor presente, y cubre cualquier item creado antes de que el backend asigne el orden real.
- Backfill embebido en la migración (no script aparte), porque las migraciones de este proyecto corren solas en Railway vía el `CMD` del Dockerfile. El backfill usa `ROW_NUMBER() OVER (PARTITION BY scenario_id ORDER BY id)` filtrando `parent_id IS NULL`.

Alcance de este ADR: solo el campo, el índice y el backfill. La asignación de `sortOrder` al insertar items y el `orderBy` en los fetch son trabajo de backend posterior (mismo esfuerzo, commits separados). El reordenamiento manual (drag-and-drop) queda como fase futura encima de este cimiento.

### Consecuencias
- Positivas: existe un campo para ordenar items de forma estable y, a futuro, reordenables manualmente. El índice compuesto hace el `orderBy` eficiente sin escaneo.
- Negativas: el backfill de los registros históricos ordena por `id` (UUID), que no refleja el orden de inserción real — para propuestas viejas el orden queda estable pero arbitrario. Es aceptable: las propuestas nuevas tendrán el orden correcto desde el inicio, y la data histórica no guardó el orden original de ninguna forma recuperable.
- El campo queda sin uso hasta el trabajo de backend; en ese estado intermedio es inofensivo (default 0, ningún consumidor lo lee aún).

### Archivos
- `apps/api/prisma/schema.prisma` (+campo `sortOrder`, +`@@index([scenarioId, sortOrder])`)
- `apps/api/prisma/migrations/20260529000000_add_scenario_item_sort_order/migration.sql` (nuevo: ALTER + CREATE INDEX + backfill con ROW_NUMBER)

### Commits
- `4b7a6ef` — campo sortOrder + migración con backfill
- `50935f7` — backend: orderBy en fetch + asignación de sortOrder al insertar

### Pendientes
- Frontend: verificado — ambos hooks consumen el endpoint ordenado y ninguno reordena; sin cambios necesarios.
- Fase futura: endpoint de reorden + UI de items padre — **Resuelto en ADR-031** (se implementó con botones ↑/↓ en lugar de drag-and-drop).

## ADR-031 — Reordenamiento manual de items de escenario con botones ↑/↓

**Fecha:** 2026-05-29
**Estado:** Cerrado. Supersede la "fase futura" anticipada en ADR-030 (§Pendientes).

### Contexto
ADR-030 dejó el cimiento (`sortOrder` en `ScenarioItem`, índice, backfill, `orderBy` en los fetch y asignación al insertar) y anticipó como fase futura el reordenamiento manual mediante drag-and-drop, apoyándose en el patrón `/reorder` de páginas y bloques.

Al planear la UI se revisó cómo el doc builder reordena páginas: NO usa drag-and-drop, sino botones discretos ↑/↓ (`movePage` hace swap en el array y llama al endpoint; el `GripVertical` es decorativo y el `motion.div layout` solo anima el cambio de posición). No existía DnD que clonar. Se optó por replicar el patrón de botones por consistencia con la pantalla hermana y menor riesgo (KISS), descartando introducir una librería de DnD que dejaría dos patrones de reorden distintos.

### Decisión
**Backend** — endpoint `PATCH scenarios/:scenarioId/items/reorder`, clonando `reorderBlocks` (`pages.service.ts`):
- DTO `ReorderScenarioItemsDto` con `itemIds: string[]` (mismos validadores que `ReorderBlocksDto`).
- Ownership vía `verifyScenarioOwnership` (gemelo de `verifyPageOwnership`).
- Guard de pertenencia antes de la transacción: `count` de items que matcheen `{ id in itemIds, scenarioId, parentId: null }` debe igualar `itemIds.length`; si no, `BadRequestException`. Blinda contra IDs de otro escenario, children colados e IDs inexistentes o duplicados (Fail Fast).
- Transacción que reescribe `sortOrder` 1-based según el índice del array.
- Seguridad idéntica a los hermanos (`@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()`, `ParseUUIDPipe` en `scenarioId`).

**Frontend** — botones ↑/↓ en la pantalla de cálculos:
- Solo items padre NO diluidos. Los diluidos no se renderizan como filas en el PDF (su precio se distribuye en otros items vía el pricing-engine), su orden es irrelevante y no reciben botones.
- Sin restricción de bordes: ambas flechas siempre activas; un clic en un extremo es inocuo (el guardado vive dentro de `moveItem`). Se descartó deshabilitar flechas en los bordes por preferencia de UX.
- El render ordena por `sortOrder` dentro de cada grupo de dilución: el comparador del `.sort` en `ProposalCalculations.tsx` mantiene los diluidos arriba y desempata por `sortOrder` (antes devolvía `0`, dejando el orden a merced del orden físico del array).

**Persistencia con debounce** — `reorderItems` en `useScenarios.ts`:
- Optimismo síncrono e inmediato (la fila se mueve en cada clic); el PATCH se difiere con `setTimeout` (constante local `SCENARIO_REORDER_DEBOUNCE_MS = 700`): una ráfaga de clics cancela los timers previos y dispara un único PATCH con el orden final. `useEffect` de cleanup hace flush al desmontar.
- Razón: reordenar es una acción "ráfaga"; un PATCH por clic saturaba el rate limit global (30/min, §K) → 429. Se trató la causa (requests redundantes), no el síntoma; no se tocó el rate limit por ser una medida de seguridad real.

### Bugs encontrados y resueltos
**Bug 1 — `sort_order` duplicados en datos históricos.** El backfill original de ADR-030 (`ROW_NUMBER() ... ORDER BY id`) no garantizaba unicidad mantenida en el tiempo: items con el `@default(0)` de la columna reintrodujeron duplicados (en prod: 4 padres en `sort_order=0` en un escenario, 2 en `sort_order=3` en otro). Con `sort_order` repetido el `.sort` no desempata y el reorden se comporta de forma errática. Solución: re-backfill manual `UPDATE ... ROW_NUMBER() OVER (PARTITION BY scenario_id ORDER BY sort_order, id)` filtrando `parent_id IS NULL`, que renumera 1..N por escenario respetando el orden visible actual. Corrido en local (`prisma db execute`) y en prod (`psql` en transacción manual con verificación previa al `COMMIT`, tras `pg_dump` completo de respaldo). One-shot, sin `.sql` versionado, para evitar que una re-ejecución futura pise el orden manual.

**Bug 2 — `moveItem` operaba sobre el orden físico.** La primera versión filtraba `scenarioItems` en orden físico para calcular la posición del swap, pero el render mostraba la lista ordenada por `sortOrder`; un clic saltaba de posición 1 a 3. Corregido ordenando `visible`/`diluted` por `sortOrder` antes de calcular la posición.

### Consecuencias
- Positivas: reorden manual persistente reflejado en el PDF; el debounce reduce una ráfaga de clics a un solo request sin debilitar el rate limit; datos con `sort_order` único y consistente por escenario en local y prod.
- Deuda / supuesto: el reorden depende de que `sort_order` sea secuencia única por escenario. Lo es porque `addScenarioItem` asigna correlativo y `reorderItems` reescribe la secuencia completa; si un path futuro inserta padres sin asignar `sortOrder`, reaparecería el Bug 1. El re-backfill no quedó versionado.

### Archivos
- `apps/api/src/proposals/dto/proposals.dto.ts` (+`ReorderScenarioItemsDto`)
- `apps/api/src/proposals/scenarios.service.ts` (+`reorderScenarioItems`)
- `apps/api/src/proposals/proposals.controller.ts` (+endpoint reorder)
- `apps/web/src/hooks/useScenarios.ts` (+`reorderItems` con debounce, +`SCENARIO_REORDER_DEBOUNCE_MS`)
- `apps/web/src/pages/proposals/ProposalCalculations.tsx` (comparador por `sortOrder`, `moveItem`)
- `apps/web/src/pages/proposals/components/ScenarioItemRow.tsx` (botones ↑/↓)

### Commits
- `939b4af` — backend: endpoint de reorden de items de escenario
- `8ea52e0` — frontend: botones ↑/↓ + persistencia con debounce

### Backups
- `backups/pre-sortorder-backfill-2026-05-29/railway-full.dump` (243 MB, `pg_dump --format=custom` de prod, previo al re-backfill)

### Pendientes
- Ninguno. Si a futuro se quiere DnD real, migrar ambas pantallas (cálculos y doc builder) juntas para no dejar patrones inconsistentes.

## ADR-032 — Agrupación de propuestas por versión en el dashboard

**Fecha:** 2026-05-30
**Estado:** Cerrado

### Contexto
Las versiones de una misma cotización (`COT-LMA05003-1`, `COT-LMA05003-2`) son registros `Proposal` separados. No existe campo de grupo en el schema (`proposal_code` es `@unique`; `current_version` y la relación `ProposalVersion[]` con `snapshot_data` son un mecanismo distinto, para snapshots/PDF de UNA propuesta, sin relación con este versionado). El único vínculo entre versiones de una cotización es el prefijo del `proposalCode`.

El dashboard las listaba como filas independientes, cuando conceptualmente son la misma cotización. Además, `computeBillingCards` y el bloque de pipeline en `useDashboard.ts` sumaban sobre `filtered` (TODAS las versiones), produciendo doble conteo latente de una misma cotización cuando dos versiones tenían estado + fecha que contaban. Hoy no se manifestaba porque las versiones de prueba estaban en ELABORACION sin `closeDate` (el pipeline exige `closeDate`), pero era una regresión esperando ocurrir.

### Decisión
Agrupar las propuestas por código base derivado del `proposalCode`, en la capa de derivación y presentación, sin tocar backend ni schema.

- **Helper puro** `apps/web/src/lib/proposalGrouping.ts`: `parseProposalCode(code)` (regex `/^(.+)-(\d+)$/`, con guard defensivo: si no matchea, `baseCode = code` y `version = 1`); `groupProposalRows<T extends { code: string }>(rows)` genérico, que preserva el orden de primera aparición de cada grupo (via `Map`) y ordena las versiones desc por número. Tipos co-localizados (`ParsedProposalCode`, `ProposalVersionGroup<T>`), no en `types.ts` (precedente: `MinSubtotalResult` en pricing-engine). NO va al pricing-engine (sección J): no calcula landed cost, dilución, margen ni precio, solo agrupa y ordena registros.
- **Versión activa** de un grupo = la de mayor sufijo `-N`. Justificación de negocio: las cotizaciones tienen vigencia corta, por lo que al nacer una versión nueva la anterior ya venció y se considera superada; no hay riesgo real de ocultar una venta ganada en una versión vieja.
- **Valor del grupo**: el de su versión activa, que sigue siendo el mínimo entre sus escenarios vía `getDashboardAmount` (sin cambios). La agrupación elige *qué* propuesta representa al grupo; el "mínimo de escenarios" ya estaba resuelto. No se introdujo cálculo financiero nuevo.
- **Derivación en `useDashboard.ts`**: `proposalGroups` (de `filtered` sin proyecciones), `filteredProjectionRows` (proyecciones de `filtered`), y `activeRows` = versión activa de cada grupo + proyecciones. `billingCardsVenta/Daas` y el pipeline pasan a consumir `activeRows` en vez de `filtered` (el interior de `computeBillingCards` no cambió, solo su argumento). Filtrar ocurre antes de agrupar.
- **UI** (`Dashboard.tsx` + dos componentes nuevos en `pages/dashboard/components/`): grupos de 1 versión → fila directa con acciones; grupos de 2+ → cabecera colapsable de solo lectura (`ProposalGroupHeaderRow`) con los datos de la versión activa y badge/conteo, que al expandir muestra cada versión (`ProposalVersionRow`, prop `isChild` para indentación) con sus acciones. Estado de expansión (`expandedGroups: Set<string>`) es estado de UI local en `Dashboard.tsx`. Los componentes no importan `api`; reciben callbacks por props (sección B). Las proyecciones NO se agrupan.

Se descartó **agregar un campo `versionGroupId` a `Proposal`** (+ migración + backfill de existentes): más robusto, pero cruza backend/DB/frontend y deja de ser render-only. El parseo del prefijo es suficiente mientras todos los `proposalCode` terminen en `-<versión>` (confirmado por el dueño del proyecto, incluidos los de origen `MANUAL`). Se descartó también **agrupar en el backend** (endpoint anidado) por over-engineering: no hay datos que el frontend no pueda derivar.

### Consecuencias
- Positivas: tabla y cards/pipeline quedan coherentes por construcción (ambos miran la versión activa de cada grupo); se corrige el doble conteo latente. Sin cambios de schema, backend ni pricing-engine: todo vive en derivación (`useDashboard`) y presentación.
- Negativas: cambia la semántica de los totales del dashboard — en escenarios con múltiples versiones contables las cifras de cards/pipeline pueden bajar respecto a antes. Es el comportamiento correcto, no una regresión, pero altera números que un usuario podría haber estado observando.
- Deuda / supuesto: dependencia frágil del formato de `proposalCode`. Si a futuro se introdujeran códigos sin sufijo `-N`, el guard los trata como grupo propio de versión 1 (no rompe el render, pero no agrupa). Si esto se vuelve problema, migrar al campo `versionGroupId` con su propio ADR.

### Archivos
- `apps/web/src/lib/proposalGrouping.ts` (nuevo: `parseProposalCode`, `groupProposalRows`, tipos `ParsedProposalCode` y `ProposalVersionGroup<T>`)
- `apps/web/src/hooks/useDashboard.ts` (+`proposalGroups`, `filteredProjectionRows`, `activeRows`; cards/pipeline consumen `activeRows`)
- `apps/web/src/pages/Dashboard.tsx` (estado `expandedGroups` + `toggleGroup`; `<tbody>` itera `proposalGroups` + `filteredProjectionRows`)
- `apps/web/src/pages/dashboard/components/ProposalVersionRow.tsx` (nuevo: fila de propuesta extraída, prop `isChild`)
- `apps/web/src/pages/dashboard/components/ProposalGroupHeaderRow.tsx` (nuevo: cabecera colapsable de solo lectura)

### Commits
- `<completar con el hash tras el commit>` — feat(dashboard): agrupar propuestas por versión con cabecera colapsable

### Pendientes
- Ninguno. Migración futura a `versionGroupId` solo si aparecen códigos sin sufijo de versión.

**Addendum (2026-05-30):** En el dashboard, las filas de versiones anteriores
(`v.id !== group.activeVersion.id`) muestran sus 4 controles de datos editables
—fecha de cierre, adquisición, estado y fecha de facturación condicional— en
estado `disabled`: visibles para conservar el valor histórico de un vistazo,
pero no editables, dado que ya existe una versión vigente. Las acciones
(edit / clone versión / clone nueva / delete) permanecen habilitadas.
Implementado con un prop `isActiveVersion` (default `true`, fail-safe) en
`ProposalVersionRow`. Commit af57572.

## ADR-033 — Consolidación de columnas del dashboard en celdas compuestas (fechas y valores)

**Fecha:** 2026-05-31
**Estado:** Cerrado

### Contexto
La tabla del dashboard (construida en ADR-032) tenía 12 columnas (admin) / 11 (comercial). El usuario dependía del scroll horizontal para ver las columnas, en particular la de acciones, que estaba al final. Tres tipos de fila comparten la misma grilla del `<thead>`: `ProposalVersionRow`, `ProposalGroupHeaderRow` (ambos de ADR-032) y la fila inline de proyección en `Dashboard.tsx`; cualquier cambio de estructura toca las tres o desalinea la tabla.

`formatSubtotalWithCurrency` estaba triplicado (Dashboard + las dos filas), violando DRY (§2). No existía ordenamiento por columna (los `<th>` son texto plano sin `onClick` ni estado de sort), por lo que fusionar columnas no elimina ninguna capacidad de ordenamiento.

### Decisión
Dos celdas presentacionales puras reutilizables en `pages/dashboard/components/` (§B), consumidas por las tres filas: `ProposalDatesCell` (grid 2×2 de cierre/emisión/vigencia/actualización) y `ProposalValueCell` (stack vertical de subtotal + USD). No importan `useDashboard`, `DashboardRow` ni calculan nada financiero: reciben todo por props, y el caller pasa `usdEstimate` ya calculado con `getSubtotalUsd`. NO van al pricing-engine (§J): no calculan landed cost, dilución, margen ni precio, solo presentan.

- Consolidación de columnas: 4 de fecha → 1, 2 de valores → 1; columna de acciones movida al inicio. Resultado: 8 columnas (admin) / 7 (comercial).
- `ProposalDatesCell` modela cierre editable vs. solo lectura según la presencia del callback `onCloseDateChange` (data-driven, §B): `ProposalVersionRow` lo pasa, con `closeDateDisabled={!isActiveVersion}` reutilizando el mecanismo del addendum de ADR-032; `ProposalGroupHeaderRow` y la fila de proyección no lo pasan → cierre solo lectura. Las props de fecha son nullable (`closeDate?/issueDate?/validityDate?: string | null`) para que la misma celda sirva a proyecciones, que no tienen esas fechas (→ guion).
- `formatSubtotalWithCurrency` deduplicado: única copia en `ProposalValueCell`; las tres copias previas eliminadas.
- `billingDate` (fecha de facturación naranja) permanece bajo la columna Estado, intacta — no entra a la celda de fechas.

Se descartó **sticky-left** de la columna de identidad (Código/Cliente): bajar de 12 a 8 columnas se estimó suficiente para eliminar el scroll, y sticky agrega complejidad real (z-index, fondos, interacción con `overflow-x-auto`) sin beneficio confirmado; se evalúa solo si el scroll persiste. Se descartó también reemplazar el **ordenamiento por columna** con un selector de orden: no existía sort por columna, no se perdió nada al fusionar.

### Consecuencias
- Positivas: la tabla pasa de 12/11 a 8/7 columnas, eliminando el scroll horizontal; queda establecido el patrón de celda compuesta reutilizable para futuras filas de la tabla; helper deduplicado (DRY). Sin cambios en `useDashboard.ts`, pricing-engine ni backend: todo vive en presentación.
- Negativas / deuda: las tres filas quedan acopladas por construcción al orden de columnas del `<thead>` de `Dashboard.tsx`; deben mantenerse sincronizadas. Una cuarta fila futura en esta tabla debe consumir las mismas celdas y respetar el mismo orden.
- La fila de proyección pasa `null` en cierre/emisión/vigencia y omite `isManual` (no aplica) → guiones e indicador `~` ausente, idéntico al comportamiento previo.

### Archivos
- `apps/web/src/pages/dashboard/components/ProposalDatesCell.tsx` (nuevo: celda grid 2×2 de fechas)
- `apps/web/src/pages/dashboard/components/ProposalValueCell.tsx` (nuevo: celda stack subtotal + USD; única copia de `formatSubtotalWithCurrency`)
- `apps/web/src/pages/dashboard/components/ProposalVersionRow.tsx` (consume ambas celdas; acciones al inicio; −helper local; imports limpiados)
- `apps/web/src/pages/dashboard/components/ProposalGroupHeaderRow.tsx` (consume ambas celdas; acciones al inicio; −helper local; imports limpiados)
- `apps/web/src/pages/Dashboard.tsx` (`<thead>` reordenado a 8/7; fila de proyección refactorizada; `colSpan` 8/7; −helper)

### Commits
- `<completar con el hash tras el commit>` — feat(dashboard): consolidate table columns into composite date and value cells

### Pendientes
- Sticky-left de la columna de identidad: solo si el scroll horizontal persiste tras la reducción a 8/7.

## ADR-034 — Presencia de usuarios por heartbeat y banner de mantenimiento

**Fecha:** 2026-06-01
**Estado:** Cerrado

### Contexto
Antes de desplegar a Railway (servicios web y api separados, auto-deploy en push a `master`), no había forma de saber si algún usuario estaba trabajando, ni de avisarle de una actualización inminente para que guardara su trabajo. El timeout de inactividad (ADR-026) ya desconecta sesiones idle, pero no expone presencia ni comunica nada al usuario.

### Decisión — Presencia
- Heartbeat, no actividad pasiva. Se descartó inferir presencia desde el último request HTTP: un usuario leyendo o tipeando sin guardar no genera requests y figuraría inactivo —justo a quien no hay que interrumpir—. El front emite `POST /presence/heartbeat` cada 30s mientras `AppLayout` está montado (toda la app autenticada), persistiendo `User.lastSeenAt`.
- El umbral de "activo" (2 min) vive en el backend (`getActiveUsers` filtra `lastSeenAt >= now − umbral`), no en el front: el endpoint responde "quién está activo ahora"; el front solo pinta. 30s de intervalo da ~2 latidos de tolerancia frente al throttling de tabs en segundo plano (~1/min) y red inestable.
- Heartbeat ortogonal a la inactividad: es un intervalo puro, no escucha mouse/teclado ni toca `useInactivityTimeout`. Un usuario idle sigue siendo desconectado por inactividad aunque el heartbeat lata; el ping para solo al desmontarse el layout (logout).
- Módulo `presence` propio (SRP), no dentro de `users`. `GET /presence/active` restringido a admin (`AdminGuard`); `POST /presence/heartbeat` solo `JwtAuthGuard`, toca únicamente la fila del propio usuario (sin IDOR, sin params).

### Decisión — Banner
- Dos keys en `AppSetting` (`maintenance_banner_message`, `maintenance_banner_active`), reutilizando el patrón key-value escalar de ADR-026: el flag booleano se persiste como `'true'`/`'false'` en `value` (VarChar), parseado al leer. No se tocó el schema.
- `GET /app-settings/maintenance-banner` legible por cualquier autenticado; `PATCH` solo admin (`AdminGuard`, DTO `class-validator`). El front poll-ea el GET cada 60s → los usuarios ven el cambio sin recargar.
- Entrega del banner desacoplada del heartbeat (dos polls independientes), no fusionada en una sola respuesta: mantiene los módulos separados y una única fuente de verdad por dato (principio de menor sorpresa). Costo despreciable a la escala del equipo (~7 usuarios).
- Banner global montado en `AppLayout` (visible en toda la app, no solo el dashboard); estilo de advertencia (ámbar), sin botón de cerrar (reaparecería en el siguiente poll). Control de edición solo-admin en el dashboard.

### Consecuencias
- Positivas: el admin ve sesiones activas antes de pushear y puede avisar al equipo; ambas piezas reutilizan patrones existentes (key-value de ADR-026, hooks de negocio, gating por rol). Migración `lastSeenAt` aditiva y nullable, sin downtime.
- Negativas / deuda: heartbeat (2/min) + poll de banner (1/min) + poll de sesiones del admin suman requests sobre el throttler global (30/min por IP); si el equipo trabaja tras una sola IP de oficina podrían aparecer 429s. Mitigación pendiente si ocurre: `@SkipThrottle()` en heartbeat y los GET de poll. Todos los polls son best-effort (un fallo conserva el último estado, no rompe la vista).
- El umbral de 2 min no es garantía dura de "seguro para desplegar": alguien activo hace 2.5 min no aparece. El empty state es factual ("Nadie con sesión activa en este momento"), sin prometer que es seguro pushear.

**Adenda (2026-06-02):** El riesgo de 429 por throttler compartido (descrito en Consecuencias) se mitigó preventivamente al confirmarse que todo el equipo trabaja tras una sola IP de oficina. Se aplicó `@SkipThrottle()` a los tres endpoints de fondo —`POST /presence/heartbeat`, `GET /presence/active`, `GET /app-settings/maintenance-banner`— siguiendo el patrón ya presente en `proposals.controller.ts`. El `PATCH` del banner conserva el throttler (acción puntual del admin, no poll), y el `@Throttle` estricto del login queda intacto. `@SkipThrottle()` solo desactiva el rate-limit; los guards y ownership (§K) no se ven afectados. Commit `2c274d2`.

### Archivos
- `apps/api/prisma/schema.prisma` (campo `lastSeenAt` en `User`) + migración `20260601182717_add_user_last_seen_at`
- `apps/api/src/presence/` (`presence.module.ts`, `presence.controller.ts`, `presence.service.ts`)
- `apps/api/src/app.module.ts` (registro de `PresenceModule`)
- `apps/api/src/app-settings/app-settings.service.ts` + `app-settings.controller.ts` + `dto/update-maintenance-banner.dto.ts`
- `apps/web/src/hooks/usePresenceHeartbeat.ts`, `useActiveUsers.ts`, `useMaintenanceBanner.ts`
- `apps/web/src/components/MaintenanceBanner.tsx`
- `apps/web/src/pages/dashboard/components/ActiveUsersPanel.tsx`, `MaintenanceBannerControl.tsx`
- `apps/web/src/layouts/AppLayout.tsx`, `apps/web/src/pages/Dashboard.tsx`

### Commits
- `df72eaf` — feat(api): add user presence heartbeat and maintenance banner settings
- `6808bd0` — feat(dashboard): show active sessions and maintenance banner with admin controls

### Pendientes
- ~~`@SkipThrottle()` en `/presence/heartbeat` y en los GET de poll si aparecen 429s tras desplegar con el equipo trabajando.~~ Resuelto preventivamente (ver Adenda 2026-06-02, commit `2c274d2`).
- "Programar" el banner (fecha/hora de inicio/fin automáticos) quedó fuera de alcance; hoy es on/off manual.

## ADR-035 - Validación de higiene de datos del tablero con gate de acciones para comerciales

**Fecha:** 2026-06-02
**Estado:** Cerrado

### Contexto
El tablero de oportunidades acumulaba propuestas con campos sin diligenciar (fecha de cierre, tipo de adquisición, fecha de facturación) y propuestas estancadas en ELABORACIÓN o con fecha de cierre vencida. Esto restaba fiabilidad a la información para la toma de decisiones. Se buscó forzar al usuario comercial a mantener su tablero al día, sin afectar al ADMIN (que ve el resumen global del equipo y quedaría bloqueado por datos sucios ajenos).

### Decisión - Reglas de higiene (R1-R5)
Cinco reglas puras en `apps/web/src/lib/dashboardValidation.ts`. NO viven en pricing-engine (CONVENTIONS §J): no son cálculo financiero sino validación de completitud de datos, por eso su propio archivo en `lib/`.
- **R1 - Fecha de cierre requerida:** en TODOS los estados, incluida ELABORACIÓN (decisión explícita: el cierre debe existir desde el inicio). Regla universal sin condición de estado.
- **R2 - Adquisición requerida:** `acquisitionType` (Venta o DaaS) obligatorio salvo en ELABORACIÓN (el primer borrador puede no tenerlo definido).
- **R3 - Fecha de facturación requerida:** en estados PENDIENTE_FACTURAR y FACTURADA (reutiliza `PROJECTION_STATUSES` de `constants.ts`).
- **R4 - Elaboración estancada:** ELABORACIÓN con más de 5 días desde `createdAt` obliga a cambiar de estado.
- **R5 - Cierre vencido:** fecha de cierre vencida y estado fuera de {GANADA, PERDIDA, PENDIENTE_FACTURAR, FACTURADA} obliga a extender el cierre o cambiar de estado. Reutiliza `isValidityExpired` de `dashboardDates.ts` (UTC-safe). Consecuencia consciente: una propuesta vieja en ELABORACIÓN con cierre vencido puede disparar R4 y R5 a la vez; el modal las agrupa bajo la misma propuesta, un solo paso.

Helper nuevo `daysSince(isoDate)` en `dashboardDates.ts` (días calendario UTC-safe, mismo criterio que `isValidityExpired` para evitar el desfase de -1 día en UTC-5).

### Decisión - Gate de acciones
- Crear, editar y clonar (NEW_VERSION y NEW_PROPOSAL) quedan bloqueados si el comercial tiene CUALQUIER propuesta con issues. El gate evalúa el TABLERO COMPLETO, no la propuesta objetivo (decisión del usuario: quiere todo el tablero al día, no solo la propuesta que va a tocar).
- Se evalúan SOLO las versiones activas de cada propuesta (`allProposalGroups`, agrupación sobre la lista cruda), porque las versiones históricas tienen los controles deshabilitados (ADR-024) y no podrían corregirse inline: incluirlas crearía un deadlock.
- La evaluación ignora los filtros de UI: opera sobre `allRows` (lista cruda), no sobre la lista filtrada. "Tablero al día" significa el universo del comercial, no lo que está viendo.
- ADMIN exento, centralizado en el gate (`runWithCleanBoard` en `Dashboard.tsx`): si el rol es ADMIN, la acción se ejecuta sin chequeo. Necesario porque el admin ve el tablero global y gatearlo lo bloquearía con datos del equipo.
- Los controles inline (estado, fecha de cierre, fecha de facturación, adquisición), la acción de borrar y los handlers de proyección NUNCA se gatean: son la vía de resolución. Así una propuesta sin cierre se corrige en su propia fila aunque el tablero esté sucio, sin deadlock.

### Decisión - UX
- El cálculo (`getBoardHygieneIssues`) se expone desde `useDashboard` como función on-demand (no `useMemo`): se evalúa al intentar la acción, no en cada render. El estado del modal vive en el componente (`Dashboard.tsx`), no en el hook (CONVENTIONS §A: los modals son estado de UI del componente).
- El modal (`DataHygieneModal.tsx`) muestra UNA propuesta a la vez: la más vieja con issues (orden `createdAt` ascendente en `findBoardHygieneIssues`), con sus razones agrupadas y un contador "(N propuestas requieren atención)". Se descartó campo-por-campo (3 ciclos de bloqueo sobre la misma fila = puro roce) y el listón completo (abrumador). Resuelta una, el siguiente intento muestra la siguiente.
- Componente controlado puro (patrón `ProjectionModal`: overlay fixed, stopPropagation en el panel, props isOpen/onClose). Header y botón primario en rojo (`red-600`, consistente con `STATUS_CONFIG.PERDIDA`), por ser advertencia de bloqueo y no un formulario.

### Consecuencias
- Positivas: el tablero del comercial se mantiene al día por construcción; la capa de validación es pura y reutilizable; cero cambios de schema o backend (`createdAt` ya viajaba en la respuesta de `GET /proposals`, solo faltaba declararlo en el tipo `ProposalSummary`); el admin nunca queda bloqueado por datos del equipo.
- Negativas / deuda: las reglas viven en el frontend. Un comercial podría saltarlas llamando la API directamente — esto es higiene de UX, no un constraint de backend. La feature siguiente (campos obligatorios en la creación) endurece el camino de creación. `ProposalHygieneInput` asume las fechas como `string | null` (consistente con `dashboardDates.ts`).
- Al desplegar, toda propuesta existente sin fecha de cierre (R1 universal) o vieja en ELABORACIÓN bloquea de inmediato a su comercial. Es el efecto buscado de la feature, no un bug; se omitió la medición previa de cuántas propuestas afecta.
- Decisión consciente sobre testing: se probó directamente en PRODUCCIÓN. El 2FA por Resend bloquea el login en entorno local y no existe un modo dev que omita el envío del código (verificado en el módulo `auth`: no hay flag de entorno ni rama condicional). El rollback quedó disponible vía Redeploy del deploy anterior en Railway (servicio web). El cambio es frontend puro sin migraciones, lo que acota el riesgo.

### Archivos
- `apps/web/src/lib/dashboardValidation.ts` (nuevo: reglas R1-R5, tipos `HygieneRuleId`/`HygieneIssue`/`ProposalHygieneInput`/`ProposalHygieneIssues`, `getProposalHygieneIssues`, `findBoardHygieneIssues`)
- `apps/web/src/lib/dashboardDates.ts` (helper nuevo `daysSince`, UTC-safe)
- `apps/web/src/lib/types.ts` (campo `createdAt: string` en `ProposalSummary`)
- `apps/web/src/hooks/useDashboard.ts` (`createdAt` en `DashboardRow` y su mapeo; `allProposalGroups` sobre lista cruda; `getBoardHygieneIssues` on-demand)
- `apps/web/src/pages/dashboard/DataHygieneModal.tsx` (nuevo: modal controlado, una propuesta a la vez, header rojo)
- `apps/web/src/pages/Dashboard.tsx` (estado del modal, `runWithCleanBoard` con exención de admin, envoltura de crear/editar/clonar, render del modal)

### Commits
- `5e606da` - feat(dashboard): add data hygiene validation rules (R1-R5)
- `0082538` - feat(dashboard): gate create/edit/clone on incomplete proposals

### Pendientes
- Redirect con scroll + resaltado a la fila desde el botón "Ir a corregir" (hoy solo cierra el modal; la corrección es manual). Requiere `clearFilters()` previo, porque la fila objetivo puede no estar montada bajo los filtros activos, y tocaría `ProposalVersionRow.tsx` y posiblemente `ProposalGroupHeaderRow.tsx`.
- Feature siguiente (otro chat): campos obligatorios en la creación de una nueva propuesta, que endurece el camino de creación (backend/formulario) y no solo el tablero.
- Modo dev para el código OTP sin Resend (loguear el código a consola solo fuera de producción), para desbloquear el testing local futuro. Descrito y descartado por ahora; requiere blindar que jamás se ejecute en producción.

## ADR-036 — Soft delete de propuestas con papelera (admin-only)

**Fecha:** 2026-06-05
**Estado:** Cerrado

### Nota de numeración
Los tres commits de esta feature (`f8c9532`, `b02fad0`, `139146d`) quedaron etiquetados en su mensaje como `(ADR-034)` por un desfase: la memoria de trabajo tenía ADR-033 como último, sin ver que ADR-034 (presencia por heartbeat) y ADR-035 (higiene de datos) ya existían. El número correcto de esta decisión es **ADR-036**; los commits no se reescribieron (evitar reescritura de historia ya publicada localmente). Esta entrada es la fuente de verdad de la feature.

### Contexto
El borrado de propuestas era físico (`prisma.proposal.delete`, apoyado en las cascadas de ADR-021) y no había forma de recuperar una propuesta eliminada por error. El administrador necesitaba poder borrar cualquier propuesta/versión y recuperar las eliminadas.

### Decisión
Soft delete vía campo nullable `Proposal.deletedAt` (`DateTime?`). En vez de borrar, `deleteProposal` marca `deletedAt = now()`.

- `verifyProposalOwnership` rechaza con `NotFoundException` toda propuesta con `deletedAt` no nulo. Como ese helper lo reusan `ScenariosService` y `PagesService`, una propuesta eliminada queda inaccesible en cadena para todos los flujos (abrir, editar, items, escenarios, páginas, clonar) sin tener que tocar método por método. Blast radius controlado: ningún flujo legítimo carga una eliminada por esa vía.
- `findAll` y `findPotentialConflicts` filtran `deletedAt: null` (las eliminadas no aparecen en el dashboard ni como cruce de cuenta).
- Dos endpoints nuevos bajo `AdminGuard`: `GET /proposals/deleted` (lista la papelera, sin filtro de owner — el admin ve todas) y `PATCH /proposals/:id/restore` (`deletedAt -> null`; usa query directo, NO `verifyProposalOwnership`, que rechazaría una eliminada). `GET /proposals/deleted` se declara antes de `GET /proposals/:id` en el controller para que Nest no lo matchee como `:id` y reviente el `ParseUUIDPipe`.
- UI en `/admin/papelera`: página `PapeleraAdmin.tsx` + hook `usePapeleraAdmin.ts`, enrutada bajo `AdminRoute` y enlazada en la sección admin del sidebar. Lista plana (sin agrupación por versión, que no aplica a eliminadas) con acción Restaurar por fila.
- El admin se salta el candado `isLocked` de ADR-024 al borrar: `assertProposalNotLocked` solo se aplica a COMMERCIAL. El admin puede borrar y restaurar cualquier versión, incluidas las históricas bloqueadas.
- **Invisible para COMMERCIAL a propósito:** los comerciales NO ven la papelera ni la opción de restaurar. El borrado se les presenta como definitivo (confirm seco, sin mencionar permanencia ni recuperación). La papelera es exclusivamente una herramienta de administración. NO exponer una papelera por-usuario a comerciales en el futuro: rompería esta decisión de producto.
- **Los hijos no se tocan:** escenarios, páginas, items y bloques cuelgan de la propuesta; al quedar oculta la propuesta, quedan ocultos con ella, y al restaurar vuelven intactos. La cascada física de ADR-021 solo aplicaría a un futuro borrado permanente (no implementado).

### Consecuencias
- Positivas: el borrado deja de ser destructivo y se recupera desde la papelera. El rechazo en `verifyProposalOwnership` cubre todos los flujos de lectura/mutación en un solo punto. La migración solo agrega una columna nullable: cero impacto en filas existentes (todas quedan con `deletedAt = NULL`).
- Negativas / deuda: los registros eliminados se acumulan en la tabla `proposals` sin purga (no hay borrado permanente). Un comercial que clickee Eliminar en una versión bloqueada sigue recibiendo 403 → `alert` (comportamiento de ADR-024, sin cambios); ocultarle el botón en filas locked queda como mejora opcional.
- El mensaje del `window.confirm` de `handleDelete` se actualizó: antes decía "eliminar permanentemente / no se puede deshacer" (falso tras el soft delete), ahora es seco (`¿Eliminar la propuesta {code}?`).

### Archivos
- `apps/api/prisma/schema.prisma` (campo `deletedAt` en `Proposal`)
- `apps/api/prisma/migrations/20260605160307_add_proposal_soft_delete/migration.sql` (nuevo; agrega columna `deleted_at`)
- `apps/api/src/proposals/proposals.service.ts` (rechazo en `verifyProposalOwnership`; filtros en `findAll` y `findPotentialConflicts`; `deleteProposal` a soft delete; nuevos `findDeleted` y `restoreProposal`)
- `apps/api/src/proposals/proposals.controller.ts` (import de `AdminGuard`; `GET /proposals/deleted` y `PATCH /proposals/:id/restore`)
- `apps/web/src/hooks/usePapeleraAdmin.ts` (nuevo)
- `apps/web/src/pages/admin/PapeleraAdmin.tsx` (nuevo)
- `apps/web/src/App.tsx` (lazy import + ruta `/admin/papelera` bajo `AdminRoute`)
- `apps/web/src/layouts/Sidebar.tsx` (item "Papelera" en la sección admin)
- `apps/web/src/hooks/useDashboard.ts` (texto del `window.confirm` de `handleDelete`)

### Commits
- `f8c9532` — feat(api): soft delete + papelera y restauración (backend)
- `b02fad0` — feat(web): página de papelera con restauración (frontend)
- `139146d` — fix(web): mensaje de confirmación de borrado acorde a soft delete

### Pendientes
- Borrado permanente desde la papelera (purga real, reusando la cascada física de ADR-021). No implementado.
- Ocultar el botón Eliminar a comerciales en filas bloqueadas (hoy produce 403 → alert). Opcional.
- Mostrar el monto en la papelera: hoy `GET /proposals/deleted` no incluye escenarios, así que no hay valor. Requiere agregar el `include` y calcular vía pricing-engine si se quiere.


## ADR-037 — Reporte de proyección de facturación en Excel (client-side, consolidado por comercial)

**Fecha:** 2026-06-09
**Estado:** Cerrado

### Nota de corrección (2026-06-09)
La primera implementación de este reporte calculaba los importes con lógica propia sobre `BillingProjection` únicamente, por lo que NO cuadraba con las tarjetas de facturación del dashboard (faltaban las propuestas; difería en trimestre actual y trimestre siguiente). Se corrigió para que el reporte delegue en la misma función que alimenta las tarjetas (`computeBillingCards`) sobre el mismo universo de filas (propuestas en versión activa + proyecciones), garantizando cuadre por construcción. Las secciones Decisión, Archivos y Commits de abajo reflejan la versión corregida.

### Contexto
El dashboard ya gestiona proyecciones de facturación (`BillingProjection`) y exporta un forecast plano por fila vía `exportDashboard.ts`. Faltaba un informe consolidado por comercial que respondiera la pregunta de negocio "¿cómo quedan los trimestres?": cuánto se facturó y cuánto queda pendiente, segmentado por modalidad de adquisición. El modelo `BillingProjection` ya contenía todo lo necesario (`subtotal`, `currency`, `status`, `billingDate`, `acquisitionType`, `user`), por lo que no se requería tocar el backend.

### Decisión
Se agrega un reporte Excel generado 100% en el cliente, accesible para comerciales y administradores desde un botón "Reporte de Proyección" en la barra de la tabla del dashboard (distinto del botón "Proyección de Facturación", que crea proyecciones, y del "Exportar Excel", que vuelca el forecast plano).

- **Una sola fuente de verdad (CONVENTIONS §J):** el reporte NO calcula importes ni buckets por su cuenta. Delega en `computeBillingCards(rows, acqType, trmRate)` de `useDashboard` — la MISMA función que alimenta las tarjetas de facturación que pinta `<BillingCards>`. Así el reporte cuadra con las tarjetas por construcción. `computeBillingCards` se hizo pública para poder reutilizarla.
- **Mismo universo que las tarjetas:** propuestas en versión activa (agrupadas por versión) MÁS proyecciones de facturación. El monto en USD de cada propuesta lo resuelve `getDashboardAmount`/pricing-engine (escenarios o `manualAmount`), idéntico al que muestra la tabla del dashboard. Antes el reporte usaba solo `BillingProjection`, por eso no incluía las propuestas y no cuadraba.
- **Ignora los filtros de UI:** el reporte consume `activeRowsUnfiltered` (gemelo de `activeRows` construido desde `allRows`/`allProposalGroups`, sin los filtros del tablero). Siempre consolida el universo completo accesible al usuario; el RBAC lo hereda del backend (comercial = sus filas, admin = todas), sin endpoint nuevo, guard, DTO ni migración.
- **GANADA fuera del cálculo de facturación:** se eliminó de `computeBillingCards` la suma de propuestas en estado GANADA (por `closeDate`) que antes alimentaba "proyección trimestre siguiente". GANADA no tiene fecha de facturación; su lugar son las tarjetas de pipeline por estado (lógica aparte, no tocada). Este cambio afecta también a la tarjeta "Proy. Trim. Sig." del dashboard, de forma deseada.
- **Tres tablas apiladas, una fila por comercial:** VENTAS (`computeBillingCards(..., 'VENTA')`), DaaS (`computeBillingCards(..., 'DAAS')`) y VENTAS + DaaS (suma campo a campo de ambas). Las seis columnas son exactamente las seis tarjetas, en orden: facturado mes anterior, facturado mes actual, pendiente facturar mes actual, pendiente facturar mes siguiente, trimestre actual (FACTURADA + PENDIENTE del trimestre) y proyección trimestre siguiente (pendientes del próximo trimestre). Los textos de encabezado de las dos últimas columnas se conservan como "Pend. Facturar trimestre actual/siguiente" por decisión de presentación, aunque su contenido sigue la semántica de las tarjetas.
- **Universo de filas:** todos los comerciales presentes en las filas aparecen en las tres tablas; un comercial sin importes en una modalidad sale en cero. Las clasificaciones temporales (mes/trimestre, manejo de `billingDate`, sin shift UTC) viven dentro de `computeBillingCards`, no en el reporte.
- **Gate de generación:** el botón se deshabilita si no hay TRM (`!trmRate || trmRate <= 0`) o no hay proyecciones cargadas, evitando un Excel vacío.
- **Estética (sin cambios):** se clona el patrón ExcelJS de `exportDashboard.ts` (paleta indigo/slate/emerald, bordes, filas alternadas, fila TOTAL, freeze, `saveAs`). Títulos de tabla en sky-600 (VENTAS), pink-600 (DaaS) e indigo-600 (VENTAS + DaaS).

### Consecuencias
- Comerciales y administradores obtienen un consolidado trimestral sin intervención del backend.
- Las columnas "trimestre actual" y "proyección trimestre siguiente" se solapan con las columnas de mes (un mismo importe puede contarse en mes y en su trimestre); es deliberado y debe leerse como proyección por período, no como total único.
- Al delegar en `computeBillingCards`, el reporte y las tarjetas del dashboard quedan atados a la misma lógica: cualquier cambio futuro en esa función afecta a ambos por igual (ventaja de consistencia, a tener en cuenta al modificarla).
- El reporte ignora los filtros de UI mientras que "Exportar Excel" sí los respeta; comportamiento distinto a propósito, documentarlo evita confusión.
- La lógica vive en `lib/projectionReport.ts` (pura, testeable, con `referenceDate` inyectable) separada del pintado en `lib/exportProjectionReport.ts`, siguiendo la separación de capas del proyecto.

### Archivos
- `apps/web/src/hooks/useDashboard.ts` (hace pública `computeBillingCards`; elimina la suma de GANADA en ella; expone `projections` y `activeRowsUnfiltered` en el return)
- `apps/web/src/lib/projectionReport.ts` (agrupa por comercial y delega en `computeBillingCards`; `ProjectionReportRow extends BillingCards`; tabla VENTAS+DaaS = suma de ambas modalidades; `buildProjectionReport(rows: DashboardRow[], trmRate, referenceDate?)`)
- `apps/web/src/lib/exportProjectionReport.ts` (pintado Excel de una hoja con tres tablas; `getRowValues` lee los seis campos de `BillingCards`; encabezados sin cambios; `exportProjectionReportToExcel`)
- `apps/web/src/pages/Dashboard.tsx` (import de la capa lib y de `FileBarChart`, estado `isGeneratingReport`, handler `handleProjectionReport` alimentado por `activeRowsUnfiltered`, botón "Reporte de Proyección" junto a "Exportar Excel")

### Commits
- `ef22cf4` — feat(dashboard): logica y exportador del reporte de proyeccion de facturacion
- `d3c154a` — feat(dashboard): boton reporte de proyeccion de facturacion
- `75d6f7b` — refactor(dashboard): export computeBillingCards, drop GANADA, expose unfiltered rows
- `07d3f78` — fix(dashboard): align projection report with billing cards source and logic

### Pendientes
- Tests unitarios de `buildProjectionReport` aprovechando `referenceDate` inyectable: borde de año (diciembre → mes/trim siguiente en año +1), solapamiento mes/trimestre, proyección sin tipo (fila en cero), `billingDate` null o fuera de período.
- `wb.created` no se setea en `exportProjectionReport.ts` (el hermano sí); cosmético.
- Eventual server-side si el volumen de proyecciones crece y la agregación en cliente deja de ser viable (hoy no es problema).

## ADR-038 — Control de cache HTTP en nginx: index.html revalidado, assets inmutables

**Fecha:** 2026-06-10
**Estado:** Cerrado

### Contexto
`apps/web` se sirve en producción con **nginx** (no con `server.mjs`/Express; esa nota quedó obsoleta en memoria y en las instrucciones del proyecto §4). El Dockerfile de `apps/web` hace build con Vite y copia `apps/web/nginx.conf` a `/etc/nginx/conf.d/default.conf`, y el `dist/` a `/usr/share/nginx/html`. La config previa (ADR-017) tenía los 4 headers de seguridad a nivel `server` (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) y un único `location /` con `try_files $uri $uri/ /index.html`, sin ningún control de cache HTTP.

El síntoma: tras cada deploy, los usuarios no veían la versión nueva con un F5 normal y debían forzar recarga con Ctrl+Shift+R. La causa raíz es que `index.html` —único archivo sin hash en su nombre, por ser el punto de entrada— quedaba cacheado por el navegador apuntando a bundles viejos. Los assets de Vite sí llevan hash de contenido (`index-[hash].js`), así que nunca son el problema: si el contenido cambia, cambia el nombre.

### Decisión
Se agrega control de cache HTTP en `apps/web/nginx.conf` partiendo el `location /` en dos bloques:

- **`location /assets/`** — `Cache-Control: public, max-age=31536000, immutable`. Los assets hasheados se cachean "para siempre": el navegador los sirve de memoria sin revalidar mientras el nombre coincida, y en cuanto un deploy cambia el hash, baja el nuevo. El `Cache-Control` va **sin** `always` para no marcar un eventual 404 como inmutable. `try_files $uri =404`.
- **`location /`** (index.html + fallback SPA) — `Cache-Control: no-cache`. El navegador puede guardar el `index.html` pero está obligado a revalidarlo contra el servidor antes de usarlo; con el ETag que nginx ya genera, la respuesta es un 304 barato cuando no cambió. Así un F5 normal —o navegar a otra ruta, o reabrir la pestaña— siempre trae un index fresco que apunta a los bundles nuevos. Se conserva el `try_files $uri $uri/ /index.html`.

**Herencia de headers (gotcha de nginx, ya documentado en el propio archivo):** un `add_header` dentro de un `location` elimina TODOS los `add_header` de nivel `server` para ese location. Por eso los 4 headers de seguridad se **repiten** dentro de cada uno de los dos `location`. Verificado en DevTools que HSTS, X-Frame-Options, X-Content-Type-Options y Referrer-Policy siguen presentes tanto en el documento como en los assets (no-regresión del hallazgo Invicti de ADR-017).

No se tocó el Dockerfile (ya copia el `nginx.conf` correcto), ni la directiva `server`, ni los headers de seguridad a nivel server.

### Consecuencias
- Tras un deploy, un F5 normal basta para obtener la versión nueva; se elimina la necesidad de Ctrl+Shift+R. Esto resuelve el root cause del problema, pero NO cubre la pestaña que quedó abierta horas sin interacción (no se entera del deploy hasta que el usuario navega o recarga). Esa parte queda para una eventual capa de detección de versión + aviso (no implementada).
- La verificación local de headers no se puede hacer con `pnpm dev` (Vite no pasa por nginx ni hashea). Se valida levantando `nginx:alpine` con el `dist/` y el `nginx.conf` montados, o tras el deploy en Railway.
- El `Strict-Transport-Security` solo lo aplica el navegador sobre HTTPS; en pruebas locales sobre `http://localhost` el header se emite pero el browser lo ignora (esperado).

### Archivos
- `apps/web/nginx.conf` (parte el `location /` en `location /assets/` con cache inmutable y `location /` con `no-cache`; repite los 4 headers de seguridad en ambos bloques; deja intactos el `server`, el comentario WARNING y los headers de nivel server)

### Commits
- `0f0e7af` — fix(web): cache-control headers in nginx (no-cache index, immutable assets)

### Pendientes
- Capa de detección de versión nueva + aviso de recarga (banner tipo Gmail/Linear) para la pestaña abierta largo rato; recarga avisada, no forzada, para no perder una propuesta a medio llenar. Planificada, no implementada.
- Captura de `vite:preloadError` (chunk de un deploy viejo que ya no existe en el servidor nuevo) con recarga automática. Opcional.
- Renormalización CRLF/LF vía `.gitattributes` — `nginx.conf` se commiteó con CRLF (nginx en Alpine lo tolera, no rompe el deploy). Deuda de infra ya registrada, no atendida aquí.
- Corregir en las instrucciones del proyecto (§4) la línea que dice que `apps/web` se sirve con `server.mjs`/Express: hoy es nginx.

## ADR-039 — Alerta de precios unitarios sospechosos por moneda al entrar a construcción del documento

**Fecha:** 2026-06-11
**Estado:** Cerrado

### Contexto
La moneda es por escenario (`Scenario.currency`, default histórico COP), no por ítem. El costo tiene su propia moneda a nivel de ítem (`ProposalItem.costCurrency`), y el precio de venta en la moneda del escenario es un valor calculado por el pricing-engine (costo convertido por TRM + margen). El riesgo operativo: si un usuario configura un escenario en COP cuando los valores estaban pensados en USD, el número no cambia pero su significado se divide por la TRM (~4.000x). Un ítem que vale USD 50 queda como "COP 50" (unitario ridículamente bajo); el total puede verse grande por la cantidad y ocultar el error. Una propuesta así, llevada a PDF, es grave: un cliente puede exigir que se honre el precio bajo.

La percepción del negocio es de **riesgo asimétrico**: vender por un precio ridículamente bajo es catastrófico e irreversible; cotizar ridículamente alto solo pierde el negocio y es auto-correctivo. Y casi todas las propuestas van en USD. Esto motivó dos frentes: prevención (cambiar los defaults a USD) y detección (alertar).

### Decisión
Se atacó el problema en tres piezas independientes (commits separados):

**1. Defaults a USD (prevención).** El valor inicial de la moneda de costo en el formulario de ítems pasó de COP a USD (`useProposalBuilder.ts`), y el fallback de moneda al **crear** un escenario pasó de COP a USD (`scenarios.service.ts`, solo `createScenario`). Clonar escenario (`cloneScenario`) y versionar propuesta (`cloneProposal`) siguen **heredando** la moneda del origen a propósito; no se tocaron. El `@default("COP")` del schema Prisma se dejó intacto (es secundario: el servicio siempre escribe el campo).

**2. Alerta de validación (detección).** Al entrar a la pantalla de construcción del documento (`ProposalDocBuilder`), el sistema evalúa los precios unitarios calculados y, si hay hallazgos, muestra un modal de aviso. La lógica es **asimétrica**: en escenario COP avisa de unitarios por **debajo** de un piso; en escenario USD avisa de unitarios por **encima** de un techo. No se buscan los casos inversos (alto en COP / bajo en USD) porque no delatan el error de moneda y solo serían ruido.

**3. Umbrales configurables por admin.** Piso COP y techo USD son dos settings editables, respaldados por la tabla `AppSetting` (patrón clave-valor de ADR-026).

Reglas de diseño que enmarcan la feature:
- **Solo avisa, no bloquea.** Decisión explícita del dueño: un equipo comercial que choca con bloqueos aprende a despacharlos sin leer (alarm fatigue). Se acepta menos protección dura a cambio de no entorpecer el flujo.
- **El modal interrumpe (no es banner).** Un banner en una pantalla cargada pasa desapercibido —justo el aviso que importa—; el modal obliga a mirar. Se acepta el costo de que pueda reaparecer.
- **Tres reglas del modal:** no aparece si no hay hallazgos (entrada limpia = cero fricción); un único botón "Entendido, continuar" que cierra sin exigir corregir; se evalúa **una sola vez por carga** (flag `priceWarningEvaluatedRef`) y reaparece solo en una nueva entrada/recarga, no se redispara estando en la pantalla.
- **Prominencia asimétrica:** los hallazgos COP-bajo (graves) van primero y en rojo; los USD-alto (tolerables) después y en ámbar.
- **El check nombra escenario + ítem + valor + motivo** ("valor muy bajo/alto, verifícalo").
- **Solo ítems con precio de venta real.** La validación recorre `ProcessedScenario.visibleItems`, que el pricing-engine ya construye excluyendo ítems diluidos y sub-ítems. No hay que filtrar nada: lo que llega tiene precio legítimo.
- **No recalcula precios.** Consume el `unitSalePrice` que el engine ya calculó y solo lo compara contra los umbrales. La validación NO vive en el pricing-engine (no es un cálculo financiero, es una comparación), sino en `lib/priceValidation.ts`, siguiendo el patrón de `lib/dashboardValidation.ts`.
- **Gate de UX puro:** no cambia datos, ni PDF, ni Excel.

Defaults de umbral: piso **COP 50.000**, techo **USD 100.000**. Rangos de validación del DTO (solo para rechazar 0/negativos/absurdos): COP [1, 10.000.000], USD [1, 100.000.000]. Ambos enteros.

El hook `usePriceThresholds` lee los umbrales una sola vez al montar (no refresca: cambian rara vez y aplican al recargar) y, ante fallo de red, devuelve los defaults de respaldo (50.000 / 100.000) en vez de null/0 —un umbral en 0 apagaría el check en silencio—.

### Consecuencias
- Caso de error en ítems muy caros: un umbral fijo no escala con la magnitud, así que un error de moneda en un ítem de valor enorme podría no caer bajo el piso. Se aceptó por KISS; el caso típico (equipo de USD 500–2.000 mal etiquetado queda en COP 500–2.000) cae muy por debajo del piso y se atrapa.
- Falsos positivos legítimos: un accesorio barato real en COP por debajo del piso dispara el aviso. Tolerable porque no bloquea; el comercial lo cierra y sigue.
- Caso "falta TRM" no diferenciado (V1 simple, decisión explícita): si un escenario está en COP con costos en USD y sin TRM liquidada, `convertCost` devuelve el costo sin convertir (número USD crudo), que cae bajo el piso y dispara "precio muy bajo" cuando el problema real es la TRM ausente. Con el default ahora en USD, ese caso es poco frecuente (requiere cambiar deliberadamente a COP sin liquidar TRM). Si en la práctica molesta, se agrega después distinguiendo el mensaje, lo que implicaría exponer un flag en `ProcessedScenario` (tocar `useProposalScenarios`).
- Cambiar el default a USD reduce el caso COP-por-error pero sube el inverso (USD-por-error en quien sí quería COP); por eso el check cubre las dos direcciones (piso y techo).
- La verificación de comportamiento (disparo del modal, asimetría de color, las tres reglas, panel admin) se hizo en navegador; `tsc --noEmit` solo garantiza compilación.

### Archivos
- `apps/web/src/hooks/useProposalBuilder.ts` (valor inicial de `costCurrency` de COP a USD en el form de ítems)
- `apps/api/src/proposals/scenarios.service.ts` (fallback de `currency` de COP a USD solo en `createScenario`)
- `apps/api/src/app-settings/app-settings.service.ts` (2 keys nuevas `cop_min_unit_price`/`usd_max_unit_price`, sus defaults, interface `PriceThresholds`, métodos `getPriceThresholds`/`updatePriceThresholds` con upsert idempotente)
- `apps/api/src/app-settings/app-settings.controller.ts` (endpoints GET/PATCH `/app-settings/price-thresholds`; GET autenticado, PATCH admin)
- `apps/api/src/app-settings/dto/update-price-thresholds.dto.ts` (nuevo; rangos COP [1, 10.000.000], USD [1, 100.000.000])
- `apps/web/src/lib/priceValidation.ts` (nuevo; función pura `findProposalPriceWarnings`, asimétrica COP/USD, patrón de `dashboardValidation.ts`)
- `apps/web/src/hooks/usePriceThresholds.ts` (nuevo; lectura única + `update`, fallback a defaults ante error)
- `apps/web/src/components/proposals/PriceWarningModal.tsx` (nuevo; modal no bloqueante, COP-bajo rojo primero, USD-alto ámbar después)
- `apps/web/src/pages/proposals/ProposalDocBuilder.tsx` (montaje: hook, hallazgos vía `useMemo`, `useEffect` de disparo único, modal hermano del `PdfPreviewModal`)
- `apps/web/src/pages/admin/components/PriceThresholdsSettings.tsx` (nuevo; reusa `usePriceThresholds`, validación en espejo del backend)
- `apps/web/src/pages/admin/SettingsAdmin.tsx` (monta `PriceThresholdsSettings` como card hermano de la sección "Sesión")

### Commits
- `9bf293c` — feat(items): default cost currency to USD in item form
- `e1db177` — feat(scenarios): default sale currency to USD on creation
- `0497daf` — feat(app-settings): add price-thresholds endpoint for unit price validation
- `c7912c4` — feat(proposals): add price validation logic and thresholds hook
- `c0c0fdb` — feat(proposals): warn on suspicious unit prices when entering document builder
- `d6f5801` — feat(admin): add price thresholds settings panel

### Pendientes
- Distinguir el caso "falta TRM" del de "precio sospechoso" en el aviso (hoy un escenario COP con costos USD sin TRM dispara "precio muy bajo" engañoso). Requiere exponer un flag en `ProcessedScenario`. No implementado; poco frecuente con el default en USD.
- Umbral por tipo de ítem (un mouse y un servidor tienen pisos reales distintos). Descartado por YAGNI; un piso global basta hasta que un caso lo exija.
- Evaluar si el modal, al reaparecer en cada entrada con un falso positivo legítimo, genera fricción suficiente para justificar una variante más persistente-pero-no-bloqueante. Solo si la práctica lo muestra.

## ADR-040 — Spec fields data-driven extendidos (select, required, visibilidad condicional): campos Estado y Número de Parte en PCS
**Fecha:** 2026-06-12
**Estado:** Cerrado
### Contexto
La ficha técnica automatizada es data-driven: `SPEC_FIELDS_BY_ITEM_TYPE` (`constants.ts`) define los campos por categoría y `SpecFieldsSection` los renderiza. Hasta ahora la definición de campo era plana (`{ label, cat }`) y todos los campos se renderizaban como `AutocompleteInput` contra el endpoint de sugerencias de `SpecOption`. El negocio necesita en PCS: un campo **Estado** (Nuevo, Remanufacturado, Open Box, Usado) obligatorio y con opciones cerradas —no texto libre—, y un campo **Número de Parte** de texto libre. Regla: cuando el estado es distinto de Nuevo, las garantías (Garantía Batería y Garantía Equipo) no aplican y no deben aparecer ni en el formulario ni en la cotización PDF.

Hallazgos del diagnóstico que condicionaron el diseño:
- `TechnicalSpecSheet` (ficha del PDF) itera la misma constante y **solo imprime specs con valor** → los campos nuevos salen solos en el PDF y un spec sin valor no se imprime.
- `consolidateTechnicalItems.buildSpecsHash` hashea **todos** los specs con valor para detectar variantes (Config A/B). Garantías "zombi" guardadas en ítems con estado ≠ Nuevo generarían variantes falsas de ítems visualmente idénticos.
- El DTO del backend valida `technicalSpecs` solo como `@IsObject()` `Record<string, string>` (`forbidNonWhitelisted` aplica a propiedades del DTO, no a keys internas del objeto) → keys nuevas pasan sin cambios de backend.
- Existe un `partNumber` a nivel de ítem cableado end-to-end (schema Prisma, DTOs, service, hook) pero **sin input en la UI** y por fuera de `technicalSpecs`: no saldría en la ficha del PDF ni entraría al hash de variantes.

### Decisión
1. **Tipo de campo extendido.** Nueva interfaz `SpecFieldDef` en `lib/types.ts`: `{ label, cat, input?: 'autocomplete' | 'select' | 'text', options?, required?, visibleWhen?: { field, equals } }`. `input` omitido = `'autocomplete'` → cero impacto en los campos existentes de todas las categorías.
2. **Estado** como `select` `required` con opciones cerradas (`ESTADO_OPTIONS`; `ESTADO_NUEVO = 'Nuevo'` como constante con nombre). No consulta el endpoint de sugerencias. **Número de Parte** como `text` plano (no es uno de los 17 fieldNames válidos de `SpecOption` en BD). Ambos encabezan el objeto PCS, en ese orden: el orden de inserción de las keys define el orden visual tanto del formulario como de la ficha en el PDF.
3. **Garantías condicionales.** `garantiaBateria` y `garantiaEquipo` llevan `visibleWhen: { field: 'estado', equals: ESTADO_NUEVO }`. Regla de visibilidad: visibles si el estado es Nuevo **o está vacío** —los ítems legacy (sin estado) no cambian retroactivamente su formulario ni su PDF; al editarlos, el `required` obliga a definir el estado.
4. **Limpieza en el guardado, no en el formulario.** Al cambiar el estado, los valores tecleados en las garantías NO se borran del form (si el usuario vuelve a Nuevo no pierde lo escrito). La exclusión ocurre en `saveItem` (`useProposalBuilder`): se filtran del payload los specs que no pasan la regla de visibilidad. Como el POST/PATCH reemplaza el JSON completo de `technicalSpecs`, lo que no viaja no persiste → la BD nunca guarda garantías zombi y el hash de variantes queda limpio.
5. **Una sola fuente para la regla de visibilidad.** Helper puro `isSpecFieldVisible(def, specs)` en `constants.ts`, consumido por el render (`SpecFieldsSection`) y por la limpieza del payload (`useProposalBuilder`). Genérico: cualquier spec con `visibleWhen` de cualquier categoría futura obtiene el mismo comportamiento sin tocar componentes.
6. **No se reutiliza el `partNumber` huérfano del ítem.** Número de Parte vive como spec (`numeroParte`) dentro de `technicalSpecs`, que es lo que la ficha del PDF imprime y el hash de variantes considera. El campo huérfano queda intacto.
7. **Cero cambios en backend y en la capa PDF.** El DTO acepta las keys nuevas tal cual; `TechnicalSpecSheet` no necesita filtro propio porque con el payload limpio nunca recibe garantías inválidas (YAGNI: el formulario es la única vía de escritura de specs que existe hoy).
8. La validación de "obligatorio" es la nativa del browser (`required` dentro del `<form onSubmit>` existente), consistente con el campo Nombre del mismo formulario.

### Consecuencias
- El patrón `SpecFieldDef` habilita selects, textos planos, obligatorios y visibilidad condicional para cualquier categoría futura por configuración, sin tocar `SpecFieldsSection`.
- No hay validación server-side del estado: el DTO sigue aceptando cualquier `Record<string, string>`. Aceptado porque el formulario es la única vía de escritura; si aparece otra (import masivo, API externa), habrá que replicar el filtro en esa vía o agregar defensa en `TechnicalSpecSheet`.
- Ítems legacy conservan sus garantías visibles en form y PDF hasta que alguien los edite y el `required` fuerce a definir estado.
- Al volver a seleccionar Nuevo antes de guardar, las garantías reaparecen con lo que tenían escrito (diseño intencional, no bug).
- Verificación de comportamiento (orden, ocultamiento, required, payload limpio, PDF) hecha en navegador; `tsc --noEmit` solo garantiza compilación.

### Archivos
- `apps/web/src/lib/types.ts` (`TechnicalSpecs` += `estado`/`numeroParte`; nueva interfaz `SpecFieldDef`)
- `apps/web/src/lib/constants.ts` (`ESTADO_NUEVO`, `ESTADO_OPTIONS`; `SPEC_FIELDS_BY_ITEM_TYPE` tipado como `Record<string, Record<string, SpecFieldDef>>`; `estado` y `numeroParte` encabezando PCS; `visibleWhen` en ambas garantías; helper `isSpecFieldVisible`)
- `apps/web/src/components/proposals/SpecFieldsSection.tsx` (filtro de visibilidad en el render; bifurcación select/text/autocomplete según `input`; `required` con asterisco en el label; `onChange` acepta `HTMLSelectElement`; `fieldFetchFns` omite campos select/text)
- `apps/web/src/hooks/useProposalBuilder.ts` (`saveItem` excluye del payload los specs ocultos vía `isSpecFieldVisible`)

### Commits
- `76d1ce8` — feat(proposals): add estado and numero de parte to PCS spec sheet with conditional warranties

### Pendientes
- Deuda preexistente detectada en el diagnóstico (no introducida por esta feature): `handleItemChange` en `ProposalItemsBuilder.tsx` duplica fórmulas del pricing-engine (precio desde landed cost + margen y el cálculo inverso de margen), en violación de CONVENTIONS §J. Extraerlas al pricing-engine en una tarea aparte.