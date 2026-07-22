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
- Deuda preexistente detectada en el diagnóstico (no introducida por esta feature): `handleItemChange` en `ProposalItemsBuilder.tsx` duplica fórmulas del pricing-engine (precio desde landed cost + margen y el cálculo inverso de margen), en violación de CONVENTIONS §J. **Resuelto en `60546fb`**: las tres fórmulas del handler ahora llaman a `calculateParentLandedCost`/`calculateUnitPrice`/`calculateMarginFromPrice` (guard con `MAX_MARGIN` en vez del 100 mágico), y se eliminaron dos duplicaciones adicionales de landed cost detectadas en el mismo archivo (display "Nuevo Costo Unitario" y celda de landed en la tabla de ítems).

## ADR-041 — Auditoría de versiones del entorno: Node 22 en producción, pin de Prisma CLI y CI en runtime node24
**Fecha:** 2026-06-12
**Estado:** Cerrado
### Contexto
Una sospecha de drift entre el entorno local y producción motivó una auditoría de versiones en cuatro planos: máquina local, repo (package.json/engines), Dockerfiles (= runtime de Railway) y workflows de CI. La sospecha resultó invertida: producción no estaba adelante del local salvo en Postgres (15 local vs 18 en Railway); lo crítico estaba en otro lado. Hallazgos de prioridad inmediata (P0):
- **Node 20 EOL.** Ambos Dockerfiles usaban `node:20-alpine`; Node 20 llegó a End-of-Life el 2026-04-30, dejando el runtime de producción sin parches de seguridad. El entorno local ya corría Node 22 (LTS hasta abril 2027).
- **Prisma CLI sin pin en el runner del api.** El stage de producción ejecutaba `RUN npm install prisma ts-node typescript` sin versión. En la práctica resolvía a 5.10.2 solo por una carambola de tres condiciones: el `package.json` copiado al runner declara `"prisma": "5.10.2"` exacto en devDependencies y npm respeta ese rango. Protección implícita y frágil: un cambio a `^5.10.2` o un reorden del Dockerfile la rompería en silencio y `migrate deploy` correría con un CLI de otra major. Además ts-node y typescript se instalaban sin que el CMD los use (el seed nunca corre en producción).
- **CI roto y desactualizado.** El job de Lint & Type-check moría en el setup por doble declaración de la versión de pnpm (`version: 9` en los workflows vs `packageManager: pnpm@9.0.0` en el package.json raíz; `pnpm/action-setup` rechaza la duplicidad). Adicionalmente, GitHub deprecó las actions con runtime Node 20 y las fuerza a Node 24 desde el 2026-06-16. Dos fallas más estaban ocultas en cascada porque los jobs nunca llegaban a ejecutarse: el typecheck del API fallaba por ausencia de `prisma generate` (los enums del schema no existen en `@prisma/client` sin generar el cliente; el Dockerfile lo hace, el CI no lo hacía), y las actions de Docker (`setup-buildx@v3`, `build-push@v6`) también corrían en Node 20 — warning visible solo cuando el job `docker-build` corrió por primera vez.
### Decisión
1. **Pin explícito del Prisma CLI en el runner:** `RUN npm install prisma@5.10.2`, eliminando ts-node y typescript de la imagen de producción. Convierte la protección accidental en contrato explícito y aliviana la imagen.
2. **CI con fuente única de versión de pnpm:** se elimina `version: 9` de los workflows; `pnpm/action-setup@v6` lee `packageManager` del package.json. Una sola fuente de verdad para futuros upgrades de pnpm.
3. **Actions en runtime node24:** `actions/checkout@v6`, `pnpm/action-setup@v6`, `actions/setup-node@v6` (con `node-version: 22`), `docker/setup-buildx-action@v4` y `docker/build-push-action@v7`, en `ci.yml` y `pr-check.yml`. Cierre antes del deadline del 2026-06-16.
4. **`pnpm exec tsc` en vez de `npx tsc`** en los typechecks de CI, alineado con la regla del proyecto (npx resuelve a global y rompe versiones pinneadas).
5. **Step `Generate Prisma Client` en CI** (`pnpm exec prisma generate` con `working-directory: apps/api`) antes del typecheck y del build, espejo del paso equivalente del Dockerfile. Sin esto el cliente generado no existe en el runner fresco y los enums del schema no compilan.
6. **`node:22-alpine` en los tres stages** que usaban Node: builder y runner del api, builder del web. El runner del web (nginx) no cambia.
7. **Política de actualización adoptada:** un cambio por día con validación completa (build + deploy + smoke test) antes del siguiente; orden de dependencias respetado (fix de CI antes de pnpm 10; NestJS 11 antes de TypeScript 6 en el api); Prisma 5→7 se trata como proyecto aparte con ADR propio por su riesgo de regresión sobre el pricing-engine.
### Consecuencias
- Primer run completamente verde del CI en la historia del repo: el typecheck del API, el build de turbo y la validación de imágenes Docker se ejecutaron por primera vez. El CI ahora valida lo que dice validar.
- Runtime de producción en Node 22.22.3 (verificado con `node -v` en la Console de Railway), un patch por delante del local (22.22.2). Paridad real entre entornos y soporte LTS hasta abril 2027.
- Imagen del runner del api más liviana (sin ts-node/typescript).
- El warning `Prisma failed to detect the libssl/openssl version` del stage builder persiste: no era cuestión de la versión de Node sino de que el builder no instala el paquete `openssl` (solo el runner hace `apk add`). Cosmético comprobado: el cliente se genera bien y el binaryTarget de runtime resuelve correcto (`linux-musl-openssl-3.0.x`).
- El cambio de imagen base invalidó el cache de Docker una vez (build lento puntual); los siguientes builds recuperan cache normal.
### Archivos
- `apps/api/Dockerfile` (pin prisma@5.10.2 en runner; node:22-alpine en builder y runner)
- `apps/web/Dockerfile` (node:22-alpine en builder)
- `.github/workflows/ci.yml` (actions node24, fuente única pnpm, pnpm exec, step Generate Prisma Client en lint y build, Docker actions v4/v7)
- `.github/workflows/pr-check.yml` (mismos cambios en su único job)
### Commits
- `7f53802` — fix(api): pin prisma cli to 5.10.2 in runner stage
- `ada33d6` — fix(ci): update actions to node24, single pnpm version source, pnpm exec
- `b4ad203` — fix(ci): generate prisma client before typecheck and build
- `326bbe9` — fix(ci): update docker actions to node24
- `33ae8a8` — chore(docker): bump node 20 to 22 in api and web dockerfiles
### Pendientes
- **P1 — Postgres:** local 15 → 18 en docker-compose (volumen nuevo + seed; datos locales de prueba) y aplicar el minor 18.4 disponible en Railway (backup previo, hora valle). Hacer antes de la próxima migración de schema.
- **P2 (orden):** ~~pnpm 9→10~~ ✅ HECHO (commit `2ec8a9a`): pnpm 10.33.4 + `pnpm.onlyBuiltDependencies: ["bcrypt"]`. Deploy verde en api y web. Hueco DX: install limpio local requiere `prisma generate` a mano (prod/CI lo generan explícito). Resto del P2 pendiente: NestJS 10→11 (antes del salto ESM de v12; unifica jwt/passport hoy mezclados en 11), ESLint 8→9 en el api, TypeScript unificado a 6.0.x (después de Nest 11), Turborepo 1→2 vía codemod oficial, quitar el logging `prisma:query` de producción, `apk add openssl` en el stage builder si se quiere silenciar el warning, pin de versión de nginx, limpiar `version:` obsoleta de docker-compose.
- **P3 — Prisma 5→6→7:** proyecto aparte con ADR propio (requiere `prisma.config.ts` y regresión seria del pricing-engine). El pin de este ADR compra tiempo; no acumular más de un trimestre.
- `pr-check.yml` queda validado en teoría (mismos cambios que ci.yml) pero su primer run real será en el próximo PR.
- Renormalización CRLF/LF vía `.gitattributes` sigue pendiente (warnings cosméticos en los commits de este ADR).

## ADR-042 — Postgres alineado local/producción en 18.4: upgrade local 15→18, pin del tag del template en Railway, layout de volumen 18+ y .env raíz
**Fecha:** 2026-06-12
**Estado:** Cerrado
### Contexto
Cierre del P1 del ADR-041: el único frente donde la sospecha de drift resultó cierta era Postgres — local en 15-alpine, producción en 18.x con un "Minor Update Available: 18.4" en el dashboard de Railway. Tres majors de distancia entre donde se desarrollan las migraciones y donde se aplican. Los datos locales eran de prueba, así que la vía elegida en local fue volumen nuevo + migraciones + seed, sin pg_upgrade. El proceso destapó tres hallazgos no documentados:
- El contenedor `postgres:18-alpine` se negó a arrancar con el mount existente: desde la 18, la imagen oficial exige el mount un nivel arriba del path clásico.
- La receta del docker-compose nunca había sido reproducible: el volumen viejo databa de una configuración histórica con el rol `admin`, pero los defaults actuales del compose (`novotechflow`/`changeme`) inicializan otra cosa y no existía `.env` en la raíz que los pisara. Como el volumen jamás se había recreado, nadie lo había notado.
- En Railway, el `pg_dump` previo reveló que el server ya corría 18.4 pese al banner de minor disponible. Explicación: el Source Image del servicio es `ghcr.io/railwayapp-templates/postgres-ssl:18` — un tag flotante de major (mismo patrón que el `nginx:alpine` señalado en el ADR-041) cuyo contenido ya traía los binarios 18.4; el banner comparaba la etiqueta declarada, no los binarios corriendo.
### Decisión
1. **`postgres:15-alpine` → `postgres:18-alpine`** en `docker-compose.yml`.
2. **Mount ajustado al layout de la imagen oficial 18+:** `postgres-data:/var/lib/postgresql/data` → `postgres-data:/var/lib/postgresql`. La imagen organiza internamente un subdirectorio por versión mayor, lo que habilita `pg_upgrade --link` para futuros saltos de major sin cruzar límites de mount. No aplica a Railway (usa su template `postgres-ssl`, no la imagen de Docker Hub).
3. **Eliminada la clave `version: '3.8'`** obsoleta (ítem adelantado de la lista P2 del ADR-041: mismo archivo, mismo concern, y el warning salía en cada comando de la sesión).
4. **Creado `.env` en la raíz** (no versionado; cubierto por gitignore) con `DB_USER=admin`, `DB_PASSWORD=password123`, `DB_NAME=novotechflow`, para que un volumen fresco inicialice con las credenciales canónicas y la receta del compose sea reproducible. Solo variables de DB: `JWT_SECRET` queda sin definir a propósito — la usa únicamente el servicio `api` del compose, que nunca se levanta localmente (el api corre con pnpm y su propio `apps/api/.env`); el warning resultante es esperado y benigno.
5. **Backup doble antes de tocar producción:** `pg_dump -Fc` ejecutado desde el contenedor local (pg_dump 18.4, idéntico al server, sin instalar nada en Windows), verificado con `pg_restore --list` (117 TOC entries, 71 MB) y guardado en `backups/prod_pre184_2026-06-12.dump`; más backup manual de volumen en Railway (adicional al schedule diario existente, cuyo último corte era de 22 horas atrás).
6. **Aplicado "Upgrade to 18.4" en Railway** — no por los binarios (ya eran 18.4) sino para **pinnear la etiqueta del Source Image**: coherente con la filosofía de pins de toda la auditoría, elimina el no-determinismo de que un futuro redeploy jale lo que el tag flotante `:18` contenga ese día, y retira el banner que generó la confusión. Ejecutado en hora valle con la base quieta.
### Consecuencias
- Local y producción en idéntico PostgreSQL 18.4 — el drift de P1 queda eliminado. Las 29 migraciones y el seed aplican limpios sobre 18: compatibilidad del schema completo confirmada de punta a punta.
- El redeploy de Railway hizo recovery automático del WAL al arrancar (esperado: el contenedor viejo se mata sin checkpoint final). El `invalid record length... got 0` del log es la detección normal del final del WAL, no corrupción; el checkpoint escribió 0 buffers — la base estaba quieta, la hora valle pagó. Verificado post-upgrade: misma cadena de binarios (`18.4-1.pgdg13+1`), 168 propuestas intactas, smoke test en producción OK.
- Warning `collation-refresh: Permission denied` en el arranque: helper del wrapper del template que falló leyendo su archivo temporal. Benigno aquí por diseño — binarios idénticos antes/después, el refresh era un no-op. Bug cosmético del template, no del proyecto.
- La base local fresca solo contiene el seed; los datos de prueba anteriores se descartaron a propósito con el volumen. El usuario admin local se restauró convirtiendo el del seed vía SQL directo (UPDATE de email/nombre/nomenclatura; el hash del seed ya era la contraseña local) — patrón del proyecto para tocar datos.
- Recrear el volumen local ahora es receta reproducible de tres comandos (`down` → `volume rm novotechflow_postgres-data` → `up -d db`), siempre quirúrgico sobre el volumen de postgres, nunca `down -v`.
- Queda cobertura anticipada para la próxima migración de schema: pg_dump verificado en `backups/` + snapshot manual en Railway.
- Futuros saltos de major en local podrán hacerse in-place con `pg_upgrade --link` gracias al layout nuevo.
### Archivos
- `docker-compose.yml` (imagen 18-alpine, mount en `/var/lib/postgresql`, sin clave `version`)
- `.env` raíz (nuevo, no versionado — variables de DB para el compose)
### Commits
- `f598d57` — chore(db): bump local postgres 15 to 18, new volume layout, drop version key
### Pendientes
- **PITR en el Postgres de Railway está apagado.** Considerar habilitarlo (backups continuos + WAL archiving, restore a cualquier punto reciente; activa con un redeploy único). Complementa, no reemplaza, el schedule diario de volumen.
- El ítem "limpiar `version:` obsoleta de docker-compose" de la lista P2 del ADR-041 quedó resuelto aquí; el resto de P2 y P3 sigue según ese ADR, sin cambios.

## ADR-043 — Módulo spec-prefill: extracción de especificaciones de PC por IA desde 5 fuentes hacia items de propuesta
**Fecha:** 2026-06-17
**Estado:** Cerrado (backend y frontend en local; pendiente push a Railway)
### Contexto
Existía un prototipo aparte (`novotech-spec-lab`, carpeta `ProductosDellHpLenovo`) que extraía specs de hardware con Gemini: un módulo NestJS con patrón Strategy y cinco fuentes (texto plano, part number Lenovo vía scraping de PSREF, part number HP vía PartSurfer, Excel y PDF). No era un proyecto ejecutable —sin package.json, tsconfig ni workspace—, sino un paquete pensado para injertarse. Traía su propia capa de persistencia (`Propuesta`/`ItemPropuesta`) desacoplada del modelo real de NovoTechFlow.

El objetivo era llevar ese motor al monorepo para poblar el `technicalSpecs` de un item tipo PC dentro del constructor de propuestas (la categoría `PCS` en `ProposalItemsBuilder`), no para crear un concepto de propuesta paralelo.

El motor del prototipo arrastraba problemas que no podían pasar a producción: `rejectUnauthorized: false` en todas las llamadas TLS, API key de Gemini en query string, `any` generalizado, `console.log`/`console.error`, un import roto a la constante de reglas (`prompt-rules.contants.ts` vs `.constant`), y cada estrategia duplicaba la llamada HTTP, el schema y el parseo.

### Decisión
1. **Dirección B (no fusión de modelos):** se conserva el motor (5 estrategias, scraping PSREF/PartSurfer, prompt de normalización, lineage por campo) y se DESCARTA toda la capa de persistencia del prototipo. El prellenado es stateless: extrae y devuelve specs; la inserción la hace el `saveItem` real de NovoTechFlow sobre `Proposal.technicalSpecs` (JSON). Esto disuelve el bug de "campos descartados al guardar" del prototipo.
2. **Módulo nuevo `apps/api/src/spec-prefill`** (carpetas en inglés, alineadas con `proposals`/`catalogs`): `interfaces/`, `dto/`, `constants/`, `strategies/`, `services/`, más `gemini.client.ts`, el orquestador `spec-prefill.service.ts`, el controller y el module. Registrado en `app.module.ts`. Sin Prisma (no toca DB), `imports: []`.
3. **Cliente Gemini único (`GeminiClient`)** que centraliza la llamada REST a `gemini-3.1-flash-lite` (API v1beta), el backoff ante 503/429, y el parseo de JSON. Correcciones obligatorias frente al prototipo: API key por header `x-goog-api-key` leída de `process.env.GEMINI_API_KEY` en el constructor sin fallback (patrón de `email-verification.service`); **eliminado** `rejectUnauthorized: false` (TLS normal); sin `any` (narrowing con shape mínimo); `Logger` de Nest; magic numbers a constantes nombradas; tipo de excepción `BadGatewayException` para fallo del upstream en vez de envolver todo como 400.
4. **Schema de respuesta compartido** (`spec-schema.constant.ts`, `SPEC_SCHEMA_ARRAY`/`SPEC_SCHEMA_OBJECT`) en vez de la copia inline por estrategia del prototipo (DRY). Se añadió `enum` real al campo `formato` (el prototipo solo lo describía en texto).
5. **Cinco estrategias**, cada una inyecta el `GeminiClient`, arma su prompt con `NORMALIZATION_RULES` y mapea a `ProductoPrefillDto` (`{ value, source }` uniforme; rename `partNumber`→`numeroParte`; limpieza del prefijo de marca en `modelo`):
   - **TextoPlano:** consolidada a UN solo equipo (`SPEC_SCHEMA_OBJECT`). Se eliminó la "regla de líneas independientes" del prototipo, que fragmentaba una descripción larga de un equipo en varios objetos. El multi-equipo por texto no es un caso de v1; los listados van por Excel.
   - **PartNumber (Lenovo/Dell):** el scraping de PSREF se extrajo a un servicio propio `LenovoPsrefService` (handshake cookie/token, cache de menú 12h con promesa compartida anti-stampede, búsqueda de MT, extracción de fila de matriz, fallback a SmartFind), descompuesto en métodos pequeños por el límite de tamaño de función. Códigos Dell: no scrapea, Gemini deduce.
   - **HP PartSurfer:** consulta los dos endpoints BFF (GetPart + GetProduct) en paralelo; devuelven JSON, sin parseo XML.
   - **Excel:** lectura con `exceljs` (ver decisión 7), multi-equipo.
   - **PDF:** extracción con `pdf-parse` 2.x (API de clase `PDFParse.getText()`).
6. **Endpoint `POST /spec-prefill/extract`, stateless:** `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`, DTO con class-validator, `FileInterceptor` con `memoryStorage` (el archivo se procesa en RAM y se descarta; no aplica la regla de base64-en-PG, que es para uploads persistidos). Validación de archivo por **magic bytes sobre buffer** reutilizando `detectMimeFromMagicBytes` de `common/upload-validation` (se exportó; antes era privada). Cada estrategia de archivo afina su propio límite (Excel 5MB, PDF 10MB) además del techo del interceptor.
7. **`exceljs` en vez de `xlsx`:** el paquete `xlsx` de npm está abandonado y congelado en 0.18.5 con dos CVE de severidad alta (prototype pollution y ReDoS) sin fix disponible en npm —el parche solo está en el CDN de SheetJS, lo que complicaría el build de Docker—, y la vulnerabilidad se dispara justo al parsear archivos subidos. `exceljs` está mantenido, instala limpio desde npm, trae sus tipos, y ya se usa en `apps/web`. Se sumó `pdf-parse` (2.4.5, TypeScript, trae tipos) para PDF.
8. **Frontend:** capa de datos en `apps/web/src/lib/specPrefill.ts` (`extraerSpecs` multipart, `colapsarProducto`, filtros), un `PrefillModal` embebido en `ProposalItemsBuilder`, y la integración. UX de v1: el modal aplica **un** equipo al item en construcción (selección por clic cuando la fuente devuelve varios), solo revisión (sin edición dentro del modal; el form de specs ya permite editar tras aplicar), con badge de origen por equipo. El botón "Prellenar IA" solo se muestra dentro del formulario de alta/edición y solo para `itemType` PCS.
9. **Colapso `{ value, source }` → `TechnicalSpecs`:** toma solo el valor, descarta los placeholders que Gemini devuelve cuando no hay dato (`"No especificada"`, `"No aplica"`, `"No incluida"`, `"N/A"`, vacío) tratándolos como vacío, y no escribe `estado` (lo elige el usuario). Se descartan además los equipos sin información útil: un resultado se considera vacío si tras colapsar tiene menos de 2 specs **técnicas** reales (excluyendo los campos de identidad `fabricante`, `numeroParte`, `modelo`, `formato`, que el backend rellena aunque no haya datos). Cubre el caso de un part number que el proveedor no reconoce.

### Consecuencias
- La feature está completa y verificada en local de punta a punta: las cinco fuentes extraen y normalizan correctamente (texto, PSREF real, PartSurfer real, Excel con 5 equipos, PDF), y los specs caen en el item al aplicar.
- v1 aplica un solo equipo. El backend ya devuelve el array completo, así que el **lote** (crear N items de una fuente Excel/PDF de una sola vez) queda lote-ready y es fase 2 (frontend + posible endpoint bulk).
- Los placeholders de "campo sin dato" que devuelve Gemini son inconsistentes entre fuentes (a veces texto, a veces vacío). No se persigue con prompt (frágil); se neutralizan en el colapso del frontend.
- El scraping de PSREF y PartSurfer depende de sitios externos que pueden cambiar sin aviso; es riesgo asumido del negocio, no de diseño. El fallback PSREF→SmartFind mitiga parte.
- `LenovoPsrefService` quedó cerca del límite de tamaño de archivo (§3); se dejó así por decisión explícita (funciones internas cortas, una sola responsabilidad). Si crece, sacar la búsqueda del árbol del menú a un helper.

### Archivos
- `apps/api/src/spec-prefill/**` (módulo completo: interfaces, dto, constants, strategies, services, gemini.client, service, controller, module)
- `apps/api/src/app.module.ts` (registro de SpecPrefillModule)
- `apps/api/src/common/upload-validation.ts` (export de detectMimeFromMagicBytes)
- `apps/api/package.json` + `pnpm-lock.yaml` (exceljs 4.4.0, pdf-parse 2.4.5)
- `apps/web/src/lib/specPrefill.ts` (capa de datos + colapso + filtros)
- `apps/web/src/pages/proposals/components/PrefillModal.tsx` (modal)
- `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx` (integración + botón)

### Commits
- `d641aaa` — feat(spec-prefill): add strategy contract and prefill DTOs
- `f2fcbce` — feat(spec-prefill): add normalization rules and Gemini client
- `38a8b6c` — feat(spec-prefill): add shared spec schema and texto-plano strategy
- `56effc9` — feat(spec-prefill): add Lenovo PSREF service and part-number strategy
- `90c5091` — chore(api): add exceljs for spec-prefill excel parsing
- `f4dd0df` — feat(spec-prefill): add excel strategy with buffer validation
- `0ad8447` — chore(api): add pdf-parse for spec-prefill pdf parsing
- `aa7757a` — feat(spec-prefill): add pdf strategy with buffer validation
- `3f1886e` — feat(spec-prefill): add HP PartSurfer strategy
- `5b8f07a` — feat(spec-prefill): add orchestrator service, controller and module
- `c540f39` — feat(spec-prefill): register module in app.module
- `2644ddd` — feat(spec-prefill): add frontend prefill data layer (api + collapse)
- `93ea3a9` — feat(spec-prefill): add PrefillModal component
- `1fe4912` — feat(spec-prefill): integrate PrefillModal into ProposalItemsBuilder
- `bc8eb87` — fix(spec-prefill): consolidate text input into single device
- `6067cc5` — fix(spec-prefill): discard results without real technical specs
- `c80e22a` — fix(spec-prefill): allow multipart file field in extract DTO
- `45f43ea` — fix(spec-prefill): set multipart content-type for file upload
- `1fcb8cf` — fix(spec-prefill): show prefill button only inside item form

### Pendientes
- **Push a Railway:** antes de desplegar, agregar `GEMINI_API_KEY` a las variables del servicio `api` en Railway, o el bootstrap del `GeminiClient` crashea. El push lo hace Luis tras decidir el momento (puede haber usuarios en producción).
- **Fase 2 — lote:** aplicar varios equipos de una fuente Excel/PDF en una sola operación (crear N items). El backend ya entrega el array; falta el frontend y, posiblemente, un endpoint bulk.
- **Limpieza menor:** el comentario de `PREFILL_SPEC_KEYS` en `apps/web/src/lib/specPrefill.ts` dice "13 keys" pero el array tiene 14.
- **`GEMINI_API_KEY` no se le pasa al servicio `api` del docker-compose** (igual que ya estaba). No afecta `pnpm dev`; solo relevante si algún día se levanta el api por compose.

## ADR-044 — Upgrade de NestJS 10→11: Express 5 por defecto, swagger 7→11 y declaración explícita de multer 2
**Fecha:** 2026-06-18
**Estado:** Cerrado (commiteado y verificado en local; pendiente push a Railway)
### Contexto
Sub-item del P2 del ADR-041 (auditoría de versiones del entorno). El core de NestJS estaba en 10 (`@nestjs/common`, `core`, `platform-express`, `cli`, `schematics`, `testing`), pero `@nestjs/jwt` y `@nestjs/passport` ya en 11 y `@nestjs/throttler` en 6: un estado mezclado, con paquetes de la línea 11 corriendo sobre core 10. La 11 unifica esa base y llega antes de la unificación de TypeScript a 6 (sub-item siguiente del ADR-041) y del salto a ESM de la v12. El diagnóstico se hizo sin asumir: se leyeron los `package.json` reales, `main.ts`, `app.module.ts`, la capa de auth (strategy, guards, module), los usos de multer y las rutas, y se contrastaron los breaking changes contra la guía oficial de migración y el registry de npm.
### Decisión
1. **Core a v11 en `apps/api`:** `@nestjs/common`, `core`, `platform-express`, `cli`, `schematics`, `testing` → 11 (resueltos a 11.1.27, salvo cli 11.0.23 y schematics 11.1.0). Se dejan `@nestjs/jwt` (^11.0.2), `@nestjs/passport` (^11.0.5) y `@nestjs/throttler` (^6.5.0) sin tocar: ya son compatibles con Nest 11.
2. **`@nestjs/swagger` 7 → ^11.4.4:** la 7 solo declara peer de `@nestjs/common` hasta ^10, así que el salto a core 11 la obliga. La versión de swagger alineada con Nest 11 es la 11.x (peer `@nestjs/common`/`core` ^11.0.1), no la 8. El setup en `main.ts` (DocumentBuilder → createDocument → setup) es estable entre 7 y 11 y no requirió cambios de código.
3. **Express 5 entra por defecto con `platform-express` 11** (resuelto express 5.2.1). Impacto evaluado:
   - **Rutas:** cero rutas comodín, cero `@All()`, cero `setGlobalPrefix` con regex → el cambio de path-to-regexp v8 (wildcard con nombre obligatorio) no aplica.
   - **Query parser:** Express 5 abandona `qs` por defecto y deja de parsear arrays/objetos en query string salvo `app.set('query parser', 'extended')`. Los 8 `@Query()` del código leen claves escalares nombradas (string, o un number con `ParseIntPipe`), ninguno array/objeto ni `@Query()` whole-object → no se requiere esa línea. Cero cambios en `main.ts`.
   - **Reflector:** `getAllAndOverride` ahora devuelve `T | undefined`; el único consumidor (`roles.guard.ts`) ya hacía `if (!requiredRoles) return true;` antes de usarlo → tsc en verde sin cambios.
4. **multer 1.x → 2.x** (transitivo vía `platform-express` 11; resuelto 2.1.1). Como seis controllers importan `diskStorage`/`memoryStorage` directamente de `'multer'` sin que el paquete estuviera declarado (phantom import), se declaró `multer` explícito en `apps/api` a ^2.1.1 — la misma 2.1.1 ya resuelta, sin cambio funcional, una sola copia en el árbol. Elimina la fragilidad del import implícito ante futuros cambios del árbol de dependencias.
5. **Sin cambios de código fuente:** el upgrade fue 100% operación de dependencias (`package.json` + lockfile), aplicada por Claude Code (instalar/actualizar dependencias está fuera del alcance de Antigravity, CONVENTIONS §0). `tsc --noEmit` de api en verde, sin regenerar Prisma.
### Consecuencias
- Verificado en runtime en local: arranque sin `DeprecationWarning` de path-to-regexp, login completo (passport-jwt + JwtModule), endpoint admin protegido por RolesGuard, `/api/docs` y `/api/docs-json` sirviendo (swagger 11 genera el documento OpenAPI en el arranque), subida de archivos (multer 2.x con disk y memory storage) y servido de `/uploads/` (serve-static de Express 5), y ThrottlerGuard cortando en 429 exactamente al pasar de 30 req/min.
- Node ya estaba en 22 (Nest 11 exige ≥20). No se usa `@nestjs/config` ni `@nestjs/cache-manager`, así que sus breaking changes (precedencia de config, migración a Keyv) no aplican.
- TypeScript queda heterogéneo a propósito (raíz 6.0.2, api ^5.1.3 → 5.9.x, web ~5.9.3); api resuelve a 5.9.x, soportado por Nest 11. La unificación a 6 es el sub-item siguiente del ADR-041.
- `multer` queda con doble fuente de versión (la directa ^2.1.1 + la que pinnea `platform-express`). Si `platform-express` salta a multer 3.x, realinear el caret para no arrastrar dos majores.
- El salto de swagger fue de 7 a 11 de una vez; no rompió el setup básico, pero queda como nota que cualquier uso avanzado de decoradores `@Api*` conviene revisarlo si se amplía la documentación OpenAPI.
### Archivos
- `apps/api/package.json` (core `@nestjs/*` 10→11, swagger 7→^11.4.4, cli/schematics/testing 10→11, multer declarado ^2.1.1)
- `pnpm-lock.yaml`
### Commits
- `42e6fa9` — chore(api): upgrade NestJS core to v11 (Express 5, multer 2)
### Pendientes
- **Push a Railway (servicio `api`):** lo hace Luis tras decidir el momento (puede haber usuarios en producción); revisar el build/deploy log del servicio.
- **Sub-items P2+ restantes del ADR-041**, en orden: unificar TypeScript a 6 (siguiente), ESLint 8→9, Turborepo 1→2. La v12 de NestJS (ESM) queda en el horizonte, fuera de este ciclo.
- Si `platform-express` sube multer a una major nueva, realinear el caret de la dependencia directa de `multer`.

## ADR-045 — Migración de ESLint 8→9 (flat config) en apps/api
**Fecha:** 2026-06-18
**Estado:** Cerrado (commiteado y verificado en local con `tsc` y carga de config; pendiente push a master)

### Contexto
Sub-item de la auditoría de versiones (P2 del ADR-041, listado en los Pendientes del ADR-044). `apps/api` era el último holdout en ESLint 8 con formato legacy `.eslintrc.js`, aislado y sin consumir el paquete compartido `@repo/eslint-config`, que ya estaba en ESLint 9 + flat config (eslint ^9.39.1, typescript-eslint ^8.50.0, eslint-config-prettier ^10.1.1, globals ^16.5.0). Las versiones objetivo ya estaban resueltas y en el store del monorepo, así que el upgrade no requirió traer nada nuevo de la red. ESLint 9 usa flat config por defecto; mantener eslintrc habría dependido de `ESLINT_USE_FLAT_CONFIG=false`, deuda que se evita migrando.

Se decidió convertir el config a flat preservando el comportamiento de lint actual, sin adoptar el paquete compartido: este apunta a frontend/React/Next y usa `eslint-plugin-only-warn` (degrada todo a warning), lo que sería un cambio de comportamiento, no un bump de versión.

### Decisión
1. **Conversión a flat config aislada:** se reemplaza `apps/api/.eslintrc.js` por `apps/api/eslint.config.mjs` (extensión `.mjs` para usar imports ESM sin cambiar el `type` CommonJS del paquete). Se replica el comportamiento del legacy: `typescript-eslint` recommended + `eslint-plugin-prettier/recommended`, globals de node/jest, `parserOptions.project` apuntando a `tsconfig.json`. Se conservan las 3 reglas en `off` (`explicit-function-return-type`, `explicit-module-boundary-types`, `no-explicit-any`).
2. **Drop de `@typescript-eslint/interface-name-prefix`:** la regla fue removida del plugin hace años; en eslintrc era un no-op silencioso, pero bajo flat config en ESLint 9 una regla inexistente es error duro de carga. Se elimina.
3. **Alineación de dependencias al paquete compartido:** en `apps/api/package.json` se reemplazan `@typescript-eslint/eslint-plugin` y `@typescript-eslint/parser` (^8.0.0) por el meta-paquete `typescript-eslint` (^8.50.0); se sube `eslint` ^8→^9.39.1, `eslint-config-prettier` ^9→^10.1.1, `eslint-plugin-prettier` ^5.0.0→^5.2.0 (el export flat `/recommended` aparece desde 5.1.2); se agrega `globals` ^16.5.0. Versiones idénticas a las ya resueltas en `@repo/eslint-config` para garantizar una sola versión en el monorepo.
4. **`typescript` no se toca:** se mantiene en ^5.1.3, dentro del rango soportado por typescript-eslint v8. El bump a TS 6 es otro sub-item P2 independiente.
5. **Limpieza del glob del script lint:** `eslint "{src,apps,libs,test}/**/*.ts"` → `eslint "{src,test}/**/*.ts"`; `apps` y `libs` no existen dentro de `apps/api` (eran patrones fantasma).

### Consecuencias
- `pnpm install` resolvió sin un solo peer warning; net `+1 -123` paquetes (limpieza de la cadena vieja de `@typescript-eslint/*` separados). El `typescript@5.1.3` local de api convive con el `typescript@6.0.2` de la raíz sin colisión (scopes distintos).
- El lint carga y corre correctamente con el flat config nuevo: imports ESM, `tseslint.config()`, el export `eslint-plugin-prettier/recommended`, `parserOptions.project` y el set de reglas resuelven sin error de carga.
- ESLint 9 cambió el default de `reportUnusedDisableDirectives` a `warn`: aparece 1 warning por una directiva `eslint-disable` obsoleta (apuntaba a `no-var-requires`, regla renombrada a `no-require-imports`). Benigno.
- El lint sigue reportando hallazgos de código preexistentes (mayoría `prettier/prettier` por CRLF en el working tree, más 6 hallazgos sustantivos de typescript-eslint). No fueron introducidos por la migración: el legacy ya los reportaba. Su saneamiento queda fuera de esta tarea; el de CRLF se atiende en el item separado de `.gitattributes`/renormalización.
- No se modificó código fuente `.ts`; el commit es exclusivamente dev-tooling. No corre `migrate deploy`; sin impacto en el artefacto de producción.

### Archivos
- `apps/api/eslint.config.mjs` (nuevo, flat config ESM)
- `apps/api/.eslintrc.js` (eliminado)
- `apps/api/package.json` (devDependencies + script lint)
- `pnpm-lock.yaml`

### Commits
- `0a8df31` — chore(api): migrate eslint to 9 flat config

### Pendientes
- **CRLF→LF:** ~2915 hallazgos `prettier/prettier` de finales de línea en el working tree; se resuelven con `.gitattributes` + `git add --renormalize`, no con `--fix` masivo (reescribiría 69 archivos de golpe). Item de auditoría ya registrado.
- **6 hallazgos sustantivos de typescript-eslint:** 4 `no-unused-vars`, 1 `no-require-imports`, 1 directiva `eslint-disable` sobrante. Revisar y sanear por separado.
- **Push a master:** el commit `0a8df31` está local (`ahead 1`), pendiente de push para desplegar.
- **P2 restantes de la auditoría:** TypeScript 6 (raíz ya en `6.0.2`; falta `apps/api`/`apps/web`) y Turborepo 1→2.

## ADR-046 — Renormalización de fin de línea a LF: cobertura de .gitattributes y re-checkout del working tree
**Fecha:** 2026-06-18
**Estado:** Cerrado (cobertura commiteada en `4c55abb`, pendiente push; re-materialización del working tree aplicada en local sin commit asociado)

### Contexto
Item recurrente de la auditoría: el lint de `apps/api` reportaba cientos de hallazgos `prettier/prettier` de tipo `Delete ␍` (CRLF) tras migrar a ESLint 9 (ADR-045). El diagnóstico con `git ls-files --eol` reveló que el índice ya estaba 100% en LF (516 archivos `i/lf`, 0 `i/crlf` ni `i/mixed`): el repo commiteado nunca estuvo corrupto. El problema era doble y exclusivamente local: (1) un hueco de cobertura en `.gitattributes` —no incluía `*.mjs`/`*.cjs`/`*.sh`, dejando `apps/api/eslint.config.mjs` a merced de `core.autocrlf=true` (heredado del gitconfig de sistema)—, y (2) el working tree tenía 98 archivos materializados en CRLF en disco pese a que el índice y `.gitattributes` mandaban LF, por la optimización de stat-cache de git que daba esos archivos por correctos.

### Decisión
1. **Cierre del hueco de cobertura en `.gitattributes`:** se agregaron `*.mjs text eol=lf encoding=utf-8`, `*.cjs text eol=lf encoding=utf-8` y `*.sh text eol=lf`. Los dos primeros cierran el hueco comprobado (`eslint.config.mjs`); `*.sh` es preventivo y alineado con el propósito del archivo (evitar CRLF llegando a Alpine, fallo clásico `bad interpreter: ^M`). Se excluyeron `.ps1`/`.bat`/`.cmd` deliberadamente: no existen en el repo y serían la única familia que querría CRLF; una excepción `eol=crlf` rompería la uniformidad "todo LF" sin beneficio presente.
2. **`--renormalize` NO es la herramienta cuando el índice ya está en LF:** opera sobre el índice; con el índice ya 100% LF, `git add --renormalize .` es un no-op y no toca el working tree. El fix correcto del working tree es forzar un re-checkout desde el índice: `git rm --cached -r . ; git reset --hard`. Esto vacía el índice y obliga a git a re-escribir todos los archivos aplicando los smudge filters de `.gitattributes` (→ LF en disco), derrotando el stat-cache.
3. **La re-materialización del working tree NO produce commit:** como el índice ya era LF, re-escribir el disco a LF no genera diferencia commiteable; `git status` queda limpio. Es un arreglo puramente local/cosmético, sin impacto en producción ni en el push.

### Consecuencias
- La re-materialización bajó los archivos en CRLF en disco de 98 a 35. Los 35 restantes tienen `attr/` vacío (extensiones no cubiertas: `.gitignore`, `.dockerignore`, `.prettierrc`, `.toml`, `.conf`, `.webmanifest`, `.txt`, y ruido de `backups/`); son inofensivos para el lint. Cero `.ts`/`.tsx` quedaron en CRLF; ambos `Dockerfile` y `eslint.config.mjs` pasaron a LF.
- Re-corrido el lint sin `--fix`: los hallazgos de CRLF (`Delete ␍`) cayeron a **0**. El total bajó de 2921 a 2096 problemas.
- **Corrección de magnitud registrada:** durante la migración ESLint (ADR-045) se caracterizó el grueso de los 2915 `prettier/prettier` como CRLF. El conteo real lo desmiente: el CRLF era ~825 hallazgos (≈28%); los 2090 restantes son violaciones de formato genuinas de prettier (indentación, reflow de imports/parámetros) preexistentes en el código fuente, independientes del fin de línea. La normalización a LF no las toca por diseño.
- El warning de `autocrlf` "LF will be replaced by CRLF" para `.mjs` desaparece en el próximo checkout.

### Archivos
- `.gitattributes` (raíz) — agregadas reglas `*.mjs`/`*.cjs`/`*.sh`
- Working tree (re-materializado a LF; sin cambio en índice ni archivos commiteados)

### Commits
- `4c55abb` — chore: cover mjs cjs sh line endings in gitattributes

### Pendientes
- **Formateo del código de `apps/api`:** quedan 2090 hallazgos `prettier/prettier` de formato real (no EOL). Llevar el lint a verde requiere `prettier --write`/eslint `--fix`, que reescribe archivos fuente `.ts` —cambio sustantivo, no cosmético—; se hará en tarea propia, idealmente acotada por módulo para revisar el diff y en commit separado.
- **6 hallazgos sustantivos de typescript-eslint:** 4 `no-unused-vars`, 1 `no-require-imports`, 1 directiva `eslint-disable` obsoleta (apunta a `no-var-requires`, renombrada). Sanear a mano por separado.
- **Cobertura opcional adicional en `.gitattributes`:** `apps/web/nginx.conf` sigue en CRLF y va a build Docker/Alpine; candidato a `*.conf text eol=lf` o `nginx.conf text eol=lf`. Otros (`*.toml`, `*.txt`) de baja prioridad (mayoría en `backups/`).
- **Push a master:** el commit `4c55abb` (y los 3 previos de la sesión) están locales, `ahead 4`.

## ADR-047 — Saneo de los 6 hallazgos de typescript-eslint en apps/api
**Fecha:** 2026-06-18
**Estado:** Cerrado (commiteado y verificado en local con `tsc` y re-lint; pendiente push)

### Contexto
Sub-item de la auditoría de versiones, derivado de la migración a ESLint 9 (ADR-045): tras la renormalización a LF (ADR-046), el lint de `apps/api` quedó con 6 hallazgos sustantivos no-prettier que el legacy ESLint 8 ya reportaba pero que nunca se habían saneado: 4 `@typescript-eslint/no-unused-vars`, 1 `@typescript-eslint/no-require-imports`, y 1 warning de directiva `eslint-disable` obsoleta. Se localizaron con contexto antes de tocar nada, porque cada uno tenía un tratamiento distinto y dos requerían verificación de runtime antes de decidir el fix.

### Decisión
1. **Imports muertos eliminados:** se quitó `Query` del import de `@nestjs/common` en `catalogs.controller.ts` y `BlockType` del import de `@prisma/client` en `templates.service.ts` (ambos símbolos sin usar; `PageType` se conserva).
2. **`no-unused-vars` con ignore por prefijo `_`:** se agregó la regla a `eslint.config.mjs` como `['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }]`, para soportar el patrón de omisión por destructuring sin afectar el resto de la regla.
3. **Patrón omit en `clients.service.ts` corregido con rename pattern:** la línea destructura `score` solo para excluirlo del objeto devuelto (`({ score, ...client }) => client`). El fix correcto NO es reemplazar la clave por `_score` (eso busca una propiedad `_score` inexistente → error de tipos `TS2339` y deja `score` dentro de `client`, rompiendo el omit), sino **renombrar el binding**: `({ score: _score, ...client }) => client`. Así se sigue extrayendo `score` (omit intacto) y el valor se liga a `_score`, cubierto por `varsIgnorePattern: '^_'`. El que aplica a este caso (rest sibling en destructuring de objeto) es `varsIgnorePattern`, no `destructuredArrayIgnorePattern` (ese es para arrays).
4. **Directiva de `sanitize.ts` actualizada, `require()` conservado:** la regla `no-var-requires` fue renombrada a `no-require-imports`, lo que dejó la directiva huérfana (warning) y el `require()` marcado por la regla nueva. Se actualizó la directiva al nombre vigente, resolviendo ambos hallazgos a la vez. **No se migró a import ESM** a propósito: `esModuleInterop` está en `false` en el tsconfig de api y `sanitize-html` es CommonJS puro (`export = sanitize`); un `import sanitizeHtml from 'sanitize-html'` compilaría (por `allowSyntheticDefaultImports`) pero emitiría `require(...).default` = `undefined` en runtime, rompiendo silenciosamente la sanitización XSS.
5. **Constante muerta eliminada:** se borró `ALLOWED_CSV_MIMES` de `upload-validation.ts`. Se verificó que no se referencia en el archivo y que no es un hueco de seguridad: la validación de CSV usa el enfoque correcto (denylist por magic bytes + estructura + anti-inyección de fórmulas), no allowlist de MIME, porque el MIME de un CSV es texto plano y spoofeable. La constante era vestigio de un enfoque descartado.

### Consecuencias
- `tsc --noEmit` sobre `apps/api/tsconfig.build.json` pasa en verde; quitar símbolos de imports no rompió tipos.
- El re-lint sin `--fix` reporta 0 hallazgos no-prettier: 0 `no-unused-vars` (incluido que `_score` ya no se marca), 0 `no-require-imports`, 0 de la directiva obsoleta.
- El error `TS2339` de un fix intermedio mal especificado (clave `_score` en vez de rename) fue atrapado por `tsc` antes del commit; quedó registrado como lección: el lint solo lo habría visto como "variable resuelta" mientras rompía el shape del retorno.
- El lint sigue con EXIT 1 por los hallazgos `prettier/prettier` de formato, ajenos a esta tarea.

### Archivos
- `apps/api/eslint.config.mjs` (regla `no-unused-vars` con opciones)
- `apps/api/src/catalogs/catalogs.controller.ts`
- `apps/api/src/clients/clients.service.ts`
- `apps/api/src/common/sanitize.ts`
- `apps/api/src/common/upload-validation.ts`
- `apps/api/src/templates/templates.service.ts`

### Commits
- `9bc5aa4` — fix(api): resolve typescript-eslint findings

### Pendientes
- **Formateo del código de `apps/api`:** quedan los hallazgos `prettier/prettier` de formato (indentación, reflow); requiere `prettier --write`/`--fix` que reescribe `.ts` fuente. Tarea propia, acotada por módulo, commit separado.
- **Modernización del interop de módulos (opcional):** activar `esModuleInterop: true` en el tsconfig de api permitiría migrar el `require('sanitize-html')` a import ESM. Cambia el emit de todos los imports del proyecto → tarea aparte con `tsc` de regresión, no un cambio de un archivo.
- **Push a master:** `9bc5aa4` está local (`ahead 1`), pendiente de push.

## ADR-048 — Unificación de TypeScript a 6.0.2 en el monorepo: bump coordinado de typescript-eslint y ts-jest por restricción de peers

**Fecha:** 2026-06-19
**Estado:** Cerrado (commiteado y verificado en local con tsc, nest build y lint; pendiente push)

### Contexto

P2 del ADR-041 (auditoría de versiones) pedía unificar TypeScript, que estaba declarado con cinco specs divergentes: root `6.0.2` (exacto), `apps/api` `^5.1.3`, `apps/web` `~5.9.3`, `packages/ui` `5.9.2` y `packages/eslint-config` `^5.9.2`. La precondición "después de NestJS 11" ya estaba satisfecha (ADR-044, cerrado y desplegado).

El riesgo real no era homogéneo. `apps/web` ya estaba en 5.9.x con config estricta (`strict: true`, `verbatimModuleSyntax: true`, `moduleResolution: bundler`): salto corto. `apps/api` era el de fondo: nunca se había type-chequeado contra nada posterior a 5.1 (su único chequeo es efecto colateral de `nest build`), arrancaba desde config laxa (`strict` ausente, `strictNullChecks: false`, `esModuleInterop` ausente, `noImplicitAny: false`) y `@types/node@20`. Subir de 5.1 a 6.0 podía destapar errores de tipos enmascarados.

Hecho de método que permitió medir sin riesgo: el root pinea `6.0.2` y las apps no lo heredan (pnpm resuelve el `tsc` de cada workspace a su propia versión). Corriendo `tsc` desde la raíz contra la config actual de cada proyecto, se obtuvo un preview fiel del post-bump (mismo compilador, mismos flags, mismos `@types`) sin tocar ningún `package.json`.

### Decisión

1. **Unificar `typescript` a `6.0.2` exacto** (sin `^` ni `~`) en los cinco manifiestos que lo declaran, igualando el pin del root. `packages/typescript-config` no declara `typescript` y queda fuera.
2. **Subir `typescript-eslint` a `^8.58.0`** en `apps/api`, `apps/web` y `packages/eslint-config`. La versión instalada (8.56.1) tenía peer `>=4.8.4 <6.0.0`, que excluye 6.0.2; 8.58.0 es la primera línea con peer `>=4.8.4 <6.1.0`. Se mantiene rango `^` (recoge parches de la serie 8); resolvió a 8.61.1.
3. **Subir `ts-jest` a `^29.4.11`** en `apps/api`. La versión instalada (29.4.6) tenía peer `>=4.3 <6`; 29.4.11 amplía a `>=4.3 <7` dentro de la misma serie 29.4.x (sin cambio de major). Se mantiene rango `^` (ts-jest no usa semver estándar, su major sigue a jest).
4. **No endurecer strictness en `apps/api`.** Este ADR sube versión, no toca `strict`/`strictNullChecks`/`esModuleInterop` (eso es decisión aparte). Se mantiene la decisión del ADR previo de no migrar `esModuleInterop` a `true`.
5. **Edición de los `package.json` vía Claude Code** (no son `.ts` fuente), con reinstall (`pnpm install --no-frozen-lockfile`) corrido también por Claude Code.

### Consecuencias

- **Cero regresiones de tipos.** Cuatro dry-runs con 6.0.2 dieron 0 errores antes del bump: `apps/api` (tsconfig.build.json, 74 archivos), `apps/web` app (tsconfig.app.json, 106 archivos), `apps/web` node (tsconfig.node.json) y `packages/ui` (tsconfig.json). Tras el bump, los mismos type-checks con 6.0.2 ya resuelto local replicaron 0 + 0 + 0.
- **Cero unmet peers** tras resolver typescript-eslint y ts-jest. El reinstall no dejó ningún peer pendiente.
- **`nest build` exit 0**: `@nestjs/cli` compila con TS 6 (su peer no restringe typescript). Prisma Client se regeneró tras recrearse `node_modules` (el postinstall queda ignorado por pnpm 10).
- **Lint sin el warning de "TypeScript version not officially supported"** en api ni web: typescript-eslint 8.61.1 acepta 6.0.2 limpio. `apps/api` lint en 0 problemas.
- **Versiones reales resueltas:** `typescript` 6.0.2 en los cinco; `typescript-eslint` 8.61.1; `ts-jest` 29.4.11.

### Archivos

- `apps/api/package.json` — typescript `^5.1.3`→`6.0.2`, typescript-eslint `^8.50.0`→`^8.58.0`, ts-jest `^29.1.0`→`^29.4.11`
- `apps/web/package.json` — typescript `~5.9.3`→`6.0.2`, typescript-eslint `^8.48.0`→`^8.58.0`
- `packages/ui/package.json` — typescript `5.9.2`→`6.0.2`
- `packages/eslint-config/package.json` — typescript `^5.9.2`→`6.0.2`, typescript-eslint `^8.50.0`→`^8.58.0`
- `pnpm-lock.yaml` — regenerado por el reinstall

### Commits

- `b64c2d7` — chore: unify typescript to 6.0.2; bump typescript-eslint and ts-jest peers

### Pendientes

- **11 hallazgos de `pnpm --filter web lint`, pre-existentes (no inducidos por este bump).** Confirmado: código byte-idéntico a HEAD y reglas de plugins que el bump no cambió (react-hooks 7.0.1, react-refresh 0.4.26, eslint core 9.39.3); los 2 de `@typescript-eslint/no-explicit-any` disparan sobre `as any` literal en `DefaultPagesAdmin.tsx`. Deuda de lint a atacar por separado: `react-refresh/only-export-components` (×3), `react-hooks/purity` por `Date.now` en `useInactivityTimeout.ts`, `react-hooks/exhaustive-deps` en `PdfPreviewModal.tsx`, `no-useless-escape` en `constants.ts`, directiva eslint-disable sin uso en `proposalVariables.ts`, `no-explicit-any` (×2), `prefer-const` (×2) en `ProposalItemsBuilder.tsx`.
- Ni `apps/api` ni `apps/web` tienen script `check-types`; `turbo run check-types` solo cubre `packages/ui`. El type-check de las apps depende hoy de sus respectivos `build`. Pendiente evaluar agregar `check-types` por app para cobertura uniforme vía Turbo (encaja con el P2 de Turborepo 1→2).
- Endurecer strictness en `apps/api` (`strict`/`strictNullChecks`) queda como decisión futura separada de la unificación de versión.

## ADR-049 — Eliminación de Antigravity del modelo de trabajo: Claude Code asume toda la ejecución salvo el push a producción

**Fecha:** 2026-06-19
**Estado:** Cerrado (documentos del repo commiteados; Instrucciones de UI pendientes de pegar por Luis; pendiente push)

### Contexto

El modelo de trabajo del proyecto era de tres roles: Claude (chat) planeaba y redactaba prompts, Antigravity era el único editor de código fuente y de `DECISIONS.md`, y Claude Code hacía diagnósticos de solo lectura, búsquedas y git local hasta el commit. Antigravity tenía un contrato de ejecución restrictivo (prohibido buscar en el filesystem, ejecutar comandos o instalar dependencias) codificado en la Sección 0 de `CONVENTIONS.md` y desarrollado en `INSTRUCTIVO_CLAUDE.md`.

Luis decidió eliminar Antigravity (deja de pagarlo) y consolidar toda la ejecución en Claude Code, para no alternar entre dos herramientas. El modelo pasa a dos roles más Luis: Claude (chat) planea y decide; Claude Code ejecuta todo en el entorno (lectura, escritura, búsqueda, instalación de dependencias, builds, `tsc`, migraciones, git hasta el commit); Luis valida cada paso y es el único que hace el `push` a `master`.

La documentación de proceso estaba fuertemente acoplada a Antigravity y al patrón "Luis corre los comandos en PowerShell", repartida en tres lugares con contenido que debía quedar consistente: `CONVENTIONS.md` (= `AGENTS.md`), `INSTRUCTIVO_CLAUDE.md` y las Instrucciones del proyecto en la UI de Claude.

### Decisión

1. **Reescritura de la Sección 0 de `CONVENTIONS.md`** (replicada idéntica en `AGENTS.md`, que es su espejo byte a byte). El "Contrato de Ejecución para Agentes de IA" pasa de prohibir búsqueda/ejecución/instalación a un modelo de dos roles. Se conservan las salvaguardas que no dependían de Antigravity: alcance acotado, "ante la duda párate", diff antes de aplicar, autoverificación. El único límite absoluto es el `push` a producción, que lo hace Luis.
2. **Reescritura completa de `INSTRUCTIVO_CLAUDE.md`** (de la versión de 139 líneas a una nueva de 9 secciones). Sale la sección de reglas de prompts a Antigravity; entra una sección de modelo de dos roles y otra de cómo se redacta un prompt para Claude Code. El protocolo de ADR pasa a indicar que la escritura del ADR la hace Claude Code con el método sin-BOM, no Antigravity. Se conservan la regla madre, la tabla de encoding y los comandos PowerShell de referencia.
3. **Reescritura de las Instrucciones del proyecto en la UI de Claude** (texto entregado a Luis para pegar manualmente; no es archivo del repo). Autosuficiente en lo esencial (modelo de dos roles + flujo de cinco pasos), remitiendo a `INSTRUCTIVO_CLAUDE.md` para el detalle operativo.
4. **Flujo de cinco pasos confirmado:** Claude (chat) redacta el prompt → Luis lo pega en Claude Code → Claude Code ejecuta y reporta (salida, diffs, hallazgos), sin decidir el siguiente paso → Luis pega el resultado en el chat → Claude evalúa y decide el siguiente paso. Claude Code reporta; el chat evalúa.

### Consecuencias

- **La disciplina de revisión gana peso, no lo pierde.** Como Claude Code ahora ejecuta, instala y borra de verdad, el alcance de un error es mayor; por eso "alcance acotado", "diff antes de aplicar" y "ante la duda párate" se mantienen como red de seguridad principal, reforzados explícitamente en la §0 nueva.
- **`CONVENTIONS.md` y `AGENTS.md` siguen byte-idénticos** (verificado por hash SHA256 antes y después; `AGENTS.md` se regeneró con `Copy-Item` desde `CONVENTIONS.md` para no arriesgar divergencia por doble edición).
- **Encoding preservado:** los tres archivos del repo quedaron UTF-8 sin BOM y LF; verificado con conteo de bytes BOM, conteo de CR y conteo de U+FFFD en cero. La reescritura de `INSTRUCTIVO_CLAUDE.md` se hizo con `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)`.
- **Tres documentos a mantener consistentes** en adelante: `CONVENTIONS.md`/`AGENTS.md` e `INSTRUCTIVO_CLAUDE.md` en el repo, y las Instrucciones de UI fuera de git. Lo esencial del modelo vive en los tres (poco texto, sincronizable); el detalle operativo solo en `INSTRUCTIVO_CLAUDE.md`.

### Archivos

- `CONVENTIONS.md` — Sección 0 reescrita al modelo de dos roles
- `AGENTS.md` — espejo byte-idéntico de `CONVENTIONS.md` (regenerado con `Copy-Item`)
- `INSTRUCTIVO_CLAUDE.md` — reescritura completa (9 secciones; sin Antigravity salvo una mención histórica en §2)
- Instrucciones del proyecto en la UI de Claude — reescritas (NO es archivo del repo; lo pega Luis manualmente)

### Commits

- `25c8ac9` — docs: drop Antigravity from workflow; Claude Code executes all but push

### Pendientes

- **Luis debe pegar las Instrucciones de UI nuevas** en la configuración del proyecto en Claude.ai (fuera de git; no queda rastro en el repo).
- Actualizar la memoria de proyecto de Claude, que aún describe el modelo viejo de tres roles con Antigravity como editor único.
- Push de la rama a `master` (lo hace Luis tras confirmar que no hay usuarios en producción); a este punto la rama acumula los commits de la sesión: ADR-047, bump TS, ADR-048 y esta migración.

## ADR-050 — Remediación de deuda de lint pre-existente en apps/web: 10 de 12 hallazgos resueltos en 6 commits, 2 diferidos

**Fecha:** 2026-06-20
**Estado:** Implementada (parcial: 10 de 12 hallazgos resueltos en 6 commits ya en master, `f9998e7`→`515af1c`; 2 diferidos a un refactor dedicado de `useInactivityTimeout`; este ADR pendiente de push)

### Contexto

`pnpm --filter web lint` (script `eslint .`, sin `--fix`) reportaba hallazgos pre-existentes en `apps/web`, **no** introducidos por el bump de TypeScript (ADR-048) ni por la migración a Claude Code (ADR-049): el código era byte-idéntico a HEAD y las reglas provienen de plugins que el bump no cambió.

Toolchain: eslint 9.39.3, typescript-eslint 8.61.1, eslint-plugin-react-hooks 7.0.1 (basado en React Compiler) y eslint-plugin-react-refresh 0.4.26, sobre TypeScript 6.0.2.

Diagnóstico inicial (solo lectura, contra el repo real, HEAD `f9998e7`): 11 hallazgos en 8 archivos — `react-refresh/only-export-components`, `react-hooks/purity`, `react-hooks/exhaustive-deps`, `@typescript-eslint/no-explicit-any`, `no-useless-escape`, `prefer-const` y una directiva `eslint-disable` muerta.

### Decisión

1. **Remediación incremental:** arreglos afines agrupados por commit (no todo en uno), con gate de verificación por commit — los hallazgos objetivo desaparecen, no surgen hallazgos nuevos, `tsc --noEmit` en verde, y prueba manual en browser para los cambios que tocan runtime. Push a master solo tras verificar cada commit.
2. **Sin silenciar reglas** (`eslint-disable`) y **sin `any` / `as unknown as` / `@ts-ignore`:** cada arreglo resuelve la causa, no la oculta.

### Consecuencias

- **10 de 12 hallazgos resueltos** en 6 commits, ya en master (`f9998e7` → `515af1c`).
- **Corrección de alcance 11 → 12:** al corregir `react-hooks/purity` en `useInactivityTimeout` afloró un `react-hooks/set-state-in-effect` pre-existente que estaba **enmascarado** — el plugin (React Compiler) aborta el análisis del hook ante la impureza, ocultando hallazgos posteriores del mismo hook. Lección para este toolchain: un hallazgo puede enmascarar a otros dentro del mismo hook, y corregir uno destapa el siguiente (ocurrió en cadena: purity → set-state en la rama `!token` → set-state vía `startTimers()`).
- **Estado del lint en master tras la remediación:** `pnpm --filter web lint` reporta 1 hallazgo (#4, `react-hooks/purity`); #12 permanece enmascarado hasta que se corrija #4 (reaparecerá al sanear la impureza).
- **Nota de deuda de tipos (no bloqueante) — `DefaultPagesAdmin`/preview:** la assertion `t.content as ProposalPage['blocks']` (commit `d97c3a3`) genera bloques sin `pageId` (`TemplateBlock` no lo tiene; `PageBlock` sí). Verificado inocuo en runtime: la ruta de render del preview (`PdfPreviewModal` y aguas abajo, en flujo admin y normal) solo lee `blockType` y `content`; ningún punto lee `block.pageId` (grep exhaustivo + barrido adversarial). Quedaría latente como bug del flujo admin si en el futuro se agrega una lectura de `block.pageId` en el preview.

### Archivos

- `apps/web/src/lib/constants.ts` — #6 escape de regex innecesario (`no-useless-escape`)
- `apps/web/src/lib/proposalVariables.ts` — #7 directiva `eslint-disable` muerta (`max-len` no activa)
- `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx` — #10/#11 `prefer-const`
- `apps/web/src/pages/admin/DefaultPagesAdmin.tsx` — #8/#9 dos `as any` reemplazados por `ProposalPage['pageType']` y `ProposalPage['blocks']`
- `apps/web/src/components/proposals/EconomicProposalTable.tsx`, `apps/web/src/lib/itemDescription.ts` (nuevo) y `apps/web/src/lib/exportProposalExcel.ts` (actualiza el import) — #1/#2 react-refresh: extracción de `buildQuickDescription` y `getUnitOfMeasure`
- `apps/web/src/components/proposals/SpecFieldsSection.tsx` y `apps/web/src/components/proposals/sectionThemes.ts` (nuevo) — #3 react-refresh: extracción de `SECTION_THEMES`, sus iconos lucide-react y el tipo `SectionTheme`
- `apps/web/src/components/proposals/PdfPreviewModal.tsx` — #5 `react-hooks/exhaustive-deps`
- `apps/web/src/hooks/useInactivityTimeout.ts` — #4 + #12 **diferidos** (ver Pendientes)

### Commits

- `458cd72` — chore(web): remove useless regex escape and dead eslint-disable directive (#6 en `constants.ts`, #7 en `proposalVariables.ts`)
- `a2d9fea` — refactor(web): use const for non-reassigned bindings in ProposalItemsBuilder (#10/#11; #10 requirió partir el destructuring porque `value` sí se reasigna)
- `d97c3a3` — refactor(web): type admin preview pages instead of casting to any (#8/#9; tipados con `ProposalPage['pageType']` y `ProposalPage['blocks']`)
- `0bdc2df` — refactor(web): extract item description helpers out of EconomicProposalTable (#1/#2; a `lib/itemDescription.ts`)
- `8caaacc` — refactor(web): extract SECTION_THEMES out of SpecFieldsSection (#3; a `components/proposals/sectionThemes.ts`)
- `515af1c` — fix(web): add missing resolveImageUrl dependency in PdfPreviewModal (#5; memoización de `resolveImageUrl` en `useCallback([apiBase])`, inclusión en las deps de `buildVisualPages` y retiro de `apiBase` como dep directa redundante)

### Pendientes

- **Saneamiento de `useInactivityTimeout` (#4 + #12) — RESUELTO** (commit `a80302e`, `fix(web): remove impure Date.now and sync setState in useInactivityTimeout`; lint de web en verde, `tsc --noEmit` de web en verde, prueba de browser OK a cargo de Luis: aviso al minuto correcto + cuenta regresiva + auto-logout + reset por actividad + dismiss). El enmascaramiento predicho se dio en cadena al sanear cada impureza: #4 `react-hooks/purity` (`Date.now()` en render, L27) → resuelto con `useRef(0)` (el valor inicial estaba muerto: `scheduleTimers` sobrescribe `lastActivityRef` con `Date.now()` al montar, antes de cualquier lectura). Al caer #4 aflora #12 `react-hooks/set-state-in-effect` en la rama `!token` (L88) → se quita el `setShowWarning(false)` de esa rama y la visibilidad del aviso se **deriva** en el retorno (`showWarning && Boolean(token)`), cubriendo el logout con aviso visible sin depender del desmontaje. Al caer ese, aflora un tercero: `startTimers()` en el effect (L91), porque hacia `setShowWarning(false)`/`setSecondsLeft(60)` sincronos al montar → se parte `startTimers` en `scheduleTimers` (solo agenda los timers, sin reset — seguro al montar porque el estado ya esta en su valor inicial) y `restartTimers` (reset + agenda, invocado solo desde `handleActivity`, en callback de evento fuera del effect). Comportamiento del cronometro identico en todos los caminos. No aparecio un cuarto hallazgo: el hook quedo con lint limpio.
- **Push de este ADR a `master`** (lo hace Luis tras confirmar que no hay usuarios en producción). Los 6 commits de la remediación ya están en master; este ADR-050 queda local.

## ADR-051 — Convención de selección de modelo de Claude Code por prompt y refinamiento del flujo decisión-primero

**Fecha:** 2026-06-21
**Estado:** Implementada (INSTRUCTIVO_CLAUDE.md §1, §5 y §6 ya en local, commits `b96b822` y `79a861c`; instrucciones del proyecto en Claude.ai a cargo de Luis, fuera de git; este ADR pendiente de push)

### Contexto

El modelo de dos roles (ADR-049) fija que el chat decide y Claude Code ejecuta, pero no normaba qué modelo de Claude Code usar en cada prompt ni cuándo el flujo exige un esbozo explícito. En la práctica esto quedaba implícito: el chat indicaba sesión `NUEVA|MISMA` pero no el modelo, y el "esbozo + espera de visto bueno" se aplicaba como paso fijo incluso para tareas mecánicas (un `grep`, correr `tsc`), agregando ceremonia sin valor. Luis trabaja en Claude.ai en Opus para el razonamiento de decisión y diseño; Claude Code corre con el modelo que Luis seleccione (`/model` o `claude --model`).

### Decisión

1. **Modelo explícito por prompt.** Cada prompt para Claude Code se encabeza con `Modelo: <x> · Sesión: NUEVA|MISMA`. El modelo es hermano del indicador de sesión ya existente. Se justifica solo cuando no es el default.
2. **Regla de niveles** (criterio: cuánto se delega decidir y cuánto cuesta rehacer si falla): **Haiku** para mecánico puro y bajo riesgo (`grep`/`Select-String`, `tsc`/build, `str_replace` verbatim sobre código); **Sonnet** (default) para buscar-y-reportar con juicio, ediciones que Claude Code arma desde la descripción, leer código para confirmar estado y migraciones rutinarias; **Opus** (pensamiento alto/ultra, justificado) para ejecución compleja o irreversible que cruce capas o pueda dar estados inesperados.
3. **Piso Sonnet para markdown del repo.** Todo cambio en `DECISIONS.md`, `CONVENTIONS.md` e `INSTRUCTIVO_CLAUDE.md` corre en Sonnet como mínimo, aunque sea un `str_replace` verbatim. Razón: si el `old_str` no calza exacto, un modelo más débil improvisa, y un acento o un molde mal escrito en una fuente de verdad es deuda invisible. No es que Haiku corrompa UTF-8; es el costo asimétrico del error en estos archivos.
4. **Esbozo solo ante decisión real.** El esbozo explícito (objetivo + archivos + reglas) se reserva para cuando hay una decisión que tomar; para mecánica obvia el prompt va directo. Tras aprobar el plan, la ceremonia colapsa: prompt → ejecución → resultado → veredicto + siguiente prompt en el mismo mensaje, sin "¿avanzo?" entre pasos previstos. Los gates no se tocan: un paso a la vez, `tsc`, mojibake en `DECISIONS.md`, diffs antes de aplicar, push solo de Luis.
5. **`opusplan` no aplica.** El plan se arma en el chat; Claude Code solo ejecuta. El nivel de pensamiento arrastra con el modelo.

### Consecuencias

- Los prompts ganan una dimensión de control (modelo) que ajusta costo y riesgo por tarea sin que Claude Code decida nada por su cuenta.
- El flujo decisión-primero reduce ceremonia en tareas mecánicas y concentra el análisis a fondo donde está el criterio, sin debilitar los gates de validación.
- Reafirma ADR-049: el diseño y la estrategia viven en el chat; Claude Code participa como "ojos" vía prompts de solo lectura (incluido reconocimiento amplio para cortar idas y vueltas), nunca en un loop donde decida y ejecute.
- Refuerzo de tono y entrega (conversación concisa orientada a objetivos, prompts y ADR finales sin borrador, documentos entregados completos): vive en las instrucciones del proyecto en Claude.ai, fuera de git.

### Archivos

- `INSTRUCTIVO_CLAUDE.md` — §1 (esbozo → "solución o el esbozo"), §5 (flujo decisión-primero reescrito), §6 (viñeta de modelo + subsección "Selección de modelo (por prompt)" con tabla de niveles)

### Commits

- `b96b822` — docs: align esbozo flow with decision-first dynamic
- `79a861c` — docs: add Claude Code model-selection convention to prompt guide

### Pendientes

- **Push de este ADR a `master`** (lo hace Luis tras confirmar que no hay usuarios en producción). Junto con los commits `b96b822` y `79a861c` de esta sesión.
- **Luis pega las instrucciones del proyecto actualizadas** en la configuración de Claude.ai (fuera de git) y **re-sube la copia de `INSTRUCTIVO_CLAUDE.md`** al conocimiento del proyecto, reemplazando la versión previa.

## ADR-054 — Rol REPORTER de solo lectura: acceso global a propuestas y proyecciones, blindaje deny-by-default en backend y dashboard de solo lectura
**Fecha:** 2026-06-24
**Estado:** Implementada y en produccion (`origin/master`). El rol REPORTER y su guard base se desplegaron por la rama `feature/reporter-role-clean`. Nota (ADR-056, 2026-07-04): esta linea corrige el estado previo, que decia "sin pushear en rama": el despliegue ya ocurrio. El endurecimiento posterior de dos endpoints de lectura quedo registrado en el ADR-056.

### Contexto
Se necesitaba un tipo de usuario que pudiera consultar todas las oportunidades del dashboard y generar los dos reportes de Excel (exportacion del dashboard y reporte de proyeccion), sin capacidad de editar, crear ni navegar a ninguna otra pantalla. El objetivo de negocio es habilitar perfiles de consulta y reporteria sin darles acceso de escritura ni a los modulos operativos.

El enum de roles tenia solo `ADMIN` y `COMMERCIAL`. Los dos `findAll` relevantes (`proposals.service` y `billing-projections.service`) filtraban por dueno para todo lo que no fuera `ADMIN`. La proteccion de escritura de los controladores de `proposals` y `billing-projections` se apoyaba solo en `JwtAuthGuard` a nivel de metodo: cualquier usuario autenticado podia mutar. Las rutas de propuestas del frontend eran accesibles para cualquier rol no-admin. Un requisito central —"no puede entrar a ver ninguna otra cosa"— exigia blindaje real en el backend, no solo ocultar controles en la UI: un usuario con token podria pegar a los endpoints de mutacion directamente.

### Decisión
1. **Rol REPORTER en el enum y en los tipos.** Se agrego `REPORTER` al enum `Role` de Prisma (migracion `20260623223750_add_reporter_role`) y a las uniones de tipo del JWT (`JwtPayload`, `AuthenticatedUser` en `auth.dto.ts`, y la firma de `login` en `auth.service.ts`), mas `UserRole` en el frontend (`lib/types.ts`).
2. **Acceso de lectura global.** Los dos `findAll` ahora eximen del filtro por dueno tanto a `ADMIN` como a `REPORTER` (`user.role === 'ADMIN' || user.role === 'REPORTER' ? {} : { userId: user.id }`). REPORTER ve todas las propuestas y proyecciones, igual que ADMIN.
3. **Blindaje deny-by-default via guard a nivel de clase.** Se creo `ReporterReadOnlyGuard` (`common/guards/reporter.guard.ts`), que calca a `AdminGuard`: extiende `JwtAuthGuard`, autentica con `super.canActivate` y lanza `ForbiddenException` si `request.user.role === 'REPORTER'` y `request.method !== 'GET'`. Se aplico a nivel de clase en `proposals.controller` y `billing-projections.controller`. REPORTER pasa en los GET (lo que el dashboard y los reportes necesitan leer) y rebota con 403 en toda mutacion, incluidas las que se agreguen a futuro en esos controladores.
4. **Eliminacion de la redundancia de guards.** Como el guard de clase ya autentica, se quitaron los ~33 `@UseGuards(JwtAuthGuard)` redundantes de nivel de metodo en ambos controladores (mas el import sin uso). Esto evita que Passport corra `validate()` —que consulta la DB— dos veces por request. Los dos `@UseGuards(AdminGuard)` de papelera/restore se conservan intactos.
5. **Encierro de rutas en el frontend.** Se agrego `ReporterRoute` (espejo de `AdminRoute`) que rebota a REPORTER a `/dashboard`. Envuelve solo las 4 rutas de propuestas; `/dashboard` queda accesible para los tres roles y las rutas admin siguen bajo `AdminRoute` (que ya rebota a REPORTER por no ser ADMIN).
6. **Dashboard de solo lectura.** Se corrigio el ternario de `Dashboard.tsx` que colapsaba todo rol no-ADMIN en `COMMERCIAL` (ahora `user?.role ?? 'COMMERCIAL'`). Se ocultaron para REPORTER todos los controles de mutacion (botones del header, botones de fila, selects de estado/adquisicion, inputs de fecha, en propuestas y proyecciones). Estado y Adquisicion se muestran como badge de solo lectura replicando el formato de `ProposalGroupHeaderRow`. Se conservan filtros, las dos exportaciones y el campo TRM.
7. **Asignacion del rol en gestion de usuarios.** Se agrego la opcion REPORTER a los dropdowns de crear y editar usuario, se amplio la interface local `UserData`, y se cambio el badge binario de la tabla a tres casos (REPORTER con color propio). El backend no requirio cambios: el payload manda el rol como string, validado por `CreateUserDto` con `@IsEnum(Role)`, y el enum de Prisma ya incluye REPORTER.

### Consecuencias
- REPORTER lee todo, no muta nada (blindado en backend), y solo navega el dashboard (blindado en frontend). Las dos exportaciones funcionan porque consumen datos ya en memoria; no requirieron endpoints nuevos.
- El whitelist efectivo de REPORTER es el conjunto de endpoints que el dashboard dispara solo por loguearse: `login`, `verify-code`, `GET /proposals`, `GET /billing-projections`, `GET /app-settings/maintenance-banner`, `POST /presence/heartbeat`, `GET /app-settings/inactivity-timeout`. La TRM es externa al API.
- **Regla a recordar (limitacion consciente del deny-by-default por controlador):** el guard de clase cierra las mutaciones de `proposals` y `billing-projections`, y la lectura de otros modulos ya esta cerrada por `AdminGuard`. Pero si a futuro se agrega un modulo no-admin nuevo con un GET sin guard de rol, REPORTER podria leerlo hasta que se le aplique su propio guard. Hoy no existe ese hueco (proposals y billing-projections son los unicos no-admin, y sus GET son justo lo que REPORTER debe ver).
- Beneficio colateral de rendimiento: al quitar los `JwtAuthGuard` redundantes de metodo, los endpoints de esos dos controladores hacen una sola consulta de auth por request en lugar de dos.
- Verificado en local: creacion de usuario REPORTER, acceso solo al dashboard, ambas exportaciones operativas, controles de mutacion ausentes, rebote desde rutas de propuestas. El boton de reporte de proyeccion depende de que existan proyecciones y TRM cargada (no del rol).

### Archivos
- `apps/api/prisma/schema.prisma` — `REPORTER` en enum `Role`.
- `apps/api/prisma/migrations/20260623223750_add_reporter_role/` — migracion del enum.
- `apps/api/src/auth/dto/auth.dto.ts`, `apps/api/src/auth/auth.service.ts` — `REPORTER` en las uniones de rol del JWT.
- `apps/api/src/proposals/proposals.service.ts`, `apps/api/src/billing-projections/billing-projections.service.ts` — acceso global de lectura para REPORTER en `findAll`.
- `apps/api/src/common/guards/reporter.guard.ts` — `ReporterReadOnlyGuard` (nuevo).
- `apps/api/src/proposals/proposals.controller.ts`, `apps/api/src/billing-projections/billing-projections.controller.ts` — guard de clase aplicado, `JwtAuthGuard` redundante de metodo removido.
- `apps/web/src/lib/types.ts` — `UserRole` ampliado.
- `apps/web/src/components/auth/PrivateRoutes.tsx`, `apps/web/src/App.tsx` — `ReporterRoute` y su uso.
- `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/dashboard/components/ProposalVersionRow.tsx` — dashboard de solo lectura.
- `apps/web/src/pages/Users.tsx` — opcion REPORTER en el formulario y badge.

### Commits
- `8facda9` — `feat(api): add REPORTER role to enum and JWT types`
- `97564b0` — `feat(api): grant REPORTER read access to all proposals and projections`
- `69b19bc` — `feat(api): block REPORTER from mutations via controller-level guard`
- `64359a4` — `refactor(api): drop redundant method-level JwtAuthGuard now covered by class guard`
- `8604e17` — `feat(web): add ReporterRoute guard to lock REPORTER out of proposal routes`
- `62e7df5` — `feat(web): make dashboard read-only for REPORTER role`
- `a6970da` — `feat(web): add REPORTER role option to user management form`
- Pendiente — commit de este ADR-054 (`docs: ADR-054 REPORTER read-only role`)

### Pendientes
- **Push diferido.** La feature esta aislada en `feature/reporter-role` sin pushear. El merge a `master` espera a la resolucion (o decision consciente) del incidente de produccion abierto. Orden de merge: `feature/external-api` primero, luego esta rama.
- **Commit de merge ajeno a la feature.** La rama tiene mergeado localmente el commit del modo-dev 2FA (`fix/local-2fa-dev-mode`, log del codigo en consola en desarrollo) para poder probar en local. Ese cambio es infraestructura de desarrollo, no parte de REPORTER; debe resolverse su destino (rama propia / no arrastrarlo al merge de REPORTER a produccion) antes del push.

## ADR-055 — Protocolo de depuración: diagnóstico antes de cambio, sección 10 del instructivo y skills de Claude.ai
**Fecha:** 2026-07-04
**Estado:** Implementada. La sección 10 quedó insertada en `INSTRUCTIVO_CLAUDE.md` en `master` (commit `888a231`, sin pushear). Los skills `depuracion-web` (nuevo) y `novotechflow` (actualizado) y las instrucciones del proyecto viven en Claude.ai, fuera de git.

### Contexto
Las prácticas de depuración del proyecto (diagnóstico primero, aislar la capa antes de tocar código, no declarar resuelto sin evidencia) se aplicaban por criterio pero no estaban en ninguna fuente de verdad, por lo que dependían de la memoria de cada sesión. Dos hechos motivaron formalizarlas: (1) el incidente de producción abierto desde junio mostró el costo de la disciplina — la señal apunta a capa de transporte y el fix de código propuesto quedó pausado justamente por falta de evidencia de causa raíz; (2) el redespliegue de Claude Fable 5 (2026-07-01), cuya ventaja documentada es bug-finding recall y cuya metodología (medir, loggear, verificar antes de cerrar) coincide con la práctica del proyecto, pero cuyo clasificador reenruta tareas benignas de depuración a Opus 4.8 si el framing es inadecuado. Fable está incluido en el plan hasta 2026-07-07; después pasa a créditos.

### Decisión
1. **Sección 10 nueva en `INSTRUCTIVO_CLAUDE.md`** como protocolo operativo de depuración: regla madre (diagnóstico ≠ cambio — ningún fix sin aprobación explícita de Luis), fases 0–6 (reproducir/evidencia, explorar solo lectura, aislar la capa, fix mínimo con criterio de verificación previo, ejecutar, verificar, registrar), tabla de aislamiento de capa (código / transporte / config / datos / dependencias), selección de modelos en depuración (Fable 5 para prompts de diagnóstico de solo lectura mientras esté incluido; fixes con la tabla normal de §6), checklist post-cambio como gate, bloque obligatorio de tres líneas para todo prompt de diagnóstico, y pasadas de auditoría para bugs ocultos (una pasada = un invariante, sesión NUEVA, solo lectura, hallazgos a `docs/audits/`, demostrar antes de arreglar).
2. **Skill `depuracion-web` (Claude.ai, nuevo):** método general de depuración, portable a otros proyectos; en NovoTechFlow convive con el skill `novotechflow`.
3. **Skill `novotechflow` (Claude.ai, actualizado):** incorpora REPORTER, la API externa (rama `feature/external-api`), la referencia al protocolo de depuración y tres reglas duraderas ya aprendidas por incidentes (DATABASE_URL de Railway siempre por referencia, `pg_dump` antes de migraciones de schema a producción, `prisma generate` tras cambiar de rama con migraciones).
4. **Instrucciones del proyecto actualizadas** (Claude.ai): bug reportado → primero diagnóstico con evidencia; y todo `.md` que Luis reemplaza a mano se entrega como archivo descargable completo.

### Consecuencias
- Ningún fix de bug se aplica sin diagnóstico aprobado: la primera entrega ante un bug es causa raíz + evidencia + fix mínimo propuesto.
- Todo prompt de diagnóstico lleva el bloque de 10.5 y se encabeza `Modelo: Fable 5 · Sesión: NUEVA` hasta 2026-07-07; después, diagnóstico complejo en Opus y el resto en Sonnet.
- La sección 10 es la fuente operativa dentro del repo; los skills duplican el método por diseño para chats fuera del proyecto. En conflicto, gana `CONVENTIONS.md` y gana el disco.
- Los skills viven fuera de git y no se versionan aquí: se actualizan solo ante cambios estructurales (modelo de trabajo, regla no negociable, glosario).

### Archivos
- `INSTRUCTIVO_CLAUDE.md` — sección 10 nueva (única modificación en el repo).
- Fuera de git: skills `depuracion-web` y `novotechflow`, e instrucciones del proyecto, en Claude.ai.

### Commits
- `888a231` — `docs: agrega protocolo de depuracion (seccion 10) al instructivo`
- Pendiente — commit de este ADR-055 (`docs: ADR-055 protocolo de depuracion`)

### Pendientes
- **Push de ambos commits a `master`** (lo hace Luis; Claude pregunta antes si es el momento — puede haber usuarios en producción). El attachment de `INSTRUCTIVO_CLAUDE.md` en Claude.ai ya quedó reemplazado con contenido idéntico al del disco.
- **Piloto de pasada de auditoría** (10.6) sobre el invariante de REPORTER, con Fable 5 y solo lectura, idealmente antes de 2026-07-07.

## ADR-056 — Endurecimiento de la superficie de lectura de REPORTER: auditoria de invariante y cierre de dos endpoints fuera del whitelist
**Fecha:** 2026-07-04
**Estado:** Implementada. Fix en `master` (commit `e1da449`), verificado en local. Auditoria en `docs/audits/reporter-invariant.md` (commit `9630371`). Ambos commits pendientes de push a `origin/master`.

### Contexto
El rol REPORTER (ADR-054) ya estaba en produccion (`origin/master`). Aplicando el protocolo de depuracion (INSTRUCTIVO_CLAUDE.md §10.6), se corrio una pasada de auditoria de un invariante con Claude Fable 5, solo lectura, sobre la rama `feature/reporter-role`: "un REPORTER autenticado no puede mutar ningun dato por ninguna ruta, y solo lee los endpoints que el dashboard necesita". La clausula de no-mutacion se cumple en los 13 controladores. La clausula de superficie de lectura no se cumplia en forma estricta: REPORTER podia leer 5 GET adicionales y ejecutar 1 POST de computo (sin mutacion de datos) fuera del whitelist, todo atribuible a la limitacion consciente del ADR-054 (endpoints con solo `JwtAuthGuard` quedan legibles). Dos de esos exponian datos sensibles.

### Decisión
1. **Cerrar los dos hallazgos de severidad media** con el patron allowlist ya existente en el proyecto (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN, Role.COMMERCIAL)`, usado en users y templates): `POST /spec-prefill/extract` (parseo de archivos, sin mutacion de datos pero fuera del alcance de solo-lectura) y `GET /clients/search` (enumeracion de nombres y NIT de clientes). Se eligio el patron allowlist y no `ReporterReadOnlyGuard` porque este ultimo solo bloquea no-GET, y uno de los dos endpoints es un GET.
2. **Aceptar y registrar como bajo impacto** los hallazgos #3 a #6: `GET /proposals/client-history` (no amplia la exposicion real: REPORTER ya ve todas las propuestas por el findAll global del ADR-054), `GET /app-settings/price-thresholds`, `GET /catalogs/*` y `GET /spec-options/suggest` (datos de referencia/config de bajo valor; cerrarlos no justifica el cambio).
3. **Diferir** el hallazgo #7 (el rol se toma del payload del JWT y no de la DB): no rompe el invariante en la direccion auditada (un token REPORTER siempre lleva REPORTER); su fix es estructural.
4. **Corregir el Estado del ADR-054**, que habia quedado desactualizado ("sin pushear en rama") cuando el rol ya estaba en produccion.

### Consecuencias
- REPORTER queda denegado con 403 en los dos endpoints cerrados; ADMIN y COMMERCIAL siguen accediendo.
- La superficie de lectura de REPORTER fuera del dashboard se reduce a datos de referencia de bajo impacto (#4-#6), documentados y aceptados.
- El fix reusa un patron ya presente; no introduce un guard nuevo.
- Verificacion funcional en local (CONVENTIONS §H): sobre `feature/reporter-role` con `e1da449` cherry-pickeado (`8bf4da1`) y el modo-consola de 2FA, login como usuario REPORTER real, dashboard con sus restricciones esperadas y sin acceso a otras pantallas.
- Limitacion vigente del ADR-054: si a futuro se agrega un modulo no-admin con un GET sin guard de rol, REPORTER podria leerlo hasta aplicarle su guard.

### Archivos
- `apps/api/src/spec-prefill/spec-prefill.controller.ts`, `apps/api/src/clients/clients.controller.ts` — patron @Roles(ADMIN, COMMERCIAL) + RolesGuard (commit `e1da449`, master).
- `docs/audits/reporter-invariant.md` — auditoria completa (commit `9630371`).
- `DECISIONS.md` — correccion del Estado del ADR-054 (este commit).

### Commits
- `e1da449` — `fix(api): deny REPORTER on spec-prefill extract and clients search`
- `9630371` — `docs: audit reporter read-only invariant`
- Pendiente — commit de este ADR-056 (`docs: ADR-056 harden REPORTER read surface`)

### Pendientes
- **Push de `master` a `origin/master`** (lo hace Luis cuando no haya comerciales en produccion): incluye `e1da449`, `9630371` y el commit de este ADR-056.
- La rama de prueba `feature/reporter-role` conserva el cherry-pick `8bf4da1` (solo para verificacion local); no se mergea.
- Hallazgos #4-#6 aceptados; #7 diferido por ser estructural.

## ADR-057 — getMaintenanceBanner a lectura pura: fin de la escritura en un GET y ajuste de intervalos de polling
**Fecha:** 2026-07-06
**Estado:** Implementada. Backend (commit `f383288`) y frontend (commit `42d19b4`) en local, `tsc` verde en ambos proyectos. Los dos commits mas el de este ADR quedan pendientes de push a `origin/master`.

### Contexto
Durante el incidente de lentitud intermitente del 23 de junio (`ERR_HTTP2_PROTOCOL_ERROR` + 502 esporadicos en `apps/web` y `apps/api`), la evidencia apunto a un blip de la capa compartida de Railway (edge/HTTP2): el error aparecio en los dos servicios, incluido un `.png` estatico del front, con CPU ~0, RAM plana, Error Rate 0.0% y sin `P2024`. El incidente no volvio a ocurrir y se calmo solo; era transitorio y global, no atribuible a codigo del proyecto.

En el mismo diagnostico se confirmo, por los logs de Prisma, un defecto real e independiente del incidente: `getMaintenanceBanner()` abria dos transacciones `upsert` (BEGIN/COMMIT sostenido 1-3s) en cada `GET /app-settings/maintenance-banner`. Un endpoint de lectura escribia en cada llamada. El front pollea ese endpoint cada 60s (`useMaintenanceBanner.ts`, montado ademas en dos componentes en paralelo) y `/presence/active` cada 30s (`useActiveUsers.ts`). Ese patron (Opcion A: endurecer el getter + bajar el ruido de polling) quedo pausado en su momento para no venderlo como cura del incidente. Cerrado el incidente por autoresolucion, se retomo como hardening.

### Decisión
1. **`getMaintenanceBanner()` pasa a lectura pura:** un unico `findMany` de las dos keys (`maintenance_banner_message`, `maintenance_banner_active`) con defaults en memoria (`message: ''`, `active: false`) cuando alguna no existe. Cero escritura en el GET.
2. **La unica escritura se mueve al `PATCH` del admin:** `updateMaintenanceBanner()` pasa de `update` plano a `upsert`, para que la fila se cree la primera vez que un admin toca el banner. Se descarto sembrar con `onModuleInit` o `seed.ts`: agrega piezas y una escritura al arranque sin beneficio: el getter ya resuelve el default en memoria y la lectura queda garantizada sin escrituras en cualquier entorno.
3. **Subir los intervalos de polling** (hardening, sin cambio de UX): banner de 60s a 5 min (el banner solo cambia cuando un admin programa mantenimiento); active-users de 30s a 60s (panel solo-admin, volumen bajo).

### Consecuencias
- El `GET /app-settings/maintenance-banner` deja de abrir transacciones; se elimina el par de `upsert` sostenidos por request y el ruido asociado.
- La fila de cada key no existe en DB hasta el primer `PATCH` del admin; irrelevante para la lectura, que ya devuelve el default.
- El antipatron upsert-en-getter sigue presente en `getInactivityTimeoutMinutes()` y en price-thresholds; no se toca (no se pollean como el banner). Deuda registrada, no corregida aqui.
- `useMaintenanceBanner` se sigue montando en dos componentes (banner global + control de admin), con dos timers en paralelo cuando el admin esta en el dashboard; subir el intervalo mitiga, deduplicar queda como mejora futura.
- El write de `last_seen_at` por heartbeat de presencia (era la Opcion B) no se toca: subir el intervalo de `useActiveUsers` baja lecturas del panel, no los writes del heartbeat.
- Verificacion funcional en navegador (CONVENTIONS §H) pendiente a cargo de Luis: banner visible/oculto segun estado, edicion del banner por admin persiste, panel de usuarios activos refresca.

### Archivos
- `apps/api/src/app-settings/app-settings.service.ts` — `getMaintenanceBanner()` a `findMany` + defaults en memoria; `updateMaintenanceBanner()` de `update` a `upsert`; JSDoc actualizado (commit `f383288`).
- `apps/web/src/hooks/useMaintenanceBanner.ts` — intervalo 60s a 5 min (commit `42d19b4`).
- `apps/web/src/hooks/useActiveUsers.ts` — intervalo 30s a 60s (commit `42d19b4`).
- `DECISIONS.md` — este ADR (este commit).

### Commits
- `f383288` — `fix(app-settings): make getMaintenanceBanner a pure read`
- `42d19b4` — `perf(web): raise app-settings polling intervals`
- Pendiente — commit de este ADR-057 (`docs: ADR-057 maintenance banner pure read`)

### Pendientes
- **Push de `master` a `origin/master`** (lo hace Luis cuando no haya comerciales en produccion): incluye `f383288`, `42d19b4` y el commit de este ADR-057.
- Verificacion funcional en navegador a cargo de Luis (banner, edicion admin, panel de activos).
- Deuda registrada, no abordada: upsert-en-getter en inactivity y price-thresholds; doble timer de `useMaintenanceBanner`; write de `last_seen_at` del heartbeat.

## ADR-058 — Cruce de Cuentas como herramienta suelta con ruta propia
**Fecha:** 2026-07-07
**Estado:** Implementado en master (commits 9e07d29 + 72e9c37), pendiente de push a origin/master y deploy de apps/web en Railway.

### Contexto
El "cruce de cuentas" (deteccion de solapamiento comercial: al teclear el nombre del cliente, lista propuestas del ultimo ano de cualquier comercial que coincidan, para no cruzar cuentas) existia unicamente embebido en la pantalla de creacion de propuesta (NewProposal.tsx): un useEffect debounced mas un panel lateral, ambos inline. Para consultarlo habia que entrar al flujo de crear una propuesta, aun cuando la intencion fuera solo verificar si un cliente ya lo trabaja alguien. Se pidio exponer esa consulta como funcion independiente accesible desde el sidebar del Dashboard, debajo de "Nueva Propuesta", para todos los roles, sin alterar el comportamiento actual dentro de NewProposal.

El endpoint que alimenta la consulta ya existia: GET /proposals/client-history -> findPotentialConflicts(), lectura pura (Prisma findMany, contains case-insensitive sobre clientName o subject, ultimo ano, max 10), sin filtro por comercial (comportamiento intencional, revisado en auditoria 2026-04-05). Bajo ReporterReadOnlyGuard a nivel de clase, que deja pasar GETs. No se necesito backend nuevo, endpoint nuevo ni migracion.

### Decision
1. Extraer las piezas inline de cruce de cuentas de NewProposal.tsx a unidades reutilizables, sin cambio de comportamiento (refactor puro): hook useAccountConflicts (la busqueda debounced), componente ConflictPanel en components/proposals/, interface ConflictRecord a lib/types.ts, y las constantes CONFLICT_SEARCH_DEBOUNCE_MS / MIN_CONFLICT_SEARCH_LENGTH a lib/constants.ts. NewProposal pasa a consumir el hook y el componente, y su panel se mantiene identico (mismo lugar, mismo debounce, misma UI). Fuente unica, sin duplicar codigo.
2. Crear la pantalla suelta pages/tools/AccountCrossCheck.tsx, que reusa el mismo hook y el mismo panel con un input de cliente propio. Cero logica de negocio nueva, cero llamada api nueva.
3. Registrar la ruta /tools/account-cross-check en App.tsx FUERA del bloque ReporterRoute, hermana de /dashboard, dentro de AppLayout + PrivateRoute. Al ser una consulta de solo lectura y pedirse para todos los roles, REPORTER debe poder usarla; ponerla bajo ReporterRoute (como estan las rutas de /proposals/*) lo habria rebotado al dashboard. Esta es la diferencia deliberada con "Nueva Propuesta": esa es mutacion y sigue vetada a REPORTER; el cruce es lectura y va para todos.
4. Agregar el item "Cruce de Cuentas" (icono Search) al array navItems de Sidebar.tsx, despues de "Nueva Propuesta", visible para todos los roles (no en adminItems).

### Consecuencias
- El cruce de cuentas queda con una sola implementacion consumida en dos lugares (NewProposal y la herramienta suelta); un cambio futuro en la busqueda o el panel se hace una sola vez.
- REPORTER ahora ve y usa "Cruce de Cuentas" sin rebote; es coherente con que REPORTER ya ve todas las propuestas (ADR-054) y el endpoint es un GET permitido por su guard. No expone dato nuevo.
- Queda un patron nuevo en el proyecto: herramientas sueltas de solo-lectura bajo /tools/, fuera de ReporterRoute, reutilizando piezas extraidas de un flujo mayor.
- El match del endpoint tambien pega contra subject, por lo que puede traer propuestas de otros clientes cuyo asunto contenga el texto; comportamiento preexistente heredado, no modificado aqui.

### Archivos
- `apps/web/src/hooks/useAccountConflicts.ts` — hook nuevo con la busqueda debounced (commit `9e07d29`).
- `apps/web/src/components/proposals/ConflictPanel.tsx` — panel extraido, reutilizable (commit `9e07d29`).
- `apps/web/src/lib/types.ts` — interface ConflictRecord (commit `9e07d29`).
- `apps/web/src/lib/constants.ts` — CONFLICT_SEARCH_DEBOUNCE_MS, MIN_CONFLICT_SEARCH_LENGTH (commit `9e07d29`).
- `apps/web/src/pages/proposals/NewProposal.tsx` — consume hook + panel, sin cambio de comportamiento (commit `9e07d29`).
- `apps/web/src/pages/tools/AccountCrossCheck.tsx` — pantalla suelta nueva (commit `72e9c37`).
- `apps/web/src/App.tsx` — ruta /tools/account-cross-check fuera de ReporterRoute (commit `72e9c37`).
- `apps/web/src/layouts/Sidebar.tsx` — item Cruce de Cuentas en navItems (commit `72e9c37`).

### Commits
- `9e07d29` — `refactor(web): extract cruce de cuentas to reusable hook and component`
- `72e9c37` — `feat(web): add Cruce de Cuentas standalone tool with own route`
- Pendiente — commit de este ADR-058 (`docs: ADR-058 cruce de cuentas standalone tool`)

### Pendientes
- **Push de `master` a `origin/master`** (lo hace Luis cuando no haya comerciales en produccion): dispara deploy de apps/web en Railway. Cambio 100% frontend; api no se toca.
- Verificacion en navegador con un usuario REPORTER real confirmada por Luis (item entra sin rebote, panel funciona).

## ADR-059 — Ciudad de emisión obligatoria en el constructor del documento

**Fecha:** 2026-07-09
**Estado:** Aceptado

### Contexto

El campo "Ciudad de emisión" del constructor del documento (`ProposalDocBuilder`) tenía un valor por defecto hardcodeado `'Bogotá D.C.'` en tres sitios: los estados locales `selectedCity` y `savedCity`, y como fallback al cargar la propuesta (`data.issueCity || 'Bogotá D.C.'`). No existía validación de obligatoriedad en ninguna capa: ni marca visual en el campo, ni bloqueo de la generación del PDF, ni restricción en el DTO (`@IsOptional()`) o el schema (`issueCity String?`).

Esto producía dos problemas. Primero, la persistencia de la ciudad es manual (botón "✓ Guardar", que solo aparece si el valor cambió); una propuesta donde el usuario dejaba el default sin tocar quedaba con `issue_city` NULL en la base, mostrando "Bogotá D.C." solo por el default en memoria. Segundo, la ciudad alimenta el marcador `µCiudad` del documento vía `replaceMarkers`, que no sustituye valores vacíos: una ciudad en `""` dejaría el literal `µCiudad` sin reemplazar en el PDF final.

### Decisión

Hacer la ciudad de emisión obligatoria y vacía por defecto en documentos nuevos, forzando una elección explícita del usuario:

1. **Backfill de datos.** Migración de datos (no de schema) que rellena `issue_city = 'Bogotá D.C.'` en todas las propuestas con el campo NULL, preservando el valor que ya venían mostrando. Idempotente (`WHERE "issue_city" IS NULL`).
2. **Vacío por defecto.** Eliminados los tres defaults hardcodeados en `ProposalDocBuilder`; el campo arranca en `''` para documentos nuevos. Tras el backfill, toda propuesta existente ya trae su ciudad, así que el cambio solo afecta a documentos nuevos.
3. **Marca visual de obligatorio.** `CityCombobox` recibe una prop `required`; muestra un asterisco rojo en el label y un borde inferior rojo cuando el campo está vacío. Se activa solo en propuestas editables (`required={!isReadOnly}`).
4. **Bloqueo del PDF.** El botón "Vista Previa PDF" se deshabilita mientras la ciudad esté vacía, con tooltip explicativo. Esto impide llegar a la generación del documento sin ciudad, evitando el marcador `µCiudad` sin reemplazar.

El DTO del backend se deja como `@IsOptional()`: `PATCH /proposals/:id` es un update parcial y forzar la presencia del campo rompería otros updates de la propuesta. La obligatoriedad se garantiza en el frontend (default vacío + bloqueo del PDF), no en el contrato del PATCH.

### Consecuencias

- Los documentos nuevos exigen una elección explícita de ciudad antes de generar el PDF; se elimina la clase de bug del marcador `µCiudad` sin reemplazar por ciudad vacía.
- Las propuestas existentes (incluidas las cerradas/solo-lectura, que no se pueden editar) conservan su ciudad gracias al backfill; ninguna queda con el PDF roto.
- La migración modifica datos de producción. Es idempotente y fue precedida de `pg_dump`.
- La obligatoriedad vive solo en el frontend. Un cliente de la API que haga PATCH directo aún puede dejar `issueCity` nulo; se aceptó por no romper la naturaleza parcial del endpoint.

### Archivos

- `apps/api/prisma/migrations/20260709005733_backfill_issue_city_default/migration.sql` — backfill de datos.
- `apps/web/src/pages/proposals/components/CityCombobox.tsx` — prop `required`, asterisco, borde de aviso.
- `apps/web/src/pages/proposals/ProposalDocBuilder.tsx` — eliminación de los defaults, paso de `required`, bloqueo del botón PDF.

### Commits

- `eec6fdd` — chore(db): backfill issueCity for existing proposals
- `6ef618e` — feat(proposals): make issue city required, empty by default

### Pendientes

Ninguno.

## ADR-060 — Persistencia de la TRM del día al crear el escenario: fin de la TRM flotante en memoria

**Fecha:** 2026-07-09
**Estado:** Aceptado

### Contexto

La TRM de conversión de un escenario (`Scenario.conversionTrm`, `Float?` nullable) nacía en NULL: `createScenario` en el backend acepta el campo (`CreateScenarioDto` con `@IsOptional() @IsNumber()`) y lo persiste (`data.conversionTrm ?? undefined`), pero el frontend nunca lo enviaba — el POST de `createScenario` en `useScenarios.ts` mandaba solo `{ name, description }`. La TRM del día, obtenida por fetch a `co.dolarapi.com`, vivía únicamente como estado local de React (`trm.valor`) y solo se persistía si el usuario editaba el campo a mano o pulsaba "Hoy" en el `ScenarioHeader` (`updateConversionTrm` → PATCH).

Esto producía un escenario con `conversionTrm` NULL en la base pese a mostrar un precio "correcto" en pantalla. La ventana de Cálculos (`useScenarios`) lo enmascaraba con un fallback en memoria: `effectiveConversionTrm = conversionTrm ?? trm?.valor`, que cae a la TRM del día en vivo cuando el campo persistido es NULL. La ventana de Construcción (`useProposalScenarios`) NO tiene ese fallback: pasa `scenario.conversionTrm` crudo al pricing-engine. Con TRM NULL, la guarda de `convertCost` (`if (itemCurrency === scenarioCurrency || !trm || trm <= 0) return unitCost`) devuelve el costo en COP sin dividir; en un escenario USD, un costo de ~6.111.111 COP se rotulaba como USD 6.111.111 y disparaba una falsa alarma de precio techo ("Revisa antes de continuar"). La aritmética confirma la causa: 6.111.111 / 1.829,87 ≈ 3.340, la TRM del día sin aplicar. La validación piso/techo es correcta y no viola CONVENTIONS §J; el defecto era la TRM NULL que recibía aguas arriba.

El diseño original (ADR-003) preveía el campo TRM "pre-poblado con la TRM del día", pero esa pre-población se implementó solo como el fallback en memoria de Cálculos —display-only, nunca persistido—, no como un valor real en la base.

### Decisión

Persistir la TRM del día en el escenario desde su creación, en lugar de dejarla flotar en memoria. Cambio mínimo en el frontend: `createScenario` en `apps/web/src/hooks/useScenarios.ts` agrega `conversionTrm: trm?.valor` al payload del POST. El optional chaining produce `undefined` cuando `trm` es NULL, de modo que el backend crea sin TRM igual que antes (sin persistir 0 ni NULL explícito); no hay regresión en el camino sin TRM disponible.

No se tocó el backend: el DTO ya aceptaba el campo y `createScenario` ya lo persistía. No se tocó el fallback de Cálculos (`effectiveConversionTrm`): sigue cubriendo escenarios que aún no tienen TRM persistida. `cloneScenario` ya copia `conversionTrm` del origen, así que una vez que las fuentes dejen de nacer en NULL, los clones heredan un valor real sin cambios adicionales.

El campo `Scenario.conversionTrm` se mantiene nullable (sin migración de schema): escenarios creados antes de este cambio siguen en NULL y el fallback de Cálculos los cubre mientras tanto.

### Consecuencias

- Todo escenario nuevo nace con la TRM del día persistida; la falsa alarma de precio techo por TRM NULL no vuelve a aparecer en escenarios creados a partir de este cambio.
- Cálculos, Construcción y el PDF ven el mismo número para escenarios nuevos: la TRM deja de recalcularse sola al pasar de día, y el precio USD de una propuesta nueva queda determinista una vez creado el escenario.
- Escenarios preexistentes con `conversionTrm` NULL no se corrigen con este cambio (es hacia adelante). Siguen mostrándose bien en Cálculos por el fallback, pero disparan la falsa alarma en Construcción hasta que el usuario fije la TRM a mano (editar el campo o botón "Hoy") o se ejecute el backfill pendiente.
- El cambio es de una sola línea en el frontend; el backend quedó intacto.

### Archivos

- `apps/web/src/hooks/useScenarios.ts` — `createScenario` agrega `conversionTrm: trm?.valor` al payload del POST.

### Commits

- `22bf7ed` — fix(scenarios): persist daily TRM on scenario creation

### Pendientes

- Backfill de escenarios existentes con `conversionTrm` NULL (estampar la TRM del día para congelarlos en el valor que Cálculos ya muestra). Requiere conteo previo contra producción para dimensionar alcance por estado de propuesta. El caso reportado, COT-LM01525-2 / Escenario 2 (GANADA, USD), es uno de ellos.
- `changeCurrency` (toggle de moneda en `ScenarioHeader`) no estampa TRM al cambiar la moneda; un escenario que cambia a USD sin TRM persistida reproduce la condición NULL. Fuera de alcance de este fix.
- Guarda de `convertCost` en `pricing-engine.ts`: la condición `!trm || trm <= 0` mezcla "misma moneda, no convertir" (correcto) con "hay que convertir pero falta TRM" (devuelve sin convertir, silencioso). El segundo caso debería fallar ruidoso en vez de producir un número plausible pero falso. Cambio de mayor alcance en el pricing-engine, evaluar por separado.

## ADR-061 — Reordenamiento de escenarios en el constructor de cálculos

**Fecha:** 2026-07-09
**Estado:** Aceptado

### Contexto

El sidebar de escenarios (ScenarioSidebar) permitía crear, clonar y borrar escenarios, pero no cambiar su orden. El modelo Scenario ya tenía el campo `sortOrder Int @default(0)` y `getScenariosByProposalId` ya ordenaba por él (`orderBy: { sortOrder: 'asc' }`), pero no existía forma de persistir un cambio de orden: el DTO y el servicio de update genérico (`updateScenario`) no incluían `sortOrder` en su whitelist, y no había endpoint ni método de hook para reordenar. El reordenamiento de ítems dentro de un escenario (`reorderScenarioItems`, `reorderItems`) ya existía end-to-end y sirvió de plantilla.

### Decisión

Reordenamiento end-to-end espejando el patrón ya probado del reorder de ítems, sin tocar el update genérico de escenarios.

Backend: nuevo endpoint dedicado `PATCH /proposals/:id/scenarios/reorder` (body `{ scenarioIds: string[] }`), con `ReorderScenariosDto` y método `reorderScenarios` en scenarios.service.ts. El método verifica ownership de la propuesta reusando `verifyProposalOwnership` (el mismo mecanismo que `getScenariosByProposalId`), valida que el payload sea una permutación exacta de los escenarios de la propuesta (misma longitud y mismo conjunto, rechazando duplicados) y lanza BadRequestException si no lo es, y asigna `sortOrder` por índice en una `$transaction` atómica. Devuelve los escenarios de la propuesta con sus ítems ordenados, mismo shape que `GET /proposals/:id/scenarios`. La escritura queda automáticamente negada a REPORTER por el `ReporterReadOnlyGuard` de clase, sin decorador extra.

Frontend: método `reorderScenarios(orderedScenarioIds)` en useScenarios.ts, con actualización optimista que reordena el array `scenarios` en estado (lo que dispara la animación `layout` del sidebar) y persistencia fire-and-forget con debounce (`SCENARIO_REORDER_DEBOUNCE_MS`, reusada) sobre un ref/timer dedicado, paralelo al de ítems, con flush-on-unmount. En ScenarioSidebar, botones Subir/Bajar (ChevronUp/ChevronDown) por fila, deshabilitados en los extremos, con un helper `moveScenario` que intercambia el id adyacente y llama al hook.

### Consecuencias

1. El orden de los escenarios es persistente y editable desde la UI; el reorden se refleja al recargar.
2. Se decidió NO agregar `sortOrder` al `updateScenario`/`UpdateScenarioDto` genérico: el reordenamiento va por su propio endpoint, manteniendo el update genérico acotado a los campos editables por el usuario (name, currency, description, conversionTrm).
3. El endpoint dedicado es atómico (una `$transaction`) y de paso normaliza la secuencia de `sortOrder`, que create/clone/delete dejan con huecos. No se reindexó create/clone/delete: quedan fuera de alcance.
4. La interfaz local `Scenario` del hook no recibió `sortOrder`: el orden lo determina la posición en el array, no un campo tipado en el frontend.

### Archivos

- `apps/api/src/proposals/dto/proposals.dto.ts` — nuevo `ReorderScenariosDto`
- `apps/api/src/proposals/scenarios.service.ts` — nuevo método `reorderScenarios`
- `apps/api/src/proposals/proposals.controller.ts` — nueva ruta `PATCH :id/scenarios/reorder`
- `apps/web/src/hooks/useScenarios.ts` — método `reorderScenarios`, refs dedicados y flush-on-unmount
- `apps/web/src/pages/proposals/components/ScenarioSidebar.tsx` — botones Subir/Bajar y helper `moveScenario`
- `apps/web/src/pages/proposals/ProposalCalculations.tsx` — enhebrado del prop `reorderScenarios`

### Commits

- `cccc649` — feat(scenarios): add reorder endpoint
- `bb6448d` — feat(scenarios): add reorder UI

### Pendientes

- Verificación en navegador (Luis): reordenar, persistencia tras F5, botones deshabilitados en extremos, escenario activo preservado.
- El endpoint asigna `sortOrder` base 1 (`i + 1`), homogéneo con `reorderScenarioItems` y `createScenario`. Sin acción pendiente; se deja registrado por si se audita la consistencia de `sortOrder`.
- Revisar la regla de encoding "escapes Unicode en strings JS/TS" (INSTRUCTIVO §7, instrucciones del proyecto §5) frente a la realidad del código: scenarios.service.ts y el resto usan acentos UTF-8 reales en literales y compilan/despliegan bien. Definir en una pasada dedicada si se actualiza la regla o se convierten los stragglers; no tocar ahora.

## ADR-062 — Catálogo global de proveedores con contactos y toggles de obligatoriedad de campos

**Fecha:** 2026-07-10
**Estado:** Aceptado

### Contexto

El constructor de propuestas registraba el "origen" de cada ítem (MAYORISTA / FABRICANTE / NOVOTECHNO / OTROS) como texto suelto dentro del JSON `internalCosts` del ítem, que además dispara el flete (solo MAYORISTA suma 1.5%). Ese origen no identifica al tercero concreto ni a su contacto comercial. El objetivo del negocio es trazabilidad: si el comercial que llevaba la relación se va, el que llega debe encontrar con quién se cotizó. Se requería una base de proveedores compartida entre los ~6 usuarios, deduplicada, que se fuera enriqueciendo con el uso. Se disponía de un CSV inicial de ~2000 terceros (nombre + NIT), sin contactos.

### Decisión

Se agrega un catálogo global de proveedores como entidad propia, separado del origen del ítem (que se conserva intacto en `internalCosts`, junto con su acople al flete). Dos tablas nuevas: `SupplierCompany` (nombre normalizado, `nit` opcional y único donde exista, `source` CSV/MANUAL para separar los dos pozos, auditoría de creación) y `SupplierContact` (1—N por empresa: nombre obligatorio, teléfono y correo opcionales). El ítem (`ProposalItem`) referencia empresa y contacto vía dos FK nullable (`supplierCompanyId`, `supplierContactId`), con `ON DELETE SET NULL` para que borrar un proveedor nunca borre ítems; los contactos caen en cascada con su empresa.

El módulo `suppliers` expone el catálogo como global compartido: GET de lista alfabética con contactos anidados y POST de creación (empresa y contacto), todo para cualquier usuario autenticado. Es una excepción consciente al patrón de ownership/IDOR del resto de la app: un catálogo compartido no tiene dueño por fila. La creación de empresas es solo para el pozo MANUAL (origen OTROS): sin NIT (se captura fuera de esta app), con el nombre normalizado server-side (trim, colapsar espacios, quitar puntos, MAYÚSCULAS, acentos conservados) y dedup por nombre normalizado idéntico que responde 409. Las empresas del CSV entran por seed aparte y quedan duras por el `@unique` del NIT.

Adicionalmente, se agregan tres toggles en `app_settings` (`supplier_contact_name_required`, `supplier_contact_phone_required`, `supplier_contact_email_required`), con default `true`, para que un admin pueda relajar la obligatoriedad de los campos de contacto si generan fricción a los comerciales. Se calca el patrón de settings existente (GET para cualquier autenticado con upsert idempotente; PATCH solo admin), con el PATCH en `upsert` (no `update`) para no depender de que el GET haya sembrado la key antes.

Este ADR cubre solo el backend (schema + módulo + toggles). El consumo en el constructor y la UI de administración de los toggles son trabajo de frontend posterior.

### Consecuencias

1. El origen del ítem y su acople al flete quedan intactos: el catálogo es aditivo y no toca el pricing-engine ni el JSON `internalCosts`.
2. La migración es estrictamente aditiva (enum nuevo, dos columnas nullable en `proposal_items`, dos tablas, índices, cinco FK). Las columnas nuevas nacen 100% NULL; sin backfill ni pérdida de datos.
3. El dedup de empresas MANUAL se apoya en `findFirst` por nombre normalizado (no hay `@@unique([name])` en el schema). Es una limitación conocida: existe una ventana de carrera teórica entre dos POST idénticos concurrentes, despreciable con ~6 usuarios y resultado fusionable, no corrupción. Upgrade path si aparece presión de duplicados: agregar `@@unique([name])` y atrapar P2002→409. No se hizo hoy para no arriesgar el seed (dos nombres normalizados idénticos con NIT distinto) ni encadenar otra migración.
4. Las empresas del CSV con NIT distinto pero mismo nombre normalizado conviven sin problema (el dedup MANUAL es por nombre; el del CSV es por NIT). El NIT se persiste como dígitos crudos (sin puntos ni guion) para que el `@unique` sea robusto.
5. El FK `supplier_contact_id` no tiene índice (solo `supplier_company_id`); por diseño, dado que hoy las columnas están vacías. Si los lookups o borrados por contacto se vuelven ruta caliente, evaluar `@@index([supplierContactId])`.
6. Al desplegar a producción, el `CREATE INDEX` y los `ADD FOREIGN KEY` sobre `proposal_items` toman locks de escritura breves (Prisma no usa CONCURRENTLY); sub-segundo con el volumen actual, pero conviene el push en baja carga.

### Archivos

- `apps/api/prisma/schema.prisma` — enum `SupplierSource`, modelos `SupplierCompany` y `SupplierContact`, dos FK nullable + índice en `ProposalItem`, relaciones inversas en `User`
- `apps/api/prisma/migrations/20260710230645_add_supplier_catalog/migration.sql` — migración aditiva del catálogo
- `apps/api/src/suppliers/suppliers.service.ts` — normalización de nombre, `findAll`, `createCompany` (dedup 409), `createContact`
- `apps/api/src/suppliers/suppliers.controller.ts` — GET lista / POST empresa / POST contacto, JWT a nivel clase, sin ownership
- `apps/api/src/suppliers/suppliers.module.ts` — módulo del catálogo
- `apps/api/src/suppliers/dto/create-supplier-company.dto.ts` — DTO de empresa (solo nombre)
- `apps/api/src/suppliers/dto/create-supplier-contact.dto.ts` — DTO de contacto (nombre obligatorio, teléfono/correo opcionales)
- `apps/api/src/app.module.ts` — registro de `SuppliersModule`
- `apps/api/src/app-settings/app-settings.service.ts` — tres keys, interfaz `SupplierFieldRequirements`, getter idempotente y setter en upsert
- `apps/api/src/app-settings/app-settings.controller.ts` — GET (SkipThrottle) / PATCH (AdminGuard) de los toggles
- `apps/api/src/app-settings/dto/update-supplier-field-requirements.dto.ts` — DTO de los toggles (tres booleanos opcionales)

### Commits

- `626732b` — feat(suppliers): add supplier company and contact catalog schema
- `11db726` — feat(suppliers): add suppliers module with global catalog endpoints
- `1a16f7f` — feat(app-settings): add supplier contact field requirement toggles

### Pendientes

- Limpieza y seed del CSV de ~2000 terceros a `SupplierCompany` (source CSV, NIT como dígitos crudos), como pasada aparte antes de exponer el catálogo. Decisiones abiertas del CSV: casos sin NIT colombiano válido (extranjeras/placeholder) y una entrada hondureña (BANCO FICOHSA) cuyo NIT recortado quedó en rango por coincidencia.
- Frontend del constructor (fase posterior): picker de empresa con creación gated a OTROS, difuso "¿quisiste decir X?" en cliente, captura de contactos, lectura de los toggles para pintar obligatoriedad. Campo OC (texto, obligatorio en NOVOTECHNO) como concern aparte.
- UI de administración de los tres toggles en /admin/settings.
- Verificación en navegador (Luis) una vez exista el frontend.

## ADR-063 — Clonado de propuestas con fidelidad total y dos flujos diferenciados

**Fecha:** 2026-07-13
**Estado:** Aceptado

### Contexto

El clonado de propuestas (`POST /proposals/:id/clone`, botones "Clonar versión" y "Clonar como nueva propuesta" en la fila del Dashboard) tenía dos problemas. Primero, `cloneProposal` copiaba de forma incompleta: perdía overrides de `ScenarioItem` (`sortOrder`, `unitCostOverride`, `unitPriceOverride` y, crítico, `isDiluted`), el `conversionTrm` del escenario, `issueCity` y los vínculos de proveedor del ítem, y no copiaba en absoluto las `ProposalPage` ni sus `ProposalPageBlock`. Un clon nacía con números distintos al original (la dilución redistribuye costos según `isDiluted` por ítem) y sin ninguna página del documento; la única forma de repoblar era `/pages/initialize`, que trae plantillas default del admin, no lo que el usuario había editado.

Segundo, los dos botones eran la misma llamada cambiando solo `cloneType`: ninguno capturaba datos ni pasaba por el formulario. El requisito era que "Clonar versión" capturara estado, adquisición y fecha de cierre obligatorios antes de clonar, y que "Clonar como nueva propuesta" pasara por el formulario "Nueva propuesta" para permitir editar el cliente (y el resto de campos de cabecera) antes de generar la propuesta independiente.

### Decisión

1. **Fidelidad total en `cloneProposal`.** El método copia ahora todos los campos de `Scenario` y `ScenarioItem` (raíz e hijos), incluido `isDiluted`, más `issueCity` y los vínculos de proveedor del ítem. Se agrega copia profunda de páginas y bloques: el orden de creación pasa a Proposal → Páginas+Bloques (poblando un `pageIdMap`) → ProposalItems (remapeando `pageId` con ese mapa) → Escenarios+ScenarioItems, para respetar la FK `ProposalItem.pageId` sin apuntar nunca al original. `billingDate` y `manualAmount` se dejan deliberadamente en null: son del ciclo de facturación, no de las tres ventanas, y una propuesta clonada no debe heredarlos. La fidelidad aplica a los dos flujos por igual, al compartir endpoint.

2. **`POST /proposals/:id/clone` acepta overrides opcionales.** `CloneProposalDto` gana `status`, `acquisitionType`, `closeDate` (para el modal de versión) y `clientId`, `clientName`, `subject`, `issueDate`, `validityDays`, `validityDate` (para el modo clon del formulario). El `status` valida con `@IsEnum(ProposalStatus)` (los seis estados, no solo `ELABORACION`/`PROPUESTA`). Los seis campos de cabecera se aplican solo cuando `cloneType === 'NEW_PROPOSAL'`; en `NEW_VERSION` se conserva la copia desde el original. La obligatoriedad de los campos la fuerza la UI, no el DTO.

3. **"Clonar versión" → modal.** Nuevo `useCloneVersion` + `CloneVersionModal` (patrón `useProjections`/`ProjectionModal`): captura estado (los seis vía `ALL_STATUSES`), adquisición (VENTA/DaaS) y fecha de cierre, los tres obligatorios, y clona con `cloneType: 'NEW_VERSION'` + esos overrides.

4. **"Clonar como nueva propuesta" → modo clon del formulario.** `NewProposal` detecta `?cloneFrom={id}`, precarga el formulario vía `GET /proposals/:id`, permite editar todos los campos de cabecera, oculta el toggle de consecutivo (fuerza AUTO) y el campo de monto, y al "Guardar y continuar" clona con `cloneType: 'NEW_PROPOSAL'` + overrides en vez de crear vacío. El botón del Dashboard reroutea a `/proposals/new?cloneFrom={id}`.

5. **Wiring por bifurcación (Opción A).** `ProposalVersionRow` conserva un único `onClone(id, cloneType)`; `handleCloneGated` bifurca por `cloneType` (versión → modal, nueva → reroute), respetando el gate de higiene de datos previo. No se altera la firma del componente de fila.

### Consecuencias

1. Un clon reproduce fielmente las tres ventanas (Constructor de Propuesta, Ventana de Cálculos, Construcción del Documento), incluidos los números, que antes divergían por la pérdida de `isDiluted`.
2. El candado anti-doble-clic `cloning` de la fila quedó sin propósito: ningún botón dispara ya una petición desde la fila ("Clonar versión" abre un modal con su propio `cloningVersion`; "Clonar como nueva propuesta" hace `navigate`). Se eliminó de las tres capas (`useDashboard`, `Dashboard`, `ProposalVersionRow`).
3. `handleClone` de `useDashboard` quedó sin consumidores tras el reroute y se eliminó.
4. `ClientAutocomplete` no sincroniza `defaultValue` tras el montaje; la precarga asíncrona del modo clon requiere forzar un remount con `key` cuando termina la carga para que el cliente se vea seleccionado.

### Archivos

- `apps/api/src/proposals/proposals.service.ts` — fidelidad total + parámetro `overrides` en `cloneProposal`.
- `apps/api/src/proposals/dto/proposals.dto.ts` — `CloneProposalDto` con los nueve overrides opcionales.
- `apps/api/src/proposals/proposals.controller.ts` — paso de overrides al service.
- `apps/web/src/hooks/useCloneVersion.ts` — hook del modal de versión (nuevo).
- `apps/web/src/pages/dashboard/CloneVersionModal.tsx` — modal de versión (nuevo).
- `apps/web/src/pages/proposals/NewProposal.tsx` — modo clon (precarga, submit bifurcado, ocultamiento de consecutivo/monto).
- `apps/web/src/pages/Dashboard.tsx` — wiring del modal, reroute, limpieza de `cloning`/`handleClone`.
- `apps/web/src/hooks/useDashboard.ts` — eliminación de `handleClone`/`cloning`.
- `apps/web/src/pages/dashboard/components/ProposalVersionRow.tsx` — eliminación del prop `cloning`.

### Commits

- `026ffce` — fix(proposals): clone copies scenario overrides, dilution, pages and blocks
- `1e90a83` — feat(proposals): clone accepts status, acquisitionType and closeDate overrides
- `4fe7d10` — fix(proposals): clone status accepts any ProposalStatus
- `c03ac2d` — feat(dashboard): clone version modal captures close date, acquisition and status
- `bf7ac39` — feat(proposals): clone as new proposal accepts client and form field overrides
- `9368104` — feat(proposals): new proposal form clone mode prefills from base and clones on submit
- `fa4b3d6` — fix(proposals): controller forwards clone header overrides, normalize empty clientId

### Pendientes

- `scenarios.service.ts` (botón "Clonar escenario", endpoint aparte) no copia `sortOrder` en hijos ni `unitCostOverride` en ningún nivel — deuda preexistente registrada, fuera del alcance de este ADR.
- `currentVersion` en `Proposal` no se escribe en ningún flujo del backend; sin impacto hoy, pendiente de decidir si se usa o se elimina.
- Carrera en la precarga del modo clon de `NewProposal`: si el usuario edita el cliente antes de que el GET de la base resuelva, el `setFormData` de la precarga pisa la elección y el remount por `key` la revierte visualmente. Bug latente registrado; fix en tarea aparte.

## ADR-064 — Frontend del catálogo de proveedores: sección en el constructor, dedup difuso y obligatoriedad solo en ítems nuevos

**Fecha:** 2026-07-14
**Estado:** Aceptado

### Contexto

ADR-062 dejó el backend del catálogo completo y el seed de 2040 empresas en producción, con el frontend y el campo OC explícitamente fuera de alcance. Al bajar a implementarlo apareció un gap real: la migración creó las columnas `supplier_company_id` / `supplier_contact_id` en `proposal_items`, pero el write path del ítem no las conocía. Tanto `CreateProposalItemDto` como `UpdateProposalItemDto` son clases escritas a mano, y `addProposalItem` / `updateProposalItem` arman el `data` de Prisma campo por campo, sin spread: un campo que no esté listado no se escribe nunca. Peor, con `forbidNonWhitelisted: true` un payload con esos campos habría devuelto 400. Sin ese addendum, el frontend no persistía nada.

También quedó a la vista que los dos FK garantizan que empresa y contacto existan, pero no que estén relacionados entre sí: un ítem podía apuntar a la empresa A con un contacto de la empresa B, y Postgres lo aceptaba. Eso corrompe justo la trazabilidad que motiva el feature.

### Decisión

Se completa el write path y se construye la UI, sin tocar el origen (`internalCosts.proveedor`) ni su acople al flete.

Backend: los dos FK se agregan a ambos DTOs con `@IsOptional() @IsUUID()`, y explícitamente a los dos objetos `data` del service. Un helper privado `assertSupplierContactBelongsToCompany` valida la pertenencia contacto→empresa y responde 400 si no calza; en el update se valida sobre los valores efectivos (lo que viene en el DTO, o lo que el ítem ya tenía si el campo está ausente). En el create los FK van con `?? null`; en el update van directos, sin `?? undefined`, para preservar la semántica de ADR-022: campo ausente = no tocar, `null` = desasignar, uuid = asignar.

Frontend: `useSuppliers` trae el catálogo completo una sola vez al montar el builder y lo filtra en memoria (~2000 empresas; sin fetch por tecla, sin debounce); solo el fetch inicial es best-effort silencioso, mientras que `createCompany` y `createContact` propagan el error para que el 409 de nombre duplicado llegue al usuario. `SupplierPicker` calca `CityCombobox` pero opera sobre IDs, corta el render a 50 resultados y bloquea el Enter (con 2000 empresas, autoseleccionar por accidente es peligroso). `NewSupplierModal` muestra los similares como botones seleccionables, no como un aviso ignorable, y expone el nombre normalizado antes de crear. `SupplierSection` orquesta todo con un único callback `onChange({ supplierCompanyId, supplierContactId })`: cambiar de empresa siempre resetea el contacto en el mismo acto, lo que hace imposible el estado que el guard del backend rechaza. Las cuatro opciones de origen se centralizan en `PROVEEDOR_OPTIONS`, reemplazando los `<option>` hardcodeados inline.

La obligatoriedad se aplica **solo a ítems nuevos** (`enforceRequired = !editingItemId`). Un comercial que edita una propuesta ajena de hace meses no sabe quién fue el proveedor; exigírselo produciría datos inventados, que en una base cuya finalidad es trazabilidad es peor que un dato ausente. Los tres toggles se administran desde una card nueva en `/admin/settings`, con guardado inmediato al togglear (PATCH parcial), sin botón Guardar.

### Consecuencias

1. El picker muestra el catálogo completo en cualquier origen; lo que restringe la creación es `allowCreate` (solo OTROS), no un filtro por `source`. Filtrar dejaría las empresas creadas manualmente inutilizables desde MAYORISTA/FABRICANTE: ni seleccionables ni creables, un callejón sin salida. `source` sigue distinguiendo lo sembrado de lo agregado por los usuarios.
2. Regla A asumida: los ítems históricos sin proveedor nunca serán forzados a tenerlo. La base se enriquece solo con ítems nuevos.
3. Teléfono y correo son derivados del contacto seleccionado y se muestran de solo lectura (referencia viva). No existe PATCH de contactos: corregir el teléfono de un contacto ya guardado no es posible todavía.
4. Semántica de los toggles: `nameRequired` exige seleccionar un contacto para el ítem; `phoneRequired` / `emailRequired` exigen esos campos al **crear** un contacto nuevo, no al seleccionar uno existente. Si aplicaran al seleccionar, un contacto viejo sin teléfono bloquearía la edición del ítem — el mismo problema retroactivo que resuelve la regla A.
5. El form de ítems no tiene superficie para los errores del backend: el `catch` de `saveItem` muestra un `alert()` genérico. El 400 de pertenencia es un guard de servidor puro y no debería verse desde la UI, que resetea el contacto al cambiar de empresa.
6. `duplicateItem` arrastra los dos FK del ítem original. Es lo deseado (se duplica un ítem del mismo proveedor) y quedan consistentes entre sí porque viajan juntos.
7. El difuso corre en el cliente con Levenshtein sobre nombres normalizados y sin sufijo societario, saltando comparaciones cuando la diferencia de longitud supera el 40% (una diferencia mayor no puede alcanzar el umbral de 0.82). No requiere extensión de Postgres.
8. `initialItemForm` inicializa los dos FK en `null` explícito: con `undefined` el PATCH los interpretaría como "no tocar" y desasignar sería imposible.

### Archivos

- `apps/api/src/proposals/dto/proposals.dto.ts` — los dos FK en `CreateProposalItemDto` y `UpdateProposalItemDto`
- `apps/api/src/proposals/proposals.service.ts` — helper `assertSupplierContactBelongsToCompany` y wiring de los FK en create y update
- `apps/web/src/lib/types.ts` — `SupplierCompany`, `SupplierContact`, `SupplierFieldRequirements`, y los dos FK al top level de `ProposalItem`
- `apps/web/src/lib/constants.ts` — `ProveedorOrigen`, `PROVEEDOR_OPTIONS` y las constantes de origen
- `apps/web/src/lib/supplierMatch.ts` — normalización espejo del backend, Levenshtein y `findSimilarCompanies`
- `apps/web/src/hooks/useSuppliers.ts` — catálogo global (fetch único, crear empresa, crear contacto)
- `apps/web/src/hooks/useSupplierFieldRequirements.ts` — lectura y actualización de los toggles
- `apps/web/src/pages/proposals/components/SupplierPicker.tsx` — combobox de empresa sobre IDs
- `apps/web/src/pages/proposals/components/NewSupplierModal.tsx` — alta de empresa con similares seleccionables
- `apps/web/src/pages/proposals/components/SupplierSection.tsx` — bloque del constructor, condicional por origen
- `apps/web/src/pages/proposals/components/NewContactFields.tsx` — alta de contacto inline
- `apps/web/src/pages/proposals/components/supplierFieldStyles.tsx` — estilos y `RequiredMark` compartidos
- `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx` — wiring, validación de la regla A y `PROVEEDOR_OPTIONS`
- `apps/web/src/hooks/useProposalBuilder.ts` — FK en `initialItemForm` y en el payload
- `apps/web/src/pages/admin/components/SupplierFieldsSettings.tsx` — card de los tres toggles
- `apps/web/src/pages/admin/SettingsAdmin.tsx` — composición de la card nueva

### Commits

- `56d9c55` — feat(proposals): wire supplier FKs into item write path with contact ownership check
- `7a6cd2b` — feat(suppliers): add frontend types, origin constants and catalog hooks
- `0087ab8` — feat(suppliers): add supplier picker combobox and fuzzy name matching
- `782cfe3` — feat(suppliers): add new supplier modal with duplicate detection
- `8644df8` — feat(suppliers): add supplier section with company picker and contact capture
- `015baf2` — feat(suppliers): wire supplier section into item builder
- `6d0fc42` — fix(suppliers): clear item error when origin changes
- `0d3893b` — feat(suppliers): add supplier field requirement toggles to admin settings

### Pendientes

- No existe PATCH de contactos: editar nombre, teléfono o correo de un contacto ya guardado requiere endpoint nuevo. Evaluar cuando aparezca la necesidad real.
- El dedup de empresas MANUAL sigue apoyado en `findFirst` por nombre normalizado, sin `@@unique([name])` (limitación ya registrada en ADR-062). El difuso del cliente lo mitiga, no lo cierra.
- Push a producción pendiente al cierre de esta sesión: nueve commits, sin migración nueva (el schema entró con ADR-062).

## ADR-065 — Campo OC para origen NOVOTECHNO: referencia de trazabilidad en internalCosts, sin módulo de inventario

**Fecha:** 2026-07-14
**Estado:** Aceptado

### Contexto

El catálogo de proveedores (ADR-062, ADR-064) cubre los ítems que se cotizan a un tercero: empresa y contacto comercial. El origen NOVOTECHNO es distinto: el ítem sale de inventario propio, que NovoTechno ya compró antes a un proveedor mediante una orden de compra. Ahí no hay tercero que registrar, pero sí una necesidad de trazabilidad equivalente: saber con qué OC entró ese ítem al inventario. La OC vive en otra aplicación; en NovoTechFlow es solo una referencia.

### Decisión

Un campo `oc` de texto libre dentro de `internalCosts`, obligatorio únicamente cuando el origen es NOVOTECHNO y solo en ítems nuevos (misma regla A de ADR-064). Sin columna nueva ni migración: es un identificador externo del que no hay integridad referencial que garantizar —al contrario de los FK de proveedor—, y `internalCosts` ya es el contenedor del origen y del flete, que es su vecindario natural. El backend no requirió cambios: `internalCosts` viaja completo en el payload y ambos DTOs lo aceptan como `Record<string, unknown>`.

El campo se renderiza en el mismo panel "Estructura Comercial", condicional al origen, y nunca coexiste con la sección de proveedor (que retorna null en NOVOTECHNO). El comportamiento es simétrico al de los FK: entrar a NOVOTECHNO limpia empresa y contacto; salir de NOVOTECHNO limpia el OC. Cada origen persiste solo lo suyo.

Se descartó modelar una entidad de OC o inventario: no existe módulo de inventario en el sistema y construir uno para almacenar un número sería especulativo (YAGNI). Si algún día hay integración real con la aplicación donde viven las OC, este campo es el punto de anclaje.

### Consecuencias

1. Sin validación de formato ni existencia: el OC es texto libre. Un número mal escrito no se detecta. Aceptado: el dato autoritativo vive en otra aplicación.
2. El borrado del OC al salir de NOVOTECHNO funciona por una vía indirecta: `oc: undefined` hace que `JSON.stringify` omita la clave, y como el backend reemplaza `internalCosts` completo (no hace merge), la clave desaparece del JSON persistido. Correcto hoy, pero es una dependencia implícita: si el backend pasara a hacer merge de `internalCosts`, este borrado dejaría de funcionar en silencio.
3. Los ítems históricos con origen NOVOTECHNO y sin OC se siguen editando sin exigir el campo (regla A). Nunca serán forzados a tenerlo.
4. Al vivir en JSONB y no en columna, el OC no es indexable ni consultable con eficiencia. Si aparece la necesidad de buscar ítems por OC, habrá que promoverlo a columna.

### Archivos

- `apps/web/src/lib/types.ts` — campo `oc?: string` en `InternalCosts`
- `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx` — render condicional del campo, limpieza al cambiar de origen y validación en ítems nuevos

### Commits

- `0969805` — feat(proposals): add purchase order field for NOVOTECHNO origin

### Pendientes

- Verificación en navegador (Luis): campo visible solo en NOVOTECHNO, ítem nuevo sin OC no guarda, cambiar de origen limpia el valor, persistencia tras F5.
- Si alguna vez se integra con la aplicación donde viven las órdenes de compra, evaluar promover `oc` a columna con validación real contra esa fuente.

## ADR-066 — Firma del usuario resuelta en render, no como snapshot en el documento

**Fecha:** 2026-07-18
**Estado:** Aceptado

### Contexto

Un usuario comercial (Carolina Casas, nomenclatura CC) reportó que su firma, subida desde la ventana de administración de usuarios, no aparecía en la propuesta COT-CC00005-1, mientras que sí aparecía en otras propuestas suyas, nuevas y viejas. El patrón no era monótono en el tiempo: propuestas más viejas mostraban la firma y otras más nuevas no.

El diagnóstico contra producción (solo lectura) reveló la causa raíz. Las páginas de una propuesta no se crean al crear la propuesta, sino de forma diferida (lazy), la primera vez que alguien abre el documento y se dispara `POST /proposals/:id/pages/initialize`. Al inicializarse, `initializeDefaultPages` leía la firma del usuario dueño en ese instante y la copiaba como un bloque IMAGE dentro de la página PRESENTATION: una foto del estado de la firma en el momento de abrir el documento por primera vez. Como `initializeDefaultPages` es idempotente y no re-inicializa si ya existen páginas, esa foto nunca se actualizaba después.

Cruzando los `createdAt` reales de cada página PRESENTATION con el momento de subida de la firma, el patrón colapsó en un solo evento: la firma se subió una única vez, en la ventana 2026-07-17 21:07–22:24 UTC. Todo documento abierto por primera vez antes de esa hora quedó sin firma; todo documento abierto después la capturó. COT-CC00005-1 abrió su documento a las 19:30 UTC, antes de la subida, y quedó congelada sin firma. No era la edad de la propuesta lo que importaba, sino cuándo se abrió el documento por primera vez.

El modelo de snapshot tiene además dos defectos de fondo: la firma no era un dato vivo (cambiarla no afectaba propuestas ya inicializadas), y el bloque IMAGE de la firma era indistinguible de una imagen normal insertada por el usuario. El único intento de distinguirlos, la heurística `url.includes('/signatures/')` en el render, estaba muerto desde la migración de firmas a data URI base64 (abril 2026): un data URI nunca contiene `/signatures/`.

### Decisión

La firma deja de copiarse dentro del documento y pasa a resolverse en tiempo de render, desde el usuario dueño de la propuesta.

En backend, `getProposalById` incluye ahora `user: { name, nomenclature, signatureUrl }` del dueño, e `initializeDefaultPages` deja de inyectar el bloque IMAGE de firma: las propuestas nuevas nacen sin bloque de firma. En frontend, el render de la página PRESENTATION pinta la firma del dueño al final de la página, después de los bloques, como elemento aparte. La firma se resuelve desde el dueño de la propuesta (traído por el backend), no desde el usuario logueado (`authStore`), para que un administrador que abra la propuesta de un comercial vea la firma correcta y no la propia.

Al dejar de ser un bloque, la firma ya no necesita marcador ni heurística: todo bloque IMAGE vuelve a ser una imagen normal, sin excepción, y la firma se pinta por una vía separada condicionada a `pageType === 'PRESENTATION'`. La heurística `url.includes('/signatures/')` se elimina.

Se descartó la alternativa de mantener el snapshot con un botón de "actualizar firma" en el documento, porque deja al usuario la carga de saber que debe accionarlo. Se aceptó explícitamente la consecuencia de que las propuestas ya enviadas muestren en la app la firma actual del dueño y no la del momento de envío: el registro de lo enviado al cliente es el PDF archivado, no la vista de la app.

### Consecuencias

1. Se elimina la clase completa de bug: ningún documento futuro puede quedar sin firma por haberse abierto antes de que el dueño la cargara. La firma es un dato vivo del usuario.
2. Las propuestas ya inicializadas que tenían el bloque IMAGE-firma snapshot mostraban la firma dos veces (el bloque viejo más la firma nueva en render). Se identificaron y borraron los bloques residuales en producción: COT-CC00004-1 (blockId 6542a08e-7b66-45f9-87e0-575eed6b8aab) y COT-CC00010-1 (blockId 5306e9d8-9209-4cba-b364-ad1f2a83c5cc), con pg_dump previo de proposal_page_blocks y verificación precheck/postcheck.
3. Una propuesta abierta en la app ya no refleja necesariamente la firma que llevaba el PDF enviado al cliente, si el dueño cambió su firma después. Es un cambio de contrato deliberado: la app muestra el estado actual, el PDF archivado es el registro de lo enviado.
4. Deuda de reconciliación con la rama feature/wysiwyg-pages. Ese trabajo (en diseño, sin mergear) extrae el render de páginas de PdfPreviewModal a lib/renderPageHtml.ts y añade una segunda vía de render (useContentPageSheets / PageSheetsPreview). Este fix se construyó sobre la estructura inline de master (render dentro de PdfPreviewModal, 3 archivos). Cuando wysiwyg se mergee, hay que unificar las dos versiones del render de firma: la lógica del append de firma debe quedar en buildPageHtml (que ya recibe pageType y ownerSignatureUrl en la rama) y propagarse a sus dos call sites, no duplicada en el modal.

### Archivos

- `apps/api/src/proposals/proposals.service.ts` — `getProposalById` incluye `user: { name, nomenclature, signatureUrl }` del dueño
- `apps/api/src/proposals/pages.service.ts` — `initializeDefaultPages` deja de inyectar el bloque IMAGE de firma; se elimina el fetch de `proposal` que solo servía para eso
- `apps/web/src/lib/types.ts` — `ProposalDetail.user` gana `signatureUrl?`
- `apps/web/src/components/proposals/PdfPreviewModal.tsx` — prop `ownerSignatureUrl`; se elimina la heurística `url.includes('/signatures/')`; se pinta la firma del dueño al final de PRESENTATION
- `apps/web/src/pages/proposals/ProposalDocBuilder.tsx` — pasa `ownerSignatureUrl={proposal?.user?.signatureUrl}` al modal

### Commits

- `642c185` — refactor(proposals): resolve owner signature at render instead of snapshot
- `a952373` — feat(proposals): render owner signature on presentation page

### Pendientes

- Reconciliar el render de firma con feature/wysiwyg-pages al mergear esa rama (ver consecuencia 4)
- Bug preexistente, aparte de este fix: el preview de firma en la ventana Usuarios (`Users.tsx:552`) usa `${apiBase}${u.signatureUrl}` en vez de `resolveImageUrl`, lo que produce una URL malformada con un data URI. No afecta el render en propuestas

## ADR-067 — Campos numeroParte/modelo en todas las categorías y paquete compartido @repo/item-display

**Fecha:** 2026-07-21
**Estado:** Aceptado

### Contexto

El contrato de la API externa debe entregar, por categoría de ítem, número de parte, modelo y una descripción rápida coherente con lo que el usuario captura en el Constructor de Propuesta. Solo la categoría PCS tenía los campos de specs `numeroParte` y `modelo`; las otras cinco categorías no los capturaban. Además, la lógica de display estaba fragmentada y parcialmente duplicada: `buildQuickDescription` en `apps/web/src/lib/itemDescription.ts`, una copia adaptada en `apps/api/src/external/external-spec-fields.ts` (deuda registrada en el ADR-059 de la rama `feature/external-api`), y una constante divergente `QUICK_SPEC_FIELDS_BY_ITEM_TYPE` para la "información rápida" del Excel, con campos y separador propios (` · `).

### Decisión

1. **Campos nuevos de specs**: se agregaron `numeroParte` (input de texto, cat `NUMERO_PARTE`) y `modelo` (cat `MODELO`, autocompletado compartido) a las cinco categorías no-PCS de `SPEC_FIELDS_BY_ITEM_TYPE`. El render es automático vía `SpecFieldsSection`; las specs viven en el JSON `technicalSpecs`, sin migración.
2. **Paquete compartido `@repo/item-display`** (`packages/item-display`, molde de `@repo/pricing-engine`): fuente única de `ITEM_TYPE_LABELS`, `resolveItemTypeLabel`, `pickSpecString`, `buildQuickDescription`, `buildExcelQuickSpecs` y `getUnitOfMeasure`.
3. **Definición unificada de descripción rápida** (pantalla, PDF y API externa), separador ` | `: PCS (formato, fabricante, modelo, procesador, memoriaRam, almacenamiento, garantiaBateria, garantiaEquipo); ACCESSORIES e INFRASTRUCTURE (tipo, fabricante, modelo, garantia); SOFTWARE (tipo, fabricante, modelo); PC_SERVICES e INFRA_SERVICES (tipo, responsable, modelo).
4. **Información rápida del Excel**: la misma definición de pantalla más `unidadMedida` en SOFTWARE, PC_SERVICES e INFRA_SERVICES, conservando su separador histórico ` · ` vía parámetro de `buildExcelQuickSpecs`. Decisión de producto: el formato visible del Excel no cambia.
5. `apps/web` consume el paquete: `itemDescription.ts` y las constantes migradas quedan como re-exports; `exportExcel.ts` delega en `buildExcelQuickSpecs`; `vite.config`, Dockerfile de web y ambos workflows de CI compilan el paquete antes del build/typecheck; los chips de specs del Constructor de Propuesta se renderizan data-driven desde `QUICK_SPEC_FIELDS_BY_ITEM_TYPE` (incluye `unidadMedida` en pantalla, decisión de producto).

### Consecuencias

- El usuario captura número de parte y modelo en las seis categorías; la descripción rápida los refleja en pantalla, PDF y Excel.
- Una sola fuente de lógica de display en el monorepo. La copia `external-spec-fields.ts` de la rama `feature/external-api` se reemplazará por este paquete tras el merge (sanea la deuda del ADR-059 de esa rama).
- El gate local de `docker build` de web no corre en Windows (el `COPY` sin `.dockerignore` arrastra junctions de pnpm); el gate válido es el job `docker-build` del CI. Deuda registrada: `.dockerignore` raíz.
- Los ADR-057 y ADR-059 de feature/external-api colisionan con la numeración ya usada en master; se renumeran en el merge.

### Archivos

- `apps/web/src/lib/constants.ts` — campos nuevos en `SPEC_FIELDS_BY_ITEM_TYPE`; constantes de display migradas a re-export.
- `packages/item-display/` (nuevo) — package.json, tsconfig.json, src/index.ts.
- `apps/web/src/lib/itemDescription.ts` — re-export del paquete.
- `apps/web/src/lib/exportExcel.ts` — delega en `buildExcelQuickSpecs`.
- `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/Dockerfile`, `.github/workflows/ci.yml`, `.github/workflows/pr-check.yml`, `pnpm-lock.yaml`.

### Commits

- `f4adf4d` — feat(web): add part number and model spec fields to non-PC categories
- `3d65ad5` — feat(item-display): add shared item display package with unified quick description logic
- `478ecd0` — feat(web): consume @repo/item-display as single source for item display logic
- Pendiente — commit de este ADR (`docs: ADR-067 item display package and new spec fields`)

### Pendientes

- **Verificación en navegador** (Luis): campos nuevos en las 5 categorías, descripción rápida nueva en pantalla/PDF, Excel con ` · ` y `modelo`.
- **`.dockerignore` raíz** para habilitar docker build local en Windows (afecta también al Dockerfile de api).
- **Merge a `feature/external-api`**: renumerar los ADR de la rama en colisión (057 y 059) y reemplazar `external-spec-fields.ts` por el paquete.

## ADR-068 — Actualización del protocolo operativo: modelo/esfuerzo por sesión, rama obligatoria en prompts y Railway MCP

**Fecha:** 2026-07-22
**Estado:** Implementado

### Contexto
La guía oficial de Claude Code (jul 2026) separa dos ejes independientes: el modelo (qué tan capaz) y el esfuerzo (qué tan a fondo trabaja: archivos leídos, verificación, autonomía antes de devolver control), con defaults `high` en Fable 5, Sonnet 5 y Opus 4.8 y `xhigh` recomendado para código complejo. El §10.3 del instructivo tenía una condición vencida ("Fable hasta 2026-07-07"); Fable está incluido en el plan de Luis. Luis además fijó dos reglas nuevas: todo prompt de Claude Code debe indicar la rama donde ubicarse, sea sesión nueva o la misma; y el MCP de Railway queda disponible para Claude Code, reemplazando la regla previa de "write ops solo Luis".

### Decisión
En `INSTRUCTIVO_CLAUDE.md`: (1) §6 — rama obligatoria en TODO prompt como paso 0 (`git branch --show-current` + checkout si no coincide + detenerse si hay cambios sin commitear ajenos); el chat anuncia los cuatro datos encima del bloque (`Modelo · Effort · Sesión · Rama`, effort omitido si es el default); heurística modelo-vs-esfuerzo (falló con contexto e intento → subir modelo; falló por saltarse pasos → subir esfuerzo); fila Fable en la tabla (especialista para causa raíz ambigua, `claude --model fable`); Sonnet 5 añade `xhigh`; advertencia de que `/model` persiste como default de sesiones futuras, por eso la sesión nueva se abre con el flag `--model`. (2) §10.3 — Fable como default de diagnóstico de causa raíz; reruteo del clasificador documentado (puede dispararse en el primer request por CLAUDE.md y git status; mitigación con framing defensivo, `/clear`, `claude --safe-mode`, toggle en `/config`); sin la fecha vencida. (3) §2 — bloque Railway vía MCP: lecturas libres para Claude Code; escritura y creación de variables por Claude Code solo con aprobación previa de Luis por operación (variable y valor exactos a la vista); cambiar una variable redeploya el servicio automáticamente. Se conserva la mecánica ya decidida de que modelo y esfuerzo se fijan al abrir la sesión, nunca dentro del prompt: la actualización injerta sobre esa base, no la revierte.

### Consecuencias
El enrutamiento de modelo/esfuerzo queda alineado a la guía oficial vigente y Fable entra al repertorio de diagnóstico. Claude Code opera Railway sin fricción en lecturas y con gate humano por operación en escrituras. `railway up`/`redeploy` manuales y el push a `master` siguen siendo exclusivamente de Luis.

### Archivos
- `INSTRUCTIVO_CLAUDE.md` (§2, §6, §10.3)

### Commits
- `e453f25` — docs: actualiza protocolo de modelos, effort, rama obligatoria y Railway MCP

### Pendientes
- Renumerar en `feature/wysiwyg-pages` el ADR-067 (vista previa WYSIWYG) a ADR-069 antes del merge: colisiona con el ADR-067 de master (numeroParte/`@repo/item-display`). El ADR del modelo de secciones tomará el 070.
- Reemplazar el attachment `INSTRUCTIVO_CLAUDE.md` del proyecto en Claude.ai con la versión de este commit (gana el disco).
- Actualizar las instrucciones del proyecto en Claude.ai (español neutro, referencia a Railway MCP) — entrega manual a Luis.
