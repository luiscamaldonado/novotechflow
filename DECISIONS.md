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

---

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
