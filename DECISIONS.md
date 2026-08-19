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

## ADR-050 — Remediación de deuda de lint pre-existente en apps/web: 10 de 12 hallazgos resueltos en 6 commits, 2 diferidos (resueltos después en `a80302e`)

**Fecha:** 2026-06-20
**Estado:** Implementada (parcial: 10 de 12 hallazgos resueltos en 6 commits ya en master, `f9998e7`→`515af1c`; 2 diferidos a un refactor dedicado de `useInactivityTimeout`; este ADR pendiente de push). Actualización 2026-07-31: los 2 diferidos (#4 y #12) quedaron resueltos en `a80302e` — ver Pendientes de esta entrada y ADR-075.

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
La guía oficial de Claude Code (jul 2026) separa dos ejes independientes: el modelo (qué tan capaz) y el esfuerzo (qué tan a fondo trabaja: archivos leídos, verificación, autonomía antes de devolver control), con defaults `high` en Fable 5, Sonnet 5 y Opus 4.8 y `xhigh` recomendado para código complejo. El §10.3 del instructivo tenía una condición vencida ("Fable hasta 2026-07-07"); Fable está incluido en el plan de Luis. Luis además fijó dos reglas nuevas: todo prompt de Claude Code debe indicar la rama donde ubicarse, sea sesión nueva o la misma; y el modelo opera Railway vía CLI, con el MCP local como pendiente opcional (se intentó cablear pero no quedó operativo).

### Decisión
En `INSTRUCTIVO_CLAUDE.md`: (1) §6 — rama obligatoria en TODO prompt como paso 0 (`git branch --show-current` + checkout si no coincide + detenerse si hay cambios sin commitear ajenos); el chat anuncia los cuatro datos encima del bloque (`Modelo · Effort · Sesión · Rama`, effort omitido si es el default); heurística modelo-vs-esfuerzo (falló con contexto e intento → subir modelo; falló por saltarse pasos → subir esfuerzo); fila Fable en la tabla (especialista para causa raíz ambigua, `claude --model fable`); Sonnet 5 añade `xhigh`; advertencia de que `/model` persiste como default de sesiones futuras, por eso la sesión nueva se abre con el flag `--model`. (2) §10.3 — Fable como default de diagnóstico de causa raíz; reruteo del clasificador documentado (puede dispararse en el primer request por CLAUDE.md y git status; mitigación con framing defensivo, `/clear`, `claude --safe-mode`, toggle en `/config`); sin la fecha vencida. (3) §2 — el modelo opera Railway vía CLI (lecturas libres; escritura y creación de variables con aprobación previa de Luis por operación); el MCP local se intentó cablear pero no quedó operativo y queda como pendiente opcional; cambiar una variable redeploya el servicio automáticamente. Se conserva la mecánica ya decidida de que modelo y esfuerzo se fijan al abrir la sesión, nunca dentro del prompt: la actualización injerta sobre esa base, no la revierte.

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

## ADR-069 — Estados APLAZADA y CANCELADA: terminales, fuera de proyección y exentos de higiene

**Fecha:** 2026-07-23
**Estado:** Implementado

### Contexto

El enum `ProposalStatus` tenía seis valores y no existía forma de registrar una propuesta que queda sin seguimiento comercial: ni la que el cliente pospone, ni la que se cae. El requerimiento fue que ambas situaciones se vean como estado propio en la tabla de registros del dashboard, para propuestas existentes y nuevas.

El frontend duplica el enum a mano como unión de literales en `apps/web/src/lib/types.ts`, y los subconjuntos de negocio —pipeline, forecast, proyección, exenciones de higiene— están declarados por separado en varios archivos en vez de derivarse de una sola fuente. Cualquier estado nuevo obliga a revisarlos todos.

Restricción de ejecución: la base local tenía aplicada la migración `20260718193601_add_section_model_to_proposal_page`, que solo existe en el directorio de `feature/wysiwyg-pages`. `prisma migrate status` (5.10.2) no reporta ese desfase —solo verifica que las migraciones locales estén aplicadas, no lo inverso—, pero `migrate dev --create-only` sí lo detecta contra la shadow database y ofrece resetear la base.

### Decisión

- **Dos estados, no uno combinado**: `APLAZADA` y `CANCELADA` como valores separados del enum. Un solo estado fusionado impediría después medir cuántas propuestas se retoman y cuántas mueren, y obligaría a reclasificar a mano lo ya marcado.
- **Terminales y no facturables**: quedan fuera de Proyección Venta y Proyección DaaS sin tocar código, porque `computeBillingCards` solo suma filas en `FACTURADA` y `PENDIENTE_FACTURAR`. `FORECAST_STATUSES` no se modifica, así que tampoco inflan el forecast.
- **Visibles en el pipeline**: entran a `PIPELINE_STATUSES` como dos tarjetas nuevas. La grilla pasa de `lg:grid-cols-4` fijo a `lg:grid-cols-3 xl:grid-cols-6` para alojar seis tarjetas.
- **Exentos de las reglas de higiene**: nueva constante `TERMINAL_STATUSES` en `dashboardValidation.ts`; los dos estados se agregan a `R5_EXEMPT_STATUSES` y la regla R2 (`ACQUISITION_REQUIRED`) los excluye. Sin esta exención, cada propuesta aplazada o cancelada quedaría como aviso permanente y bloquearía crear, editar y clonar a los usuarios no ADMIN vía `runWithCleanBoard`.
- **No disponibles al crear**: `CreateProposalDto` mantiene `@IsIn([ELABORACION, PROPUESTA])`. `NewProposal.tsx` ya tenía los dos estados iniciales hardcodeados como botones, no derivados de `ALL_STATUSES`, por lo que no requirió cambio y no se creó una constante `CREATION_STATUSES`.
- **Migración generada desde `feature/wysiwyg-pages`**: allí el directorio de migraciones y la base local coinciden y no hay desfase. El `migration.sql` resultante se movió por `$env:TEMP` a una rama corta desde `master` y se aplicó con `migrate deploy`, que no usa shadow database ni puede resetear. Se evitó el reset sin perder datos locales.

### Consecuencias

- `ALTER TYPE ... ADD VALUE` es de una sola vía: quitar un valor exige recrear el tipo, reescribir la columna `status` y su `@@index([status])`. Los nombres quedan fijos una vez desplegados.
- La base local quedó con una migración registrada que `feature/wysiwyg-pages` no tiene en su directorio: el espejo exacto del desfase anterior. Se resuelve al rebasar esa rama sobre `master` después del push. Mientras tanto, correr `migrate dev` en esa rama volvería a ofrecer reset.
- `STATUS_CONFIG` es `Record<ProposalStatus, ...>` estricto y forzó la exhaustividad en compilación. `STATUS_FILL` en `exportDashboard.ts` es `Record<string, ...>` suelto: un valor nuevo sin entrada no habría fallado el `tsc`, solo habría salido sin color en el Excel. La cobertura se agregó a mano.
- `BillingProjection` reutiliza el mismo enum y sus DTO son interfaces planas con `status?: string`, sin `class-validator`. Con dos valores más, el endpoint de proyecciones acepta ahora `APLAZADA` y `CANCELADA` sin validación en la capa API.
- El cambio de estado desde el dashboard sigue sin máquina de estados: cualquiera de los ocho valores es elegible para una propuesta existente, en ambos sentidos. Aplazar o cancelar es reversible.

### Archivos

- `apps/api/prisma/schema.prisma` — enum `ProposalStatus`
- `apps/api/prisma/migrations/20260723192442_add_proposal_status_aplazada_cancelada/migration.sql`
- `apps/web/src/lib/types.ts` — unión `ProposalStatus`
- `apps/web/src/lib/constants.ts` — `STATUS_CONFIG`, `ALL_STATUSES`
- `apps/web/src/hooks/useDashboard.ts` — `PIPELINE_STATUSES`
- `apps/web/src/pages/dashboard/PipelineCards.tsx` — grilla de tarjetas
- `apps/web/src/lib/exportDashboard.ts` — `STATUS_FILL`
- `apps/web/src/lib/dashboardValidation.ts` — `TERMINAL_STATUSES`, `R5_EXEMPT_STATUSES`, regla R2

### Commits

- `5fe1ca1` — feat(proposals): add APLAZADA and CANCELADA to ProposalStatus enum
- `2e1e57d` — feat(dashboard): support APLAZADA and CANCELADA proposal statuses

### Pendientes

- **Renumeración en `feature/wysiwyg-pages`**: esa rama tiene un ADR numerado 069 que ahora colisiona. Se renumera con `str_replace` puntual al rebasar sobre `master`. La numeración la manda `master`.
- **`BillingProjection` sin validación de estado**: sus DTO son interfaces con `status?: string` y un cast en runtime. Falta un DTO con `class-validator` que restrinja el conjunto permitido.
- **Subconjuntos de estado dispersos**: `PIPELINE_STATUSES`, `FORECAST_STATUSES`, `PROJECTION_STATUSES`, `R5_EXEMPT_STATUSES` y `TERMINAL_STATUSES` viven en tres archivos distintos. Evaluar derivarlos de una sola declaración para que un estado nuevo no obligue a auditar todo.
- **`STATUS_FILL` con tipado suelto**: pasarlo a `Record<ProposalStatus, ...>` para que el compilador exija exhaustividad, como ya hace `STATUS_CONFIG`.
- **Verificación en producción**: confirmar tras el despliegue que los dos estados aparecen en el selector y que las proyecciones no los suman.

## ADR-070 — Cierre del incidente de crecimiento de DB y payloads calientes (cohorte 1)

**Fecha:** 2026-07-24
**Estado:** Aceptada

### Contexto

Incidente abierto desde junio 2026: lentitud intermitente en producción con ERR_HTTP2_PROTOCOL_ERROR y 502 esporádicos en `/presence/active` y `/app-settings/maintenance-banner`. En julio se sumó el hallazgo de que la base de producción pesaba 918 MB frente a un dump de junio de 71 MB.

Diagnóstico (restauración local del dump del 23-jul, rescate del dump truncado de junio como testigo, lecturas de metadata en producción y experimento A/B de colisión poll↔payload contra producción):

- El 97% de la base es `proposal_page_blocks` (886 MB vivos, casi todo TOAST); el 94% es la columna `content` (jsonb). El 98% del peso de esa columna son bytes duplicados: la plantilla "PROPUESTA DE VALOR" contiene una imagen base64 de ~2,5 MB que `initializeDefaultPages` materializa como bloque propio en cada propuesta (286 copias = 709 MB) y `cloneProposal` re-duplica en cada clon o versión.
- El crecimiento es lineal (~9–10 MB/día) desde el 5 de mayo (lanzamiento del builder de páginas), sin salto. El aparente salto 71→637 MB era un artefacto: el dump del 12-jun estaba truncado — el `pg_dump` fue interrumpido por el reinicio de Postgres del deploy `pre184`, 14 minutos después de iniciado, y quedó archivado seis semanas como backup válido.
- Postgres está sano (bloat ~2%, autovacuum coherente): el tamaño de la base no es la causa directa de la lentitud.
- Las rutas calientes movían bytes desproporcionados: el guard JWT seleccionaba `signatureUrl` (hasta 763 kB de base64) en cada request autenticado y lo descartaba; abrir el doc builder descargaba el payload completo dos veces (5,6 MB p50 ×2, sin compresión); guardar una imagen movía ~10 MB entre subida y ecos; editar un título echoaba ~2,6 MB.
- Falsos positivos descartados con evidencia: el fan-out del dashboard (payload real 0,3–1,3 MB), los upserts en el GET del maintenance-banner (ya era lectura pura; el patrón sí existía en `price-thresholds`, `supplier-field-requirements` e `inactivity-timeout`) y el tamaño de la base como causa de la lentitud.
- El mecanismo exacto de los 502 no se reprodujo con tráfico GET (una descarga de 4,4 MB no degradó los polls ni en conexiones aisladas ni multiplexados en h2); queda como hipótesis el path de escritura bajo concurrencia (parse y validación de bodies de MBs, base64 síncrono del upload, transacción del clone).

### Decisión

Atacar el incidente en dos cohortes. Cohorte 1 (esta, táctica, sin migración de schema) en la rama `fix/incident-payloads`:

1. El guard JWT valida con select mínimo: nuevo `findOneByIdForAuth` (`id`, `isActive`); `signatureUrl` deja de viajar Postgres→Node en cada request.
2. Los GET de app-settings pasan a lectura pura con defaults en memoria (patrón `getMaintenanceBanner`); los write paths que hacían `update` seco pasan a `upsert` (cierra un bug latente P2025 con fila ausente).
3. `compression()` (gzip) en el API.
4. El builder monta con la respuesta del POST `initialize` (payload idéntico al GET): una sola descarga; las mutaciones actualizan estado local sin consumir ecos.
5. Respuestas de mutación adelgazadas: `updatePage` sin `blocks`, `updateBlock` sin `content`, reorders retornan `[{id, sortOrder}]`.

Cohorte 2 (estructural, feature propia con ADR propio, tras llegar `feature/wysiwyg-pages` a master): extraer las imágenes del JSONB a una tabla de assets deduplicada por hash dentro de Postgres (se mantiene "sin storage externo"), bloques y plantillas por referencia, endpoint de assets cacheable, con migración de datos sobre `pg_dump` previo.

### Consecuencias

- Payloads calientes reducidos: montaje del builder a la mitad, mutaciones de MBs a kBs, requests autenticados sin arrastre de firmas, JSON de texto comprimido (el base64 solo comprime ~25–30%).
- El crecimiento de la base sigue activo (~2,5 MB por propuesta nueva) hasta la cohorte 2.
- Divergencia aceptada en RICH_TEXT: el html local queda pre-sanitización hasta la próxima recarga (se autocorrige).
- Ventana de deploy: una pestaña con bundle viejo contra el API nuevo crashea el builder al renombrar o reordenar (sin pérdida de datos; se recupera con refresh). Push sin usuarios activos o avisando refrescar.
- `findOneById` queda sin callers (limpieza futura).
- Verificación causal invertida: si la lentitud persiste tras el deploy, el incidente se reabre con waterfall de navegador en uso real como primer paso.
- El protocolo de backups queda señalado: sin verificación post-dump archivó un backup corrupto seis semanas; todo dump nuevo se verifica al crearlo (`pg_restore -l` completo + tamaño plausible).

### Archivos

- `apps/api/src/auth/jwt.strategy.ts`, `apps/api/src/users/users.service.ts`
- `apps/api/src/app-settings/app-settings.service.ts`
- `apps/api/src/main.ts`, `apps/api/package.json`, `pnpm-lock.yaml`
- `apps/web/src/hooks/useProposalPages.ts`
- `apps/api/src/proposals/pages.service.ts`

### Commits

- `7901d12` fix(auth): use minimal select in jwt validation
- `dce0be6` fix(app-settings): convert config GETs to pure reads
- `ade7594` feat(api): enable gzip response compression
- `54dd1b4` fix(web): use initialize response and local updates in doc builder
- `f25dced` fix(api): slim mutation responses in pages endpoints

### Pendientes

- Cohorte 2: assets deduplicados por hash (ADR propio al implementarla).
- Verificación post-dump en el protocolo de backups.
- Limpieza de `findOneById` sin callers.
- Errores prettier preexistentes en `app-settings.service.ts` (heredados de master).
- Escape Unicode literal en text node JSX de `BlockEditor.tsx` (cosmético, registrado aparte).

## ADR-071 — Swagger expuesto, throttler inoperante y gate de tipos ciego: el chequeo no cubría lo que rompía

**Fecha:** 2026-07-25
**Estado:** Aceptada

### Contexto

Auditoría de dependencias del API y composición del bundle de web (rama `chore/audit-deps-y-bundle`, 24-jul), documentada en `docs/diagnostico-2026-07-24-deps-bundle.md` con tres anexos. Destapó tres hallazgos de naturaleza distinta, ninguno reportado por un usuario:

- **Swagger público en producción.** `SwaggerModule.setup()` corría sin ninguna guarda de entorno. Las cuatro rutas que registra —`/api/docs`, `/api/docs-json`, `/api/docs-yaml` y `/api/docs/swagger-ui-init.js`— respondían 200 a un cliente anónimo desde internet, publicando el mapa completo de la superficie HTTP: 65 rutas, 93 operaciones, 43 esquemas, incluidas las 11 bajo `/admin` y las descripciones en lenguaje natural de cada endpoint. Dato que descartó el compromiso intermedio: el spec viaja incrustado en `swagger-ui-init.js` (75 480 bytes), así que proteger solo `/api/docs-yaml` no ocultaba nada.
- **Throttler inoperante desde su instalación.** Apareció como efecto colateral del control de la medición anterior. `x-ratelimit-remaining` clavado en 4 en `/auth/login` a lo largo de peticiones consecutivas ⇒ `totalHits = 1` cada vez: cada petición estrenaba su propio contador. Los logs HTTP del edge confirmaron que las 23 peticiones de sondeo salieron con un único `srcIp` constante, de modo que la variación no venía del cliente. El rate limiting existía desde abril (ADR-006) y no limitó nada en producción en ningún momento. Hallazgo adjunto: las rutas de Swagger se registran con `httpAdapter.get()`, por debajo del router de Nest, así que el `APP_GUARD` ni siquiera las cubría.
- **Gate de tipos ciego, con cinco semanas de tests muertos.** `apps/api/tsconfig.build.json` excluye `test` y `**/*spec.ts` por construcción, y el CI tipaba la api únicamente contra esa configuración. El bump a TypeScript 6.0 del ADR-048 (junio) dejó rojo el typecheck de los 7 archivos de test del programa —`types` vacío por defecto y semántica de `esModuleInterop`— y nadie lo vio, porque el chequeo que declaró el bump verificado no compilaba esos archivos.

### Decisión

**1. Swagger tras `SWAGGER_ENABLED`, con default apagado** (`0bdbfb7`). La condición envuelve el bloque completo de `setup()`, de modo que cierra las cuatro rutas de golpe, y compara contra el literal `'true'` y no `Boolean(...)`, para que `SWAGGER_ENABLED=false` desactive en vez de activar. La variable no existe en el servicio de Railway, así que el estado deseado en producción es el default y no hubo nada que tocar allí. Alternativas descartadas: derivar de `NODE_ENV` (acopla la visibilidad de la documentación a una variable que gobierna verbosidad de errores y comportamiento de terceros; ver la doc exigiría degradar el entorno) y proteger solo `/api/docs-yaml` (ineficaz por lo dicho en el contexto). El fix es un interruptor, no autenticación: mientras esté encendido, la doc está abierta.

**2. Throttler con la IP real del cliente, en tres pasos.** El primer diagnóstico acertó la causa —`req.ip` variable— pero no el mecanismo completo, y por eso hubo tres intentos encadenados en vez de uno:

- `a82b911` — `app.set('trust proxy', 1)`. Se eligió el entero `1` y no `true` por análisis de spoofing: con `true` y un edge que appendea, `req.ip` es la entrada más a la izquierda de `X-Forwarded-For`, es decir, la que puso el atacante. Con `1` la confianza es posicional y una XFF forjada queda siempre a la izquierda del truncado, stripee o appendee el edge. Los modos de fallo de `1` son sobre-limitar o quedar como estaba; el de `true` es entregar la evasión.
- `135321c` — límite global de 30 a 100 req/60 s, calibrado sobre 4 330 peticiones reales de 10,8 días de logs del edge. Pico legítimo medido: 24 req/60 s por (IP, handler) en `GET /spec-options/suggest`, producto mecánico del debounce de 300 ms del autocompletado de especificaciones. El 30 dejaba 1,25x de margen, que dos usuarios tras un mismo NAT —escenario ya observado— cruzan trabajando normal. El 100 deja 4,2x. Los `@Throttle` de auth no se tocan: la defensa fina de credenciales la dan ellos.
- `b7e6bbc` — `RealIpThrottlerGuard`, subclase de `ThrottlerGuard` con `getTracker()` sobre `X-Real-IP` y fallback a `req.ip` en local. Una sonda temporal desplegada a propósito (`292a126`, revertida en `bb3563c`) midió dentro del contenedor lo que no era observable desde fuera y demostró que con `trust proxy 1` `req.ip` resuelve el salto interno del edge, que rota entre peticiones: el paso anterior no bastaba. `X-Real-IP` es la cabecera que Railway documenta para la IP del cliente y que su edge reemplaza si el cliente la forja.

**3. El gate de tipos de la api pasa a `tsconfig.json` y el CI corre los tests.** `af44683` apunta el typecheck de `ci.yml` y `pr-check.yml` a `apps/api/tsconfig.json`, el mismo programa que el `tsc --noEmit` local, con los 7 archivos de test dentro. `cc6c572` añade el paso de jest (`pnpm --filter api test`) justo después; el `test:e2e` queda fuera de CI por usar configuración aparte y poder exigir Postgres. Para que ambos pasaran en verde: `1664b08` restaura `"types": ["jest", "node"]` en `tsconfig.json` y cambia el import de supertest a default; `24d83c5` provee dependencias mockeadas (`provide`/`useValue`) en los cuatro specs por defecto de Nest, que fallaban al compilar el `TestingModule` por DI sin resolver.

**4. Regla de verificación.** `tsconfig.build.json` es la configuración de build y **no cuenta como gate de tipos de la api**: excluye `test` y `**/*spec.ts` por construcción. El typecheck de la api es `apps/api/tsconfig.json`. Principio general del que esto es un caso particular: **la verificación se elige contra la clase de rotura que se está introduciendo; un gate que por construcción no puede ver esa clase de rotura no es un gate, aunque salga verde.** La regla se propaga a `INSTRUCTIVO_CLAUDE.md` §9 y `CONVENTIONS.md` §F en commit aparte de este ADR.

### Consecuencias

- La API deja de publicar su propio mapa a internet. Para consultar la documentación: `SWAGGER_ENABLED=true` en `apps/api/.env` y leerla en local, que describe la misma forma de API. Activarla en producción cuesta dos redespliegues (encender y apagar) y no añade autenticación.
- El rate limiting empieza a existir de verdad por primera vez desde abril de 2026. Consecuencia real y nueva: endpoints que nunca fueron limitados ahora pueden devolver 429. El 100 se calibró para que eso no le ocurra al tráfico legítimo medido, pero el margen es empírico, no teórico.
- Corrección de registro sobre el ADR-006 y sobre `CONVENTIONS.md` §K, que declaraban el rate limiting global de 30/min como medida activa: no lo era en producción, y el número ahora es 100. Ninguno de los dos se reescribe — §K se actualiza en el commit de documentación; el ADR-006 queda corregido por referencia desde aquí, porque `DECISIONS.md` es append-only.
- Corrección de registro sobre el ADR-048, que declaró el bump a TypeScript 6.0 verificado con evidencia que no cubría lo que el bump rompía. Tampoco se edita: queda corregido desde aquí.
- El gate se vuelve más lento y, al principio, más ruidoso: los 7 archivos de test entran al programa de tipos y jest corre en cada push y cada PR. Es el costo de que vea lo que antes no veía.
- `apps/api/.env.example` documenta `SWAGGER_ENABLED`.
- Patrón validado: instrumentación desplegada a propósito y revertida en el commit siguiente (`292a126` → `bb3563c`), cuando el dato solo es observable desde dentro del contenedor y Railway no da shell. La sonda entra y sale en el mismo par de commits, nunca queda.
- El `gzip on` de nginx (`7033683`) salió del Bloque C de este mismo diagnóstico, pero pertenece a la decisión de compresión del ADR-070 y se registra allí como cola, no aquí.

### Archivos

- `apps/api/src/main.ts` — guarda `SWAGGER_ENABLED` sobre el bloque de Swagger; `app.set('trust proxy', 1)`
- `apps/api/.env.example` — `SWAGGER_ENABLED`
- `apps/api/src/app.module.ts` — `limit: 100`; `APP_GUARD` pasa a `RealIpThrottlerGuard`
- `apps/api/src/common/guards/real-ip-throttler.guard.ts` — nuevo, `getTracker()` sobre `X-Real-IP`
- `apps/api/tsconfig.json` — `"types": ["jest", "node"]`
- `apps/api/test/app.e2e-spec.ts` — import default de supertest
- `apps/api/src/auth/auth.controller.spec.ts`, `apps/api/src/auth/auth.service.spec.ts`, `apps/api/src/users/users.controller.spec.ts`, `apps/api/src/users/users.service.spec.ts` — mocks de DI
- `.github/workflows/ci.yml`, `.github/workflows/pr-check.yml` — typecheck contra `tsconfig.json` y paso de jest
- `docs/diagnostico-2026-07-24-deps-bundle.md` — diagnóstico y sus tres anexos

### Commits

- `17b4979` docs: diagnostico de dependencias del API y bundle de web
- `2dc6f77` docs: anexo de exposicion de Swagger en el diagnostico
- `0bdbfb7` fix(api): gate Swagger behind SWAGGER_ENABLED, default off
- `b3da89b` docs: anexo throttler inoperante y trust proxy en el diagnostico
- `a82b911` fix(api): trust exactly one proxy hop so req.ip sees the real client
- `292a126` chore(api): TEMPORARY [PROXY-PROBE] logging of edge proxy headers
- `135321c` fix(api): raise global throttler limit from 30 to 100 req/60s
- `3266dee` docs: anexo de medicion de trafico que calibra el limit 100 del throttler
- `b7e6bbc` fix(api): throttler tracks X-Real-IP so rate limiting counts real clients
- `bb3563c` Revert "chore(api): TEMPORARY [PROXY-PROBE] logging of edge proxy headers"
- `1664b08` fix(api): restore jest/node types in tsconfig and supertest default import
- `af44683` ci: typecheck api against tsconfig.json so spec files gate the build
- `24d83c5` test(api): provide mocked dependencies so DI resolves in unit spec files
- `cc6c572` ci: run api unit tests after the typecheck step

### Pendientes

- **Verificar el throttler en producción**: 6 peticiones a `/auth/login` con credenciales inválidas dentro de una ventana de 60 s desde una sola máquina. Esperado: 401 con `remaining` bajando de 4 a 0 y **429 en la sexta**. Es la única prueba que cierra `b7e6bbc`; el guard de `X-Real-IP` no se verificó contra producción. Hacerla fuera de horario de usuarios y no repetirla en bucle (la IP queda bloqueada para esa ruta hasta 60 s). Si aparecieran 429 antes de la sexta, hay un salto intermedio y toca reevaluar.
- **Verificar el cierre de Swagger en producción**: 404 en las cuatro rutas.
- **`SWAGGER_ENABLED` no debe crearse en Railway.** Si se activa puntualmente, quitarla al terminar; son dos redespliegues.
- **`/uploads/*` sin auditar**: `app.useStaticAssets()` monta ficheros por debajo del router, igual que Swagger, así que tampoco lo cubre el throttler. No se midió qué expone.
- **Preguntas abiertas del diagnóstico, sin cerrar**: severidad efectiva de los 28 advisories de `axios`; `express` importado en `main.ts` sin estar declarado en `apps/api/package.json`; si el `COPY` de `node_modules` del Dockerfile preserva el layout de `.pnpm` en la imagen (condiciona el inventario real de vulnerabilidades); `react-router` resuelto a la build `development`; `@tiptap/extension-underline` y `@tiptap/pm` declarados sin sitio de import.
- **Peso del bundle de web**: `FileSaver.min` (939 kB, 99,6 % `exceljs`) y `RichTextEditor` (1 021 kB) son imports estáticos de sus chunks de ruta, así que se descargan al entrar a la ruta y no al pulsar exportar. Candidatos a `import()` dinámico.
- **Propagación de la regla del gate** a `INSTRUCTIVO_CLAUDE.md` §9 y `CONVENTIONS.md` §F, y actualización de §K (rate limiting): commit aparte de este ADR.

## ADR-072 — El pool de Prisma dimensionado por CPUs del host, no por la carga real

**Fecha:** 2026-07-26
**Estado:** Aceptada

### Contexto

El `DATABASE_URL` del servicio `novotechflow` no llevaba query string, así que el tamaño del pool de Prisma era el default calculado: `num_physical_cpus * 2 + 1`. El contenedor de Railway reporta las CPUs del host, no una cuota asignada, de modo que el cálculo daba 48 CPUs y un pool de 97 conexiones contra un Postgres de `max_connections = 100`.

El hallazgo salió de la sesión de higiene del 26-jul, y la evidencia apareció por un efecto colateral: al quitar `query` del array de log de `PrismaService` (`2c1c613`) quedó `info`, y el arranque del deploy imprimió `prisma:info Starting a postgresql pool with 97 connections.` — el número medido en producción, no inferido.

Medición de solo lectura contra el Postgres de producción, tomada un domingo sin carga:

- `max_connections = 100`, `superuser_reserved_connections = 3`, `reserved_connections = 0`.
- Conexiones de cliente reales (`backend_type = 'client backend'`): **2** — una de la API (idle, `client_addr` de red privada de Railway) y la propia sesión de medición.
- Las otras 8 filas de `pg_stat_activity` son procesos auxiliares del servidor (`io worker`, `walwriter`, `checkpointer`, `background writer`, `autovacuum launcher`, `logical replication launcher`), que **no consumen slot** de `max_connections`: ese techo aplica solo a `client backend`. Leer el `count(*)` crudo de la vista sobreestima el consumo.
- El rol que conecta es `postgres` con `usesuper = t`, así que la reserva de 3 no lo gatea: el techo efectivo para la aplicación es 100, no 97.

En estado estacionario no había problema — el `connection_limit` es un máximo del pool, no una preasignación, y la API sostenía una sola conexión. El riesgo era de pico y de solapamiento: con 97 de techo 100, el margen para `prisma migrate deploy`, un dump, un `psql` manual o una segunda instancia durante un redeploy era de 3 conexiones. El modo de falla es `FATAL: sorry, too many clients already` a mitad de un deploy.

### Decisión

`DATABASE_URL` del servicio `novotechflow` pasa a `${{Postgres.DATABASE_URL}}?connection_limit=15&pool_timeout=20`.

**La referencia se conserva intacta y el sufijo se compone sobre ella.** No se hardcodea la URL: esa regla ya costó una caída cuando rotó la contraseña del Postgres y la API quedó con credenciales viejas en memoria sin redeploy automático. Railway resuelve la referencia y concatena el sufijo. Se verificó antes de escribir que la URL interna no traía query string propio, porque de haberlo el separador tendría que ser `&` y no `?`.

**El 15 se dimensiona desde la carga, no desde el hardware.** Seis usuarios comerciales, un endpoint de autocompletado con debounce de 300 ms y exportaciones ocasionales. El pico legítimo medido en el ADR-071 fue 24 req/60 s por (IP, handler); con latencias de decenas de milisegundos eso no sostiene cinco conexiones simultáneas. 15 deja ~3x sobre cualquier escenario plausible y libera 85 slots del techo.

**`pool_timeout=20` convierte la saturación en un error de aplicación explícito** (`Timed out fetching a new connection from the connection pool`) en vez de una espera indefinida.

Alternativas descartadas: dejar el default (el problema es que no describe nada de esta aplicación); fijar el pool por variable de entorno de Prisma en vez de en la URL (la URL es el mecanismo documentado y viaja con la referencia); pgBouncer (infraestructura nueva para un problema que un query string resuelve).

### Consecuencias

- El pool pasa de 97 a 15. Verificado en el log del deploy `b4b1ec87`: `prisma:info Starting a postgresql pool with 15 connections.` y `Nest application successfully started`.
- El margen contra el techo de Postgres pasa de 3 a 85 conexiones.
- **El pico concurrente real sigue sin medirse.** La medición fue un instante único sin carga; acota el uso actual y no dice nada del pico. Si 15 quedara corto, el síntoma es el `pool_timeout` explícito y subirlo es un cambio de variable — modo de falla preferible al anterior, que aparecía durante un deploy.
- Principio general, hermano del que fijó el ADR-071 sobre los gates: **un default calculado sobre recursos del host no describe la carga de la aplicación, y en un contenedor compartido ese cálculo yerra sistemáticamente hacia arriba.** El número que un runtime elige por ti merece la misma verificación que el que eliges tú.
- El `prisma:info` que reveló el 97 sobrevivió porque `2c1c613` quitó solo `query` del array de log. Bajar más el nivel habría ocultado el dato.
- Sin ADR aparte para el resto de la sesión de higiene (log de Prisma, imports redundantes de `PrismaModule`, reglas de documentación): son limpieza y propagación, no decisiones de arquitectura.

### Archivos

Ninguno del repo. El cambio vive en la variable `DATABASE_URL` del servicio `novotechflow` en Railway.

### Commits

- `2c1c613` chore(api): drop prisma query logging from production log level
- `fb0fff4` refactor(api): drop redundant PrismaModule imports, module is global
- `6e4e0c9` docs: no Co-Authored-By trailer, api type gate is tsconfig.json, real throttler limit
- `273ac73` docs: restore verified auth throttle limits and gate principle wording

### Pendientes

- **Medir el pico concurrente bajo carga real** para validar el 15. Muestreo de `pg_stat_activity` a lo largo de una ventana de tráfico de día hábil, no un instante.
- **`api-external` no fue auditado.** Es un servicio separado con su propio Postgres (`postgres-external`) y presumiblemente el mismo default de pool. Aplicar la misma revisión.
- **`@Global()` no auto-registra un módulo**: durante esta sesión se propuso quitar `PrismaModule` del array `imports` de `app.module.ts` junto con los 8 re-imports redundantes. Habría dejado el módulo fuera del grafo, sin instanciar, y `PrismaService` fuera del contenedor DI — error de runtime que ni `tsc` ni los specs actuales detectan, porque ninguno levanta el `AppModule` real. La registración raíz se queda. Anotado como invariante para una futura pasada de auditoría (INSTRUCTIVO §10.6).

## ADR-073 — El .dockerignore solo existe en la raíz del contexto: los de apps/* eran letra muerta

**Fecha:** 2026-07-26
**Estado:** Aceptada

### Contexto

El `docker compose build` de `web` fallaba en local: `COPY apps/web/ apps/web/` copiaba `apps/web/node_modules` —con las junctions que pnpm crea en Windows— encima del install de la etapa builder. El repo tenía dos `.dockerignore`, uno en `apps/web/` y otro en `apps/api/`, con `node_modules`, `dist` y `.env`. Ninguno de los dos se leía nunca.

La causa es la ubicación. Ambos servicios se construyen con el contexto en la raíz del monorepo (`docker-compose.yml`: `context: .`, `dockerfile: apps/<app>/Dockerfile`), y ahí BuildKit solo consulta dos rutas: `<contexto>/.dockerignore` o, con precedencia, el hermano del Dockerfile (`apps/<app>/Dockerfile.dockerignore`). No existía ninguna de las dos. Un `.dockerignore` en un subdirectorio del contexto no lo lee nadie.

El contexto de la raíz no es una elección revisable: los dos Dockerfiles copian `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `packages/` desde el contexto.

Verificado en el diagnóstico, el alcance era mayor al reportado:

- **`apps/api` compartía el problema íntegro**, con un agravante: `COPY apps/api/ apps/api/` metía `apps/api/.env` en la imagen builder — secretos locales horneados en una capa.
- `COPY packages/ packages/` arrastraba los `node_modules` anidados de los cuatro packages del workspace.
- **En Railway tampoco gobernaba ningún ignore.** El contexto también es la raíz (el log imprime `load build definition from apps/api/Dockerfile`, ruta relativa a la raíz), y no hay `railway.json`, `railway.toml`, `.railwayignore` ni `RAILWAY_DOCKERFILE_PATH` en ninguno de los dos servicios. Producción construye limpio por otra razón: su contexto sale del archive de git, y `git ls-files` confirma que ningún `node_modules/`, `dist/` ni `.env` está trackeado. Estaba protegido por el `.gitignore`, no por configuración de Docker.

### Decisión

Un único `.dockerignore` en la raíz del contexto, con los patrones anclados con `**/`, y se eliminan los dos de `apps/*`. Contenido: `.git`, `**/node_modules`, `**/dist`, `**/.env`, más un comentario que preserva la nota heredada de `apps/api` (no excluir `uploads/`: los defaults se necesitan en build).

**La raíz es la única ubicación que los cuatro caminos consultan** (web y api, local y Railway) sin depender de comportamiento no documentado.

**El `**/` no es cosmético.** Los patrones de `.dockerignore` se evalúan contra la raíz del contexto y no tienen la semántica de `.gitignore`: `node_modules` a secas solo matchea el nivel superior, no `apps/web/node_modules` ni `packages/*/node_modules` — que es justo lo que rompía el build.

Alternativas descartadas: **renombrar a `apps/web/Dockerfile.dockerignore`**, la hipótesis con la que entró el diagnóstico — el builder de Railway no documenta que honre el hermano del Dockerfile, y aun honrándolo el archivo habría excluido solo el nivel superior, dejando el modo de falla intacto; en Railway además sería un no-op, porque lo que esos patrones matchean ya no viaja en el archive de git. **Mover el contexto a `apps/<app>`**: rompe los COPY del lockfile, el workspace y `packages/`. **No hacer nada**: producción sobrevive, pero el build local queda roto y el `.env` sigue entrando a las capas.

`.git` se excluye de paso: ningún COPY lo consume y es peso muerto del contexto.

### Consecuencias

- `docker compose build api web` completa en local (exit 0, ~3,5 min). El log confirma que el archivo actúa: `load .dockerignore — transferring context: 163B done`.
- El `.env` de `apps/api` deja de entrar al contexto y de quedar en una capa del builder.
- **Railway construye igual.** Lo que el archivo excluye ya no viajaba en el archive de git; el único cambio observable será que `load .dockerignore` pase a cargar contenido. No es un cambio de comportamiento en producción: es cerrar la brecha entre los dos entornos.
- Principio: **un ignore-file mal ubicado no falla, desaparece.** No hay error, ni warning, ni etapa que se salte — el build procede sin él y el archivo queda como documentación de una intención que nadie ejecuta. Hermano del principio del ADR-071: un gate que no cubre lo que cree cubrir es peor que no tenerlo, porque además tranquiliza.
- Falso positivo registrado: el problema entró como "hay que renombrar el archivo" y el rename resultó **insuficiente** (solo top-level) e **innecesario** (no-op en Railway). Lo que faltaba no era mover el archivo, era anclar los patrones y ponerlos donde el builder mira.
- La limpieza del build de producción dependía por completo de que el `.gitignore` siguiera cubriendo `node_modules`, `dist` y `.env`. Deja de ser la única línea de defensa.

### Archivos

- `.dockerignore` — nuevo, raíz del repo.
- `apps/web/.dockerignore` — eliminado.
- `apps/api/.dockerignore` — eliminado.

### Commits

- `d0780bf` chore(docker): root dockerignore for monorepo build context

### Pendientes

- **`.gitattributes` con `*.dockerignore text eol=lf`.** Git avisó `LF will be replaced by CRLF the next time Git touches it` al commitear (`core.autocrlf` en la máquina). El blob quedó en LF y el parser de `.dockerignore` tolera el `\r`, así que no bloquea; queda como blindaje del drift, pendiente de aprobación.
- **`api-external` no fue auditado.** Servicio separado en Railway, con su Dockerfile en la rama `feature/external-api`; no se verificó si repite el patrón. Aplicar la misma revisión antes de mergear esa rama.
- **El tamaño real del contexto no se midió.** Los logs de build de Railway no emiten el `transferring context: <tamaño>` de la etapa `load build context`, así que la reducción se infiere del contenido excluido, no de una medición.

## ADR-074 — Imagen del API: árbol de producción desde el lockfile (etapa prod-deps hoisted)

**Fecha:** 2026-07-26
**Estado:** Aceptada

### Contexto

Medición sobre la imagen de producción del API (master, imagen `novotechflow-api-diag`): el runner copiaba `/app/apps/api/node_modules` del builder — bajo pnpm, solo symlinks hacia el store `/app/node_modules/.pnpm`, que nunca se copiaba — y el `RUN npm install prisma@5.10.2` encontraba el árbol roto y reinstalaba todo el `package.json` desde el registry ("added 842 packages"). Consecuencias medidas: la imagen corría lo que npm resolvía en build-time, no `pnpm-lock.yaml` (rangos caret sin reproducibilidad: el reporte de npm pasó de 4 a 35 vulnerabilidades sin tocar `package.json`); devDependencies en producción (`typescript` 6.0.2 resolvía dentro del contenedor; el install del builder va sin `--prod` y el `npm install` sin `--omit=dev`); el Prisma Client de runtime lo generaba el postinstall de npm en el runner, desperdiciando el `generate` del builder; imagen de 1.85 GB con un `package-lock.json` ajeno en `/app`. El paso de npm era además load-bearing: sin él la imagen no arrancaba, así que no podía eliminarse sin reemplazar el mecanismo completo.

### Decisión

Dockerfile en tres etapas. El builder queda igual, con `apk add openssl` y `pnpm exec prisma generate` en vez de `npx`. Etapa nueva `prod-deps`: `pnpm install --frozen-lockfile --filter api... --prod --config.node-linker=hoisted` — árbol real y plano, solo producción, versiones exactas del lockfile — más `pnpm exec prisma generate` explícito (pnpm 10 ignora los build scripts por default). El runner copia `/app/node_modules` desde `prod-deps`, elimina el `npm install` y el pnpm global, y el CMD corre `node_modules/.bin/prisma migrate deploy` en vez de `npx`. `prisma` pasa de devDependencies a dependencies (pinneada 5.10.2): el arranque ejecuta `migrate deploy` y el CLI debe viajar en el árbol de producción. Alternativa descartada: `pnpm deploy --prod` (el mecanismo canónico) — cambió de comportamiento con workspaces en pnpm 10 y agrega fricción que la etapa hoisted evita, con el mismo layout plano que producción ya corría.

### Consecuencias

- Imagen 1.85 GB → 811 MB; `node_modules` 482.6 M → 453.3 M. La reducción grande no viene del árbol sino de eliminar el apilamiento de capas (symlinks colgantes + reinstalación npm encima).
- `typescript` → MODULE_NOT_FOUND dentro del contenedor; sin `package-lock.json`; sin bloques de npm audit/deprecated en el log; build en 1 m 22 s.
- Reproducibilidad: la imagen corre exactamente el árbol de `pnpm-lock.yaml`; npm queda solo para bootstrapear pnpm en etapas de build.
- El client de Prisma de runtime es el del `generate` de `prod-deps`, con openssl presente (engines para libssl 3.x; desaparece el `prisma:warn` de libssl).
- Boot verificado contra la DB local: `migrate deploy` corre desde el binario de la imagen y Nest arranca; caída esperada por `GEMINI_API_KEY` ausente en el run de prueba, con resolución física de módulos confirmada en el stack.
- Nota de comportamiento: con node-linker hoisted, pnpm deja `node_modules/.pnpm/lock.yaml` (solo metadatos, sin store virtual); el árbol es plano.

### Archivos

- `apps/api/Dockerfile` — reestructura a tres etapas.
- `apps/api/package.json` — `prisma` a dependencies.
- `pnpm-lock.yaml` — importer de `apps/api`.

### Commits

- `68f966a` fix(docker): api image installs prod-only tree from pnpm lockfile

### Pendientes

- Verificación en Railway tras el push: logs de build y deploy del servicio `novotechflow` (primer build sin cache, más largo).
- `api-external` (rama `feature/external-api`) repite el patrón viejo en su Dockerfile; aplicar la misma revisión antes del merge (ya registrado en ADR-073).

## ADR-075 — El gate de lint que no linteaba: ESLint entra al job que ya prometía su nombre

**Fecha:** 2026-07-27
**Estado:** Aceptada

### Contexto

El job `lint-and-typecheck` (nombre visible "Lint & Type-check") de `ci.yml` y `pr-check.yml` no ejecutaba ESLint en ningún step: solo `tsc` en web y api más los tests de Jest. Un check en verde afirmaba que el lint pasaba cuando nunca corrió. Es el mismo patrón que ADR-071: un gate que no cubre lo que su nombre promete.

La medición previa a decidir dio: `apps/web` 2 errores `react-hooks/set-state-in-effect` (`useAccountConflicts.ts`, `SupplierPicker.tsx`), `apps/api` 41 errores `prettier/prettier`, todos de formato y auto-corregibles. El hallazgo #4 diferido en ADR-050 (`react-hooks/purity` en `useInactivityTimeout.ts`) ya no existe: se resolvió en `a80302e` y el encabezado de ADR-050 quedó desactualizado. Los 2 errores de web son deuda nueva, posterior a ese inventario — evidencia directa de que el check ciego dejó entrar regresiones.

El script `lint` de `apps/api` incluía `--fix`, incompatible con CI: corrige el workspace efímero y sale verde aunque el repositorio esté sin formatear.

### Decisión

Añadir el ESLint que el nombre del job ya prometía, en vez de renombrar el job. Poner el repositorio en verde primero, en commits atómicos y en orden tal que ningún commit deje CI rojo: formato de api, fixes de web, split del script, y por último los steps de CI.

Los 2 errores de web se corrigen derivando estado, no silenciando la regla. `useAccountConflicts` guarda el resultado atado al nombre que lo originó (`{ name, records }`) y deriva `conflicts` solo cuando coincide con el nombre actual; `SupplierPicker` elimina el efecto de sincronización y deriva `query` de `draft ?? selectedCompany?.name ?? ''`. Ambos cierran además bugs latentes: el panel mostraba cruces del cliente anterior durante el debounce, y un refetch de `companies` pisaba lo que el usuario estaba tecleando.

Los steps van después de "Generate Prisma Client" porque el ESLint de api es type-aware, y se declaran con `working-directory` + `pnpm run lint` en vez de `pnpm --filter`, para no depender del campo `name` de cada paquete.

### Consecuencias

- Un `react-hooks/set-state-in-effect` o un `prettier/prettier` nuevo bloquea el PR. Es el efecto buscado.
- `pnpm run lint` en `apps/api` ya no reescribe archivos; el auto-fix local pasa a `pnpm run lint:fix`.
- La deriva de formato en api se acumulaba invisible porque nadie corría el lint sin `--fix`. Ahora falla en CI en el PR que la introduce.
- Coste de entrada bajo: 41 de los 43 hallazgos se corrigieron con un `--fix`.

### Archivos

- `.github/workflows/ci.yml` — steps "Lint Web (ESLint)" y "Lint API (ESLint)".
- `.github/workflows/pr-check.yml` — mismos dos steps, en paridad.
- `apps/api/package.json` — `lint` sin `--fix`; `lint:fix` nuevo.
- `apps/web/src/hooks/useAccountConflicts.ts` — resultado atado al nombre de búsqueda, `conflicts` derivado.
- `apps/web/src/pages/proposals/components/SupplierPicker.tsx` — `query` derivado de `draft`, efecto de sync eliminado.
- 5 archivos de `apps/api/src` — formato Prettier aplicado.

### Commits

- `51bad4e` chore(api): apply pending prettier formatting via eslint --fix
- `6ffddc5` fix(web): derive state instead of syncing via effects (react-hooks lint)
- `e7ba92d` fix(web): reset supplier draft after create request
- `b85e202` chore(api): split lint script into check and fix variants
- `21c74d7` ci: run eslint in lint-and-typecheck job

### Pendientes

- El encabezado de ADR-050 dice "2 diferidos" (#4 y #12), pero ambos se resolvieron en `a80302e`. No se corrige aquí porque `DECISIONS.md` es append-only; queda registrado en esta entrada.
- `useAccountConflicts` no expone estado de búsqueda en curso: al editar un nombre con cruces en pantalla, el panel muestra "Cliente Libre" durante el debounce y el fetch. Requiere una bandera `isSearching` en el hook y en el panel.
- `packages/eslint-config` (`@repo/eslint-config`) no tiene consumidores: ninguna app lo declara en devDependencies ni lo extiende. Decidir entre cablearlo o eliminarlo.
- Ninguna de las dos apps usa linting type-aware en web; `apps/api` sí. Evaluar si conviene igualarlo.

## ADR-076 — El logo de 4,5 MB para renderizarlo a 32 px: asset redimensionado y cache para estáticos sin hash

**Fecha:** 2026-07-31
**Estado:** Aceptada

### Contexto

Los logs de nginx en producción mostraban `GET /novotechflow.png` sirviendo 4.544.802 bytes en la carga del dashboard. La medición encontró un PNG de 3062×1376 RGBA renderizado a 32 px de alto en el sidebar (`Sidebar.tsx:73`, presente en toda vista autenticada) y a 48 px en el login: 43× la altura necesaria a 1× DPR.

`apps/web/public/logo.png` era el mismo binario byte-idéntico, sin ninguna referencia en `apps/web/src`, `index.html` ni el manifest, y aun así se copiaba al build.

Por cache, `/novotechflow.png` vive en la raíz del build (viene de `public/`), no bajo `/assets/`, así que caía en el catch-all `location /` con `Cache-Control: no-cache` — revalidación en cada carga. `apps/web/nginx.conf` no tenía ningún `location` para estáticos no hasheados.

### Decisión

Redimensionar el asset a 600 px de ancho (2,5× el mayor uso a 3× DPR), conservando el canal alfa: 4.544.802 → 148.774 bytes, −96,7 %. La conversión se hizo con ImageMagick, ya instalado en la máquina, y no con `sharp`: instalarlo habría metido binarios nativos en el lockfile por un uso de una sola vez.

Eliminar `logo.png` tras verificar que no lo referencia ningún archivo de código ni manifest.

Añadir un `location` con regex para estáticos sin hash (`png|jpg|jpeg|gif|ico|svg|webp|woff2`) con `max-age=604800` — una semana, **no** `immutable` ni un año: el nombre de archivo no lleva hash de contenido, así que un cambio de logo debe propagarse solo. El bloque repite los cuatro headers de seguridad, según la advertencia que el propio `nginx.conf` documenta: un `add_header` a nivel `location` descarta todo el array de nivel `server`.

### Consecuencias

- El peso del logo por visita baja de 4,44 MB a 145 KB, y a cero en las visitas siguientes dentro de la semana.
- Un cambio de logo tarda hasta 7 días en propagarse a un navegador que ya lo tenga cacheado. Es el trade-off aceptado por no tener hash en el nombre.
- El `location ~*` (regex) tiene precedencia sobre el prefijo `location /assets/`: si Vite llegara a emitir imágenes o fuentes con hash dentro de `/assets/`, saldrían con una semana en vez de `immutable`. Con el build actual (`dist/assets/` solo emite `.js` y `.css`) no cambia nada.
- `-strip` eliminó el perfil de color del PNG; el resultado se verificó visualmente en local sobre el fondo oscuro antes de commitear.

### Archivos

- `apps/web/public/novotechflow.png` — 3062×1376 (4.544.802 B) → 600×270 (148.774 B), alfa preservado.
- `apps/web/public/logo.png` — eliminado (duplicado byte-idéntico sin consumidores).
- `apps/web/nginx.conf` — `location` nuevo para estáticos sin hash, entre `/assets/` y el catch-all.

### Commits

- `37d3110` perf(web): downscale logo asset and drop duplicate copy
- `fe5f324` perf(web): cache unhashed static assets for one week

### Pendientes

- `novotechflow.png` en la raíz del repo y dos copias en `backups/2026-03-26-PDF_DOC_BUILDER/` siguen en 4,5 MB cada una: no llegan al build, pero son ~13,6 MB de peso muerto en git. Borrar `backups/` merece su propia decisión.
- `apps/web/public/defaults/portada.png` (503.746 B, 815×1074) es default del builder de documentos y puede terminar embebido en PDFs; no se tocó. Evaluar aparte con ese uso a la vista.
- Ningún `<img>` del logo declara `width`/`height` ni `loading`/`decoding`. Con el asset liviano el impacto es menor, pero la ausencia de dimensiones explícitas provoca layout shift.

## ADR-077 — Cierre de los pendientes de ADR-075: la cadena muerta era de dos eslabones y "Cliente Libre" era el estado por defecto

**Fecha:** 2026-07-31
**Estado:** Aceptada

### Contexto

ADR-075 dejó tres pendientes. Al abordarlos, dos resultaron ser distintos de como estaban registrados.

El primero afirmaba que `packages/eslint-config` no tenía consumidores. Es falso: `packages/ui/eslint.config.mjs` lo importa y su `package.json` lo declara como `workspace:*`. El error fue acotar la búsqueda a `apps/` y no a `packages/`. Eliminarlo en aislamiento habría roto `pnpm install --frozen-lockfile` en ambos Dockerfiles y en CI. La verificación posterior mostró que `@repo/ui` tampoco tiene consumidores: era una cadena muerta de dos eslabones, no un paquete huérfano.

El segundo pedía una bandera `isSearching` para la ventana en que el panel de cruce de cuentas muestra "Cliente Libre" durante el debounce. La lectura del código destapó dos fallos peores: por debajo de `MIN_CONFLICT_SEARCH_LENGTH` el efecto retorna sin buscar, así que con 1-2 letras "Cliente Libre" no es transitorio sino permanente y falso; y si el fetch falla, el `catch` solo loguea y el panel afirma en verde que nadie cotizó al cliente. En un panel cuyo propósito es evitar que dos comerciales coticen al mismo cliente, un fallo silencioso en verde es peor que no tener panel.

El tercero era el encabezado desactualizado de ADR-050.

### Decisión

Eliminar `packages/ui` y `packages/eslint-config` juntos y regenerar el lockfile. Es scaffold de Turborepo que nunca se usó: el `README` del paquete aún titula `@turbo/eslint-config`, sus dependencias divergen de las de las apps, y el patrón real del proyecto para código compartido ya es otro (`@repo/item-display`, creado con propósito concreto). Un design system futuro se haría de nuevo, no resucitando este esqueleto.

Sustituir la bandera suelta por una unión discriminada `ConflictSearchState` (`idle | searching | ready | failed`), derivada en render y anclada al nombre que originó cada resultado — sin estado nuevo sincronizado por efecto, para no reintroducir lo que ADR-075 acababa de sacar. `ready` solo se alcanza cuando el servidor respondió para el nombre vigente; deja de ser el estado por defecto de todo lo que no sea una lista con datos.

Corregir ADR-050 con `str_replace` aditivo en título y `**Estado:**` (INSTRUCTIVO §4.6), sin tocar Consecuencias ni Archivos: son narrativa del momento y la entrada ya se autocorrige en sus Pendientes.

### Consecuencias

- El monorepo pasa de 6 a 5 workspace projects; el lockfile pierde 1.189 líneas y 101 paquetes resueltos por install.
- El panel gana dos estados visibles: "Buscando propuestas previas..." y un estado ámbar de fallo. `hasNoConflicts` e `isClientEmpty` desaparecen del API del hook y de sus dos consumidores.
- La premisa falsa de ADR-075 queda corregida aquí, no allá: `DECISIONS.md` es append-only y la entrada anterior conserva lo que se creía cuando se escribió.
- Confirmado que un pendiente de un ADR no es una tarea validada: dos de los tres cambiaron de forma al mirarlos de cerca. Vale releer el código antes de ejecutar un pendiente heredado.

### Archivos

- `packages/ui/`, `packages/eslint-config/` — eliminados completos.
- `pnpm-lock.yaml` — regenerado sin los dos importers.
- `CONVENTIONS.md`, `AGENTS.md` — árbol de §I actualizado; `item-display/` agregado, que no estaba listado. Byte-idénticos verificados por SHA256 antes y después.
- `DECISIONS.md` — ADR-050: título y `**Estado:**` marcan los diferidos como resueltos en `a80302e`.
- `apps/web/src/lib/types.ts` — tipo `ConflictSearchState`.
- `apps/web/src/hooks/useAccountConflicts.ts` — retorna `{ state }`; JSDoc corregido.
- `apps/web/src/components/proposals/ConflictPanel.tsx` — prop única `state`, cuerpo en `switch` de 4 ramas.
- `apps/web/src/pages/tools/AccountCrossCheck.tsx`, `apps/web/src/pages/proposals/NewProposal.tsx` — consumidores actualizados.

### Commits

- `024a43c` chore: remove dead ui and eslint-config packages
- `56f0e08` docs: drop removed packages from project tree in conventions
- `5ebe88c` docs: ADR-050 mark deferred findings as resolved
- `53dd812` feat(web): model conflict panel state as discriminated union
- `cfc3b21` docs(web): fix stale jsdoc in useAccountConflicts

### Pendientes

- Lint type-aware en `apps/web` (último pendiente vivo de ADR-075): `apps/api` ya lo tiene vía `parserOptions.project`. Evaluar si conviene igualarlo y qué hallazgos nuevos saldrían.
- Railway no tiene `watchPatterns` configurado: todo push a `master` reconstruye API y web aunque solo cambie uno. Cuesta ~1 min de build ocioso; el riesgo de un patrón mal armado (un servicio que deja de redesplegar en silencio, sobre todo con los paquetes compartidos del workspace) es mayor que el beneficio. Se difiere conscientemente.
- `docs/audits/walkthrough8.md` y `README.md` aún describen `@repo/ui` y el scaffold original de Turborepo.

## ADR-078 — Adopción del Railway CLI en el flujo de trabajo para lectura de variables y logs de producción, con manejo estricto de secretos

**Fecha:** 2026-07-05
**Estado:** Aceptado

### Contexto

El diagnóstico de incidentes de producción y la inspección de configuración en Railway (variables de entorno, logs de build y deploy) se venían haciendo a mano por Luis en el dashboard, copiando y pegando salidas al chat. Eso es lento y, en el caso de las variables, arriesgado: la salida cruda expone secretos reales (`JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, etc.).

Railway publica un MCP server oficial que envuelve su CLI, lo que abre la posibilidad de que Claude Code lea variables y logs por sí mismo. Antes de montar el MCP se decidió establecer y verificar la capa base —el Railway CLI— en modo estrictamente de lectura, y fijar por escrito las reglas de manejo de secretos que el MCP deberá respetar después.

Restricción de entorno: el CLI no está en winget, y la regla del proyecto (§8, §6 de las instrucciones) prohíbe `npx`/`npm` global para herramientas del proyecto. El one-liner oficial (`curl ... | sh`) es solo macOS/Linux o Windows por WSL, y aquí se usa PowerShell nativo.

### Decisión

1. **Instalación del Railway CLI por binario pre-compilado, no por npm ni Scoop.** Se descargó el asset oficial `railway-v5.23.3-x86_64-pc-windows-msvc.zip` del release de GitHub y se dejó `railway.exe` en `C:\Users\admin\.local\bin` (ya en PATH, donde vive `claude.exe`). Cero `npm`/`npx`, cero cambio de execution policy, cero tooling nuevo. Contrapartida aceptada: los updates futuros son manuales (re-descargar).

2. **Autenticación y link.** `railway login` (OAuth por navegador, lo aprueba Luis; scope `workspace:admin project:admin` — el CLI no ofrece scope de solo-lectura) y `railway link` al servicio `novotechflow` en el entorno `production` (la API NestJS; los otros servicios del proyecto son `web`, `Postgres`, `api-external`, `postgres-external`).

3. **Etapa base = solo lectura.** Se habilitan tres lecturas, todas verificadas: nombres de variables, logs de deploy y logs de build. Ningún comando de escritura (`up`, `variable set`, `redeploy`) se corre en esta etapa. La barrera es disciplina; el gate técnico (deny-rules) se monta con el MCP (ver Pendientes).

4. **Regla de manejo de secretos en variables (no negociable).** Nunca se usa `--kv` ni se pega el JSON crudo de `railway variable list` (el help advierte que ambos imprimen valores crudos). Para listar, se parsea el `--json` en PowerShell extrayendo solo los nombres de las propiedades (`$obj.PSObject.Properties.Name`), envuelto en try/catch para que ni un fallo de parseo vuelque el JSON crudo. Al chat llegan solo keys, nunca valores.

5. **Regla de manejo de secretos en logs (no negociable).** Un log es texto libre y no se puede "filtrar a nombres". Se traen acotados en modo no-streaming (`-n <N>`, que desactiva el seguimiento en vivo; `railway logs` por defecto hace streaming y cuelga la sesión de agente) y se pasan por un wrapper de redacción que tapa connection strings, Bearer tokens, pares `key|token|secret|password=valor` y JWT antes de imprimir, con timeout por si `-n` no frena el streaming. `-d` para deploy/runtime, `-b` para build.

### Consecuencias

- Claude Code puede leer variables (solo keys), logs de deploy y logs de build de producción sin que Luis toque el dashboard y sin filtrar secretos al chat. Es capacidad de Claude Code corriendo el CLI, no de Claude (chat).
- El límite absoluto "solo Luis despliega" queda intacto: crear o cambiar una variable en Railway dispara un redeploy automático del servicio (confirmado en doc de Railway: no hay forma de que un deploy vivo tome variables nuevas sin un deploy nuevo), por lo que toda escritura de variables sobre un servicio de producción es, de hecho, un despliegue — reservado a Luis.
- Detalle operativo registrado: `-n` cuenta entradas de log lógicas, no renglones de texto; una corrida de `-n 100` de build devolvió 153 líneas por los bloques multilínea (Prisma Client, warnings de npm). No es un fallo del filtro.
- Observación al pasar durante la lectura de logs de deploy (no diagnosticada aquí): se ven transacciones `BEGIN`/`COMMIT` sobre `app_settings`, consistente con el doble-upsert de `getMaintenanceBanner` ya marcado como deuda.
- Las reglas 4 y 5 quedan como contrato que el MCP de Railway deberá respetar cuando se monte.

### Archivos

- Ninguno del repo. La instalación (binario en `.local\bin`), el login y el link son estado local de la máquina de Luis, fuera de versión. Este ADR es el único artefacto versionado del cambio.

### Commits

- docs: ADR-078 to ADR-081 external api to production

### Pendientes

- **Montar el MCP de Railway en Claude Code**, decidiendo el modo de cableado que respete la regla `npx`/`npm` (evaluar `railway mcp install` vía CLI vs. apuntar a un binario), y agregando deny-rules explícitas en `.claude/settings.local.json` para las tools de escritura (`variable set`, `up`, `redeploy`, `accept-deploy`), igual que el deny ya existente de `git push`. Verificar que Claude Code no pueda disparar un redeploy antes de darlo por cerrado.
- **Reglas de manejo de secretos aplicadas al MCP:** trasladar las reglas 4 y 5 de este ADR al uso del MCP (variables solo por nombre, logs redactados y acotados).
- **Habilitación de escrituras seguras (etapa futura, si se decide):** crear variables solo en entornos no-prod, o en prod con confirmación explícita de Luis (equivalente al gate del push). Fuera de alcance de este ADR.

## ADR-079 — Enriquecimiento del contrato de la API externa: marca, número de parte, formato, modelo y quick specs derivados de technicalSpecs

**Fecha:** 2026-07-08
**Estado:** Aceptado

### Contexto

La API externa de solo lectura (módulo `/external` en `apps/api`, rama `feature/external-api`) expone las propuestas GANADA para consumo de Felipe. El contrato por ítem (`ExternalItemOut` / `ExternalChildItemOut`) traía `brand` y `partNumber` leídos directamente de las columnas escalares de `ProposalItem`. Al verificar la respuesta real contra la DB local se encontró que esas columnas venían vacías (`""`), mientras el dato real —marca, número de parte, formato, modelo— vivía dentro del JSON `technicalSpecs`, bajo las claves `fabricante`, `numeroParte`, `formato`, `modelo`. El consumidor tenía que entrar al blob `technicalSpecs` (tipado `Record<string, unknown>`, sin contrato) para leer esos valores, y la "descripción rápida" (quick specs) no se exponía en absoluto: se calcula solo en `apps/web` con `buildQuickDescription`.

Regla de fondo acordada con Luis: la fuente de verdad de marca, número de parte, formato y modelo es **lo que el usuario ve en la UI de specs**, es decir `technicalSpecs`, no las columnas del `ProposalItem`. En la UI no existe un campo "Marca"; lo que el usuario captura es **Fabricante** (`technicalSpecs.fabricante`).

### Decisión

Enriquecer el contrato de la API externa tomando el dato desde `technicalSpecs`, sin introducir un paquete compartido (Opción A: cambio contenido en `apps/api/src/external`):

1. **`brand` y `partNumber`** pasan a leerse de `technicalSpecs` (`fabricante` y `numeroParte` respectivamente) vía `pickSpecString`, en lugar de las columnas del `ProposalItem`. Se rellenan los campos que Felipe ya conocía, ahora con el dato real, sin cambiar sus nombres.
2. **Campos nuevos de primer nivel**: `formato`, `modelo` (desde `technicalSpecs`), `quickSpecs` (derivado con `buildQuickDescription`) e `itemTypeLabel` (etiqueta legible del `itemType` vía `ITEM_TYPE_LABELS`, p. ej. `PCS` → `PCs`).
3. Mismo tratamiento en `ExternalChildItemOut` (sub-ítems).
4. La lógica de display (`buildQuickDescription`, `ITEM_TYPE_LABELS`, más el helper `pickSpecString`) se replica en un archivo nuevo `apps/api/src/external/external-spec-fields.ts`, adaptada al tipado `Record<string, unknown>` del backend (coerción `typeof === 'string'`, sin `any`).

Se eligió la Opción A porque desbloquea a Felipe sin cargar el merge pendiente de la rama (que ya arrastraba la colisión del hoy ADR-078); no toca estructura de paquetes.

### Consecuencias

- El consumidor externo recibe marca, número de parte, formato, modelo y quick specs como campos planos con contrato explícito, alineados con lo que el usuario ve en la UI, sin tener que parsear el blob `technicalSpecs`.
- `technicalSpecs` se sigue exponiendo crudo, por compatibilidad.
- **Deuda registrada**: `buildQuickDescription` e `ITEM_TYPE_LABELS` quedan duplicados entre `apps/web` y `apps/api`. Si el mapa `itemType → campos` o las etiquetas cambian en web, la API externa queda desincronizada en silencio. Como es lógica de display read-only, el impacto de un drift es bajo. **Follow-up**: extraer esta lógica a un paquete compartido (patrón de `@repo/pricing-engine`, ADR-052) que consuman web y api, al estabilizar/mergear la rama.

### Archivos

- `apps/api/src/external/external-spec-fields.ts` (nuevo) — `resolveItemTypeLabel`, `pickSpecString`, `buildQuickDescription`.
- `apps/api/src/external/dto/external-proposals.dto.ts` — `itemTypeLabel`, `formato`, `modelo`, `quickSpecs` en `ExternalItemOut` y `ExternalChildItemOut`.
- `apps/api/src/external/external-proposals.service.ts` — `brand`/`partNumber` desde `technicalSpecs`; campos derivados en el ítem top-level y en `mapChildOut`.

### Commits

- `ba476c3` — feat(external): expose brand, part number, format, model and quick specs from technical specs
- docs: ADR-078 to ADR-081 external api to production

### Pendientes

- **Extracción a paquete compartido** de `buildQuickDescription` / `ITEM_TYPE_LABELS` (elimina el duplicado web/api), al mergear la rama. — **Ejecutado**: el paquete es `@repo/item-display` (ADR-067); la copia local se eliminó tras el merge.
- **Renumeración del ADR-057 de esta rama** (Railway CLI) al mergear a master, por colisión con el ADR-057 de master (getMaintenanceBanner). — **Ejecutado** en el merge: 057→068→078, 059→069→079.

## ADR-080 — Contrato de la API externa por categoría: tipo, responsable y datos de contacto del proveedor

**Fecha:** 2026-07-22
**Estado:** Aceptado

### Contexto

La lista de campos que el consumidor externo necesita por ítem incluye, además de lo ya expuesto (número de parte, formato, fabricante, modelo, descripción rápida, categoría, flete, tiempo de entrega), el tipo del ítem, el responsable (en categorías de servicio) y los datos de la empresa proveedora con su contacto (nombre, teléfono, correo). Tras el merge de master (f11f074), la rama dispone del catálogo global de proveedores (ADR-062/064): `ProposalItem` referencia `SupplierCompany` y `SupplierContact` vía FKs, y teléfono/correo son atributos del contacto del catálogo, no del ítem. `tipo` y `responsable` viven como claves de `technicalSpecs`.

### Decisión

Seis campos planos nuevos en `ExternalItemOut` y `ExternalChildItemOut`: `tipo` y `responsable` (vía `pickSpecString` sobre `technicalSpecs`; `null` donde la categoría no los captura) y `supplierCompanyName`, `supplierContactName`, `supplierContactPhone`, `supplierContactEmail` (vía include de las relaciones `supplierCompany`/`supplierContact` en la query; `null` cuando el ítem no tiene proveedor asignado). Convención de nombres: inglés para lo que proviene del modelo relacional, español para claves de specs. El campo existente `proveedor` (categoría de origen en `internal_costs`) se conserva sin cambios. Mismo tratamiento en sub-ítems.

### Consecuencias

- El contrato cubre la lista completa de campos por categoría definida por Luis; el consumidor no necesita parsear `technicalSpecs` ni conocer el modelo de proveedores.
- Los campos de proveedor llegan `null` en ítems sin proveedor asignado — en particular, los de `COT-LU00002-1` (copiados antes de que existiera el catálogo en esa base).

### Archivos

- `apps/api/src/external/external-proposals.types.ts` — include de `supplierCompany`/`supplierContact` en ambos niveles.
- `apps/api/src/external/dto/external-proposals.dto.ts` — seis campos nuevos en ambas interfaces.
- `apps/api/src/external/external-proposals.service.ts` — mapeo en ítem top-level y `mapChildOut`.

### Commits

- `bf8976f` — feat(external): expose spec type, responsable and supplier contact data per item
- docs: ADR-078 to ADR-081 external api to production

### Pendientes

- **Prueba end-to-end** con data de proveedor poblada: asignar proveedor a los ítems de `COT-LU00002-1` en `postgres-external` o copiar una propuesta reciente con catálogo asignado. — **Ejecutado**: `COT-LU00003-1` clonada desde la local `COT-LMA00008-1` (6 categorías, 6/6 ítems con proveedor, catálogo de 5 empresas + 5 contactos clonado); los 4 criterios del contrato verificados contra el endpoint real.

## ADR-081 — API externa a producción: entry point aislado y rol de base de datos de mínimo privilegio

**Fecha:** 2026-08-10
**Estado:** Ejecutada — en producción desde 2026-08-11

### Contexto

La API externa para requisiciones de compra (ADR-057/059 en la rama, renumerados a 079/080) fue validada contra postgres-external y aprobada para producción. El diagnóstico previo al cutover encontró que el servicio api-external construía la misma imagen que la API principal: montaba el AppModule completo (~120 rutas, incluidas todas las de escritura), corría prisma migrate deploy en cada arranque, y la rama estaba 60 commits detrás de master (sin ADR-074, sin el enum APLAZADA/CANCELADA, Swagger sin gate).

### Decisión

1. Merge de master a la rama, con master ganando en infraestructura (Dockerfile 3 etapas, gate de Swagger, trust proxy, throttler 100). El Dockerfile de master se extendió para construir y materializar @repo/item-display y @repo/pricing-engine como directorios reales en el node_modules del runner: el node-linker hoisted deja los links de workspace en apps/api/node_modules, que no viaja a la imagen final.
2. Entry point propio para el servicio externo: ExternalAppModule + main-external.ts (mismo hardening que main.ts, sin Swagger ni estáticos). En Railway, api-external arrancará con node dist/src/main-external.js como start command, sin migrate deploy — las migraciones son exclusivas del servicio principal.
3. Extracción de AuthCoreModule y UsersCoreModule (sin controladores) para que el grafo externo no monte AuthController ni UsersController. Superficie final del proceso externo: 4 rutas /external/*. La API principal conserva su superficie exacta (verificado por diff de rutas).
4. Rol de Postgres novotech_external_ro en producción: LOGIN, CONNECTION LIMIT 12, SELECT sobre las 7 tablas del include de propuestas + verification_codes, INSERT/UPDATE solo sobre verification_codes. Sin DELETE, sin DDL, sin default privileges: una tabla nueva no es visible hasta otorgarla (fail-closed). El rol no puede correr migraciones.
5. DATABASE_URL de api-external se hardcodea con la credencial del rol (connection_limit=5, pool_timeout=20) — excepción consciente al invariante de usar la referencia de Railway, que llevaría la credencial admin. Rotación de esa contraseña = actualización manual de la variable.
6. packages/pricing-engine como paquete compartido consumido por la API es excepción consciente a CONVENTIONS §J; la fuente canónica sigue siendo el paquete (apps/web lo consume igual).

### Consecuencias

- El servicio externo contra producción expone solo el contrato: login 2FA + GET /external/proposals filtrado por userId del token, estado GANADA, deletedAt null. Cada comercial ve solo sus propuestas ganadas.
- verification_codes es tabla compartida: un login externo invalida los códigos 2FA vivos del mismo usuario en la app principal (updateMany de sendVerificationCode). Preexistente, aceptado.
- Los JWT de ambos servicios no son intercambiables (EXTERNAL_JWT_SECRET y JWT_SECRET distintos entre sí y distintos por servicio).
- Un merge futuro de esta rama ya no rompe el deploy principal: el Dockerfile construye los paquetes @repo que apps/api ahora consume.

### Archivos

- apps/api/Dockerfile (3 etapas + materialización @repo)
- apps/api/src/external-app.module.ts, apps/api/src/main-external.ts (nuevos)
- apps/api/src/auth/auth-core.module.ts, apps/api/src/users/users-core.module.ts (nuevos)
- apps/api/src/auth/auth.module.ts, apps/api/src/users/users.module.ts, apps/api/src/external/external.module.ts, apps/api/src/app.module.ts
- .dockerignore

### Commits

- 0a42cf5 merge: master into feature/external-api
- 2207bf4 fix(docker): materialize repo packages in runner node_modules
- 0127893 feat(external): separate entry point for external api service
- b56f5a7 refactor(auth): extract controller-free core modules for external entry point

### Pendientes

- Ejecutado: start command node dist/src/main-external.js y rama master en api-external (vía Railway GraphQL).
- Ejecutado: variables DATABASE_URL (rol novotech_external_ro, connection_limit=5, pool_timeout=20), EXTERNAL_JWT_SECRET y JWT_SECRET rotados.
- Ejecutado: smoke test contra producción — validado por consumidor real (login 2FA + GET /external/proposals con datos reales; nulls reportados eran datos sin diligenciar, corregidos en la app).
- Ejecutado: postgres-external eliminada (2026-08-11) — integración entregada y validada contra producción; sin cambios de contrato previstos. Respaldo final en D:\backups\postgres-external-final-2026-08-11.dump (pg_dump -Fc, requiere pg_restore 18+).
- Auditar pool: medir conexiones del rol bajo carga real (CONNECTION LIMIT 12 vs pool 5).

## ADR-082 — Recuperación de espacio del volumen de Postgres en Railway (wipe + restore) y habilitación de PITR

**Fecha:** 2026-08-11
**Estado:** Implementado

### Contexto

Los backups diarios del volumen de Postgres en Railway pesaban 15.57 GB para una base cuyos datos reales suman ~1.1 GB. Diagnóstico (solo lectura, vía psql, funciones de superusuario y railway ssh): pg_database_size = 1101 MB; el 97% del peso vivo está en proposal_page_blocks (1069 MB, ~2900 filas, casi todo TOAST: imágenes base64); WAL 64 MB, sin replication slots, lost+found vacío, df dentro del contenedor reportando 1.2 GB usados de 220 GB. La métrica DISK_USAGE_GB de Railway marcaba 15.96 GB: asignación muerta en la capa de bloques ZFS (el volumen es un zvol) acumulada desde abril, que ext4 ya había liberado pero ZFS no desasignó. fstrim desde dentro del contenedor falla con "FITRIM ioctl failed: Operation not permitted" (el contenedor no tiene la capability necesaria).

### Decisión

Recuperar el espacio con el mecanismo formal del dashboard de Railway: pg_dump verificado → Wipe Volume → restore, en ventana sin usuarios. Se descartó el ticket a soporte (más lento) y la migración a un servicio Postgres nuevo (obligaba a reapuntar DATABASE_URL en tres servicios). El wipe conserva el mismo servicio y sus variables, por lo que la referencia ${{Postgres.DATABASE_URL}} y la credencial del rol externo no cambian. En la misma ventana se actualizó la imagen del servicio de ghcr.io/railwayapp-templates/postgres-ssl:18.4 al tag mayor :18 y se habilitó PITR (archivado continuo de WAL vía pgBackRest), manteniendo además los volume backups diarios como segunda capa.

### Consecuencias

- Restore limpio: pg_restore exit 0 sin errores (375 s), base en 1091 MB, conteos verificados (users y spec_options exactos contra referencia), rol novotech_external_ro recreado con su misma contraseña y sus 10 grants intactos.
- El wipe borra también los backups de Railway del servicio: durante la operación la única copia fue el dump local verificado (D:\novotechflow-backups, formato custom, 780 MB, pg_restore --list con 142 entradas TOC).
- El valor asentado esperado de DISK_USAGE_GB es ~6 GB, no ~1.2: Railway cuenta la metadata de ext4 (2–3% de los 220 GB del volumen). La ganancia real es de ~10 GB por backup.
- Redeploy del servicio api tras el restore para renovar el pool de conexiones de Prisma.
- La imagen con tag mayor :18 sigue los rebuilds de Railway y los fixes de pgBackRest automáticamente; ya no está congelada en 18.4.
- Procedimiento repetible documentado: dump -Fc con imagen postgres:18-alpine (pg_dump ≥ versión del servidor) + pg_dumpall --roles-only, verificación con pg_restore --list y tamaño plausible, wipe, roles primero, restore, verificación de conteos y grants.

### Archivos

Ninguno en el repo. Dumps en D:\novotechflow-backups (fuera del repo).

### Commits

- docs: ADR-082 railway postgres volume wipe restore and pitr

### Pendientes

- Verificar que el backup diario nocturno bajó a ~6 GB y que PITR está archivando (pestaña Backups).
- El peso vivo real y creciente sigue siendo proposal_page_blocks (imágenes base64): la deduplicación por hash (Cohorte 2 del fix de incidentes) es el fix estructural y sigue pendiente tras feature/wysiwyg-pages.

## ADR-083 — Deduplicación de imágenes base64 en tabla de assets (Cohorte 2)

**Fecha:** 2026-08-12
**Estado:** Aceptado

### Contexto

ADR-070 diagnosticó que el peso de la base vivía en imágenes base64 duplicadas dentro de `proposal_page_blocks.content`; ADR-082 lo midió en producción (~1069 MB de tabla). La auditoría de datos sobre `novotechflow_prod_copy` (2026-08-12) lo precisó: 609 data URIs en tres tablas (`proposal_page_blocks` 599, `pdf_templates` 1, `users.signature_url` 9) que reducen a solo 50 imágenes únicas — 98.32% de bytes duplicados. Un solo JPEG de 2.48 MB (bloque IMAGE de la plantilla "PROPUESTA DE VALOR", no la portada como se creyó inicialmente) aparecía 288 veces (714 MB, 85% del problema). El mecanismo de amplificación: `initializeDefaultPages` copia los bloques de plantilla a cada propuesta nueva y `cloneProposal` los re-copia verbatim en cada versión. Los data URIs entran a la DB por los PATCH de bloques y plantillas (los uploads de bloques son stateless: devuelven el data URI y el frontend lo re-envía) y por `updateSignature`. RICH_TEXT verificado limpio (TipTap sin extensión Image). Además se invirtió el orden registrado en ADR-070: la Cohorte 2 se ejecutó antes del aterrizaje de `feature/wysiwyg-pages`, porque esa rama aún tiene trabajo grande de UI pendiente y el editor nuevo conviene construirlo sobre el modelo final de assets; su migración (`isSectionModel`, `parentPageId`) se regenerará con timestamp nuevo durante su rebase (el drift de esas columnas en la base local de desarrollo proviene de esa rama y se reconcilia ahí).

### Decisión

Tabla global `image_assets` en Postgres (se mantiene la regla de no usar storage externo): `sha256` único (hash sobre los bytes decodificados), `mime_type`, `size_bytes`, `data` con SOLO el payload base64 sin prefijo. Deshidratación en los sumideros de persistencia — `pages.service` (createBlock/updateBlock), `templates.service` (addBlock/updateBlock/updateBlockImage), `users.service` (updateSignature con `signature_asset_id` y precedencia asset-primero en lectura) — vía `ImageAssetsService` (`ingestDataUri`/`dehydrateImageContent`): el content persiste `{ assetId }` sin base64, de forma idempotente ante re-envíos del frontend. Rehidratación en los read paths (`getPagesByProposalId`, lecturas de templates, `findAll`/`updateUser` de users, `getProposalById` para la firma del PDF) con `rehydrateMany` en lote (sin N+1): el frontend recibe `content.url` como siempre y no se tocó ni una línea de `apps/web`. `initializeDefaultPages` y `cloneProposal` quedan intactos: copian content crudo, que ahora es una referencia de ~50 caracteres — la duplicación muere en el origen. Compat legacy expand-contract: los data URIs preexistentes se sirven tal cual hasta el backfill. Backfill idempotente en `apps/api/scripts/backfill-image-assets.ts` (mismos criterios de hash que el servicio, compare-and-swap por fila contra escrituras concurrentes, manejo de carrera P2002, verificación integrada), a ejecutar con la API detenida, seguido de `VACUUM FULL proposal_page_blocks`. La API externa no se ve afectada: no expone páginas, bloques ni firmas, y el rol `novotech_external_ro` es fail-closed — `image_assets` NO se le otorga.

### Consecuencias

Ensayo completo contra `novotechflow_prod_copy`: 599+1+9 filas migradas y 50 assets únicos (coincidencia exacta con la auditoría), segunda corrida en 0 cambios (idempotencia), y base de 895 MB → 41 MB (−95.4%) tras `VACUUM FULL`; `proposal_page_blocks` de 869 MB → 3.6 MB. Clones y versiones nuevas dejan de duplicar bytes. El desperdicio de ~750 KB/request en `api-external` (el guard selecciona `signatureUrl`) desaparece de facto al quedar la columna nula tras el backfill. El despliegue a producción aplicará una sola migración pendiente: `add_image_assets` (`add_proposal_status_aplazada_cancelada` ya estaba aplicada en producción desde 2026-07-23; la copia local del ensayo era un snapshot anterior a esa fecha y la reportaba pendiente).

### Archivos

- `apps/api/prisma/schema.prisma` + migración `20260812131418_add_image_assets`
- `apps/api/src/image-assets/image-assets.service.ts`, `image-assets.module.ts` (nuevo módulo, importado por Proposals/Templates/UsersCore)
- `apps/api/src/proposals/pages.service.ts`, `apps/api/src/proposals/proposals.service.ts`
- `apps/api/src/templates/templates.service.ts`
- `apps/api/src/users/users.service.ts`, `users.service.spec.ts`
- `apps/api/scripts/backfill-image-assets.ts`

### Commits

- `a1d5666` feat(api): add image_assets table and users.signature_asset_id
- `ab910a7` feat(api): image assets service with sha256 dedup
- `33b4720` feat(api): dehydrate image data URIs to assets on write
- `949188b` feat(api): rehydrate image assets on read paths
- `8dcea4a` feat(api): idempotent backfill script for image assets

### Pendientes

- GC de assets huérfanos en `image_assets` (riesgo bajo: la tabla completa pesa ~15 MB).
- Sacar `signatureUrl` del select de `findOneById` (lo usan los guards de `api-external`; desperdicio preexistente, inofensivo tras el backfill).
- Validar la forma de `content` en los PATCH de bloques y plantillas (hoy aceptan objeto arbitrario).
- `sanitizeRichText` no corre con TipTap JSON (solo aplica si `content.html` es string); inofensivo hoy — sin extensión Image no entra base64 por RICH_TEXT — pero si se agrega `@tiptap/extension-image` habrá que revisarlo.
- Tests reales del ciclo dehydrate→rehydrate (los specs actuales son smoke).
- Verificar los grants vivos de `novotech_external_ro` contra `information_schema.role_table_grants` (hoy solo documentados en prosa, ADR-081).
- `novotechflow_prod_copy` quedó migrada y compactada por el ensayo; restaurar del dump de `D:\novotechflow-backups` si se necesita re-ensayar.

## ADR-084 — Ejecución en producción del backfill de assets (ADR-083) y resultados

**Fecha:** 2026-08-12
**Estado:** Aceptado

### Contexto

ADR-083 dejó el código desplegado en modo compat y el backfill ensayado contra `novotechflow_prod_copy`. Esta entrada registra la ejecución real contra producción y sus resultados, más un incidente operativo del cierre de la ventana.

### Decisión

Ventana de mantenimiento con el api detenido (`railway down`; api-external permaneció arriba: solo lectura vía rol fail-closed, verificado inocuo con `concurrentes=0`). Secuencia ejecutada: `pg_dump` pre-migración (787.4 MB, TOC verificado) → push y deploy (migración `add_image_assets` aplicada sola y limpia; `add_proposal_status_aplazada_cancelada` ya estaba en producción desde julio, la copia del ensayo era anterior) → backfill → verificación → `VACUUM FULL` + `ANALYZE` → redeploy y smoke.

### Consecuencias

Backfill en 17.7 min por el proxy público: 707 bloques + 1 template + 9 firmas migrados, 66 assets únicos (717 ocurrencias = 66 + 651 reutilizaciones), 0 malformados, 0 concurrentes, 0 data URIs restantes (verificado además por SQL independiente). Idempotencia confirmada (segunda corrida: 0 cambios, 11.9 s vs 1061.6 s). `VACUUM FULL` en 2.6 s — corre server-side, el proxy solo transporta el comando, y la reescritura solo copia tuplas vivas (~4.6 MB tras el backfill). Tamaños: `proposal_page_blocks` 1077 MB → 4.6 MB (−99.6%); base `railway` 1104 MB → 45 MB (−96%). Producción tenía 108 bloques y 16 imágenes únicas más que el snapshot de julio del ensayo, coherente con la actividad del período. Smoke en producción OK: imágenes viejas rehidratadas, firma en PDF, propuesta nueva con plantillas, upload nuevo.

Incidente del cierre: `railway redeploy` por CLI relanzó una entrada histórica de mayo (`29f4315`) en vez del deployment vigente; su Dockerfile traía un `COPY uploads/defaults` que ya no existe y el build falló sin llegar a arrancar contenedor (sin impacto en datos). Lección operativa: para revivir el servicio tras una ventana, desplegar siempre desde el HEAD actual de master (commit vacío + push, o Redeploy sobre el deployment del commit vigente), nunca `redeploy` a ciegas ni sobre entradas históricas del listado.

Durante la ventana quedó demostrada la señal de parada aceptable: deployments en REMOVED + HTTP no-200 + `pg_stat_activity` sin conexiones vivas del api (una conexión `idle` congelada con `backend_start` anterior al deployment tumbado es un socket huérfano de api-external, no un proceso que escriba).

### Archivos

- Sin cambios de código (ejecución operativa de ADR-083).
- Dump pre-migración: `D:\novotechflow-backups\novotechflow_prod_pre_adr083_2026-08-12.dump`.

### Commits

- `bad69c9` chore: trigger redeploy after maintenance window

### Pendientes

- Verificar que el schedule de backups del volumen de Railway siga activo (el wipe de ADR-082 lo borró y se reprogramó; confirmar tras esta jornada) y tomar un `pg_dump` post-migración fresco (debería pesar decenas de MB).
- `novotechflow_prod_copy` quedó con el estado del ensayo; para futuros ensayos, restaurar desde un dump post-migración.
- Los pendientes técnicos de ADR-083 (GC de assets, select de findOneById, validación de content en PATCH, tests del ciclo) siguen vigentes.

## ADR-085 — Migración a Turborepo 2 y pin de eslint-plugin-react-hooks

**Fecha:** 2026-08-12
**Estado:** Aceptado

### Contexto

La auditoría de actualización de entornos (agosto 2026) dejó el monorepo al día en patches y minors dentro de los majors declarados, y encontró Turborepo rezagado en v1 (1.13.4 frente a 2.10.9), pendiente P2 conocido. La verificación previa a la migración reveló que la única variable de entorno de build es VITE_API_URL, consumida por web#build en cinco archivos de apps/web/src, y que ambos Dockerfiles esquivan turbo por completo: ejecutan pnpm build directo en cada app (nest build / tsc -b && vite build), por lo que Railway nunca pasa por turbo ni por el lint de CI. Turbo 2 activa strict env mode por defecto: las variables no declaradas en turbo.json se filtran en silencio durante el build. Por otra parte, el batch de minors bumpeó eslint-plugin-react-hooks 7.0.1 → 7.1.1, cuyas reglas nuevas (react-hooks/set-state-in-effect, react-hooks/immutability) destaparon 19 errores preexistentes en apps/web y dejaron rojo el gate de lint de CI en el primer push que los ejercitó.

### Decisión

Migrar a Turborepo 2.10.9 renombrando pipeline → tasks en turbo.json y declarando env: ["VITE_API_URL"] en la task build, en lugar de restaurar el comportamiento laxo con envMode: loose. Declarar la variable desarma la trampa del strict mode (si mañana Docker, Railway o CI construyen vía turbo, la variable pasa) y conserva el hashing correcto de caché: con loose, la caché podría reutilizar un build horneado con otra VITE_API_URL. Para el gate de lint, pinnear eslint-plugin-react-hooks en 7.0.1 exacto (sin caret, porque ^7.0.1 es satisfecho por 7.1.1 y no revierte la resolución) en vez de corregir los 19 errores en caliente: las reglas nuevas señalan patrones cuyo arreglo cambia comportamiento en runtime (timing de fetches, sincronización de props a estado), y eso se planifica como refactor propio, no como fix de lint mecánico.

### Consecuencias

El pendiente P2 de Turborepo queda saldado y turbo.json ya no valida en falso contra el $schema de v2. La task build declara sus outputs reales (dist/**, corregido en la misma tanda desde el residuo .next/ del starter) y su variable de entorno, así que la caché de Turbo guarda artefactos y los invalida correctamente. CI volvió a verde de punta a punta (lint, typecheck, tests, build y docker build) con el pin. El pin es deuda explícita: retomar eslint-plugin-react-hooks 7.1.x exige resolver antes los 19 errores, y conviene hacerlo junto con o antes del salto a ESLint 10. Queda confirmado operativamente que Railway despliega directo del push sin esperar a CI, y que su build no ejercita ni turbo ni eslint.

### Archivos

- turbo.json — pipeline → tasks, env: ["VITE_API_URL"] en build (outputs a dist/** corregido en commit previo de la tanda)
- package.json — turbo ^1.13.4 → ^2.10.9
- apps/web/package.json — eslint-plugin-react-hooks pinneado a 7.0.1 exacto
- pnpm-lock.yaml — resoluciones correspondientes

### Commits

- `df8637c` chore: migrate turborepo to v2
- `17d6752` chore(deps): pin eslint-plugin-react-hooks to 7.0.1 pending hooks refactor

### Pendientes

- Refactor de los 19 errores de react-hooks 7.1.x en apps/web, agrupados por riesgo: (1) 3 casos en useDashboard.ts de funciones referenciadas antes de declararse — solo reordenar, riesgo mínimo; (2) 16 casos de setState síncrono dentro de useEffect — 10 son fetch-al-montar (mecánicos pero cambian timing) y 6 son sincronización de props a estado local en modales/combobox (decisión por caso: key, estado derivado o rediseño). Prerrequisito para despinnear eslint-plugin-react-hooks y para el salto a ESLint 10 (Cohorte D).
- Cohorte D restante: ESLint 10 + globals 17 + @eslint/js 10, Jest 30, @vitejs/plugin-react 6 + Vite 8, TypeScript 7 (pin sincronizado en los 5 workspaces).
- Cohortes E (Tailwind 3→4) y F (Prisma 5.10.2→7, escalonado 5→6→7 con ensayo contra novotechflow_prod_copy) en pausa hasta que feature/wysiwyg-pages llegue a master.
- Chunks de Vite >500 kB (RichTextEditor, FileSaver) — lazy loading, pendiente arrastrado.

## ADR-086 — Cierre de los errores de react-hooks 7.1.1: camino híbrido (fix real + supresiones documentadas)

**Fecha:** 2026-08-13
**Estado:** Aceptado

### Contexto
ADR-085 dejó eslint-plugin-react-hooks pinneado en 7.0.1 con 19 errores pendientes de las reglas nuevas de 7.1.1 (react-hooks/set-state-in-effect y react-hooks/immutability). El diagnóstico previo al refactor corrigió el plan registrado: eran 17 archivos (no 13), la regla reporta un solo error por useEffect aunque el cuerpo tenga varios setState (superficie real ~35 llamadas), no existe versión intermedia entre 7.0.1 y 7.1.1 que alivie, y el grupo "solo reordenar" de useDashboard.ts destaparía un error nuevo de set-state-in-effect al cerrarse los tres de immutability — cosa que ocurrió tal como se anticipó. Se evaluaron tres caminos: adoptar 7.1.1 con las reglas apagadas globalmente, refactor completo de los 19, o un híbrido.

### Decisión
Camino híbrido en tres commits. (1) Fix real de los cuatro casos de sincronización props→estado: los tres modales (SpecOptionFormModal, PrefillModal, NewSupplierModal) pasaron a montaje condicional en su padre — el remontaje con useState inicializado correctamente reemplaza los effects de reset, y SpecOptionFormModal remonta con key={editingOption?.id ?? 'new'} —, y CityCombobox pasó al patrón de estado derivado con comparación en render (prevValue). La prop isOpen se eliminó por completo de los tres modales. (2) Supresiones documentadas para lo que es patrón legítimo del proyecto: 11 sitios de fetch-al-montar (los 10 originales más el destapado en useDashboard.ts tras reordenar sus declaraciones arriba del effect, que cerró los 3 de immutability de verdad) con eslint-disable-next-line comentado como pendiente de rediseño de data-fetching, y 2 casos con patrón propio explicado en el comentario (validador con debounce en NewProposal.tsx, latch con guarda useRef en ProposalDocBuilder.tsx). La regla queda activa para código nuevo. (3) Despin a ^7.1.1, con lint en cero errores y cero warnings como prueba de cierre.

### Consecuencias
El pendiente principal de ADR-085 queda saldado y el salto a ESLint 10 (Cohorte D) deja de estar bloqueado por react-hooks. Las dos reglas nuevas vigilan el código nuevo; los 13 disables son localizables con grep para el día del rediseño de data-fetching (adopción de una librería o patrón de suscripción, decisión aparte). Cambios de comportamiento en runtime acotados al commit 1: los tres modales se desmontan al cerrar (nada persistía entre aperturas — sus effects eran reset-al-abrir), y la animación de salida de SpecOptionFormModal ahora corre (el AnimatePresence del padre por fin surte efecto). Smoke test de los cuatro flujos de UI realizado por Luis en local, en verde. Nota operativa: los tres modales ya no aceptan la prop isOpen; cualquier consumidor nuevo debe montarlos condicionalmente.

### Archivos
- apps/web/src/pages/admin/components/SpecOptionFormModal.tsx, apps/web/src/pages/admin/SpecOptionsAdmin.tsx — remontaje con key, sin isOpen ni effect de reset
- apps/web/src/pages/proposals/components/PrefillModal.tsx, apps/web/src/pages/proposals/ProposalItemsBuilder.tsx — montaje condicional bajo AnimatePresence del padre
- apps/web/src/pages/proposals/components/NewSupplierModal.tsx, apps/web/src/pages/proposals/components/SupplierSection.tsx — montaje condicional
- apps/web/src/pages/proposals/components/CityCombobox.tsx — estado derivado con comparación en render
- apps/web/src/hooks/useDashboard.ts — declaraciones movidas arriba del effect (cierra immutability)
- 13 sitios con eslint-disable documentado: hooks/useActiveUsers.ts, hooks/useDashboard.ts, hooks/useMaintenanceBanner.ts, hooks/usePriceThresholds.ts, hooks/useProposalBuilder.ts, hooks/useProposalScenarios.ts, hooks/useScenarios.ts, hooks/useSpecOptionsAdmin.ts, hooks/useSupplierFieldRequirements.ts, hooks/useSuppliers.ts, pages/Users.tsx, pages/proposals/NewProposal.tsx, pages/proposals/ProposalDocBuilder.tsx
- apps/web/package.json, pnpm-lock.yaml — despin a ^7.1.1

### Commits
- `13d6a5a` refactor(web): replace prop-sync effects with remount and derived state patterns
- `3e0bc3c` chore(web): document set-state-in-effect suppressions pending data-fetching redesign
- `7889856` chore(deps): unpin eslint-plugin-react-hooks to 7.1.1

### Pendientes
- Rediseño de data-fetching para eliminar los 11 disables de fetch-al-montar (librería de data-fetching o patrón de suscripción) — decisión de arquitectura aparte, sin urgencia.
- Cohorte D restante (de ADR-085): ESLint 10 + globals 17 + @eslint/js 10 (ya desbloqueado), Jest 30, @vitejs/plugin-react 6 + Vite 8, TypeScript 7.
- Cohortes E (Tailwind 3→4) y F (Prisma 5.10.2→7) en pausa hasta que feature/wysiwyg-pages llegue a master.
- Chunks de Vite >500 kB (RichTextEditor, FileSaver) — lazy loading, pendiente arrastrado.

## ADR-087 — Migración a ESLint 10 (@eslint/js 10, globals 17, react-refresh 0.5)

**Fecha:** 2026-08-13
**Estado:** Aceptado

### Contexto

Primer bloque restante de la Cohorte D (ADR-085/086). ESLint 9.39.5 pasó a rama maintenance; 10.x es latest desde 2026-02 (10.8.1 al momento del salto). Diagnóstico previo contra registry y disco: todos los peers instalados (typescript-eslint 8.67.0, react-hooks 7.1.1, prettier plugins) admiten ^10; ambas configs ya son flat con los helpers canónicos (defineConfig/globalIgnores en web, tseslint.config() en api); Node local (22.22.2) y CI (22.x) cumplen el mínimo ^20.19 || ^22.13 || >=24; sin comentarios eslint-env ni reglas afectadas por los breaking changes. Único plugin no probado contra 10 era eslint-plugin-react-refresh 0.4.26 (compatible solo por rango abierto >=8.40); el soporte explícito llegó en la línea 0.5.x, que es breaking del plugin (ESM-only, configs como funciones invocables, customHOCs → extraHOCs).

### Decisión

Saltar en un solo bloque: eslint ^10.8.1 en ambas apps, @eslint/js ^10.0.1 solo en web (api no lo declara y en eslint 10 ya no llega ni transitivamente — dejó de ser dependencia interna del core), globals ^17.11.0 en ambas, y eslint-plugin-react-refresh ^0.5.4 en web para no dejar el único plugin sin soporte probado dentro del stack. Adaptación mínima del config de web al patrón documentado en 0.5: import named `{ reactRefresh }` y config invocado `reactRefresh.configs.vite()` (2 líneas). La opción customHOCs no se usa en el repo — nada que renombrar. Alineación de `engines.node` raíz a `>=22.13.0`, el mínimo real de eslint 10 en la serie 22.

### Consecuencias

- Lint en cero en ambas apps tras el salto: las 3 reglas nuevas de recommended en @eslint/js 10 (no-unassigned-vars, no-useless-assignment, preserve-caught-error) no dispararon ningún hallazgo.
- Cero warnings de peers en el install; lockfile 116+/141−.
- api queda sin @eslint/js en su árbol (solo tseslint.configs.recommended, que no lo requiere).
- El config lookup from-file (nuevo default de v10) no afecta: no existe eslint.config.* en la raíz; cada app resuelve el suyo.

### Archivos

- `apps/web/package.json` — eslint, @eslint/js, globals, eslint-plugin-react-refresh
- `apps/api/package.json` — eslint, globals
- `package.json` — engines.node >=22.13.0
- `apps/web/eslint.config.js` — patrón react-refresh 0.5
- `pnpm-lock.yaml`

### Commits

- `44d9745` — chore(deps): eslint 10.8.1 + @eslint/js 10 + globals 17 + react-refresh 0.5.4

### Pendientes

- Cohorte D restante, en orden: Jest 30; Vite 8 + @vitejs/plugin-react 6; TypeScript 7 (pin exacto sincronizado en 5 workspaces — ojo: peer de typescript-eslint 8.67.0 es <6.1.0, requiere verificar soporte antes de saltar).

## ADR-088 — Migración a Jest 30 y fix de la cadena ESM de htmlparser2 en Jest

**Fecha:** 2026-08-13
**Estado:** Aceptado

### Contexto

Segundo bloque de la Cohorte D restante (ADR-087). Diagnóstico previo: exposición casi nula a los breaking changes de Jest 30 (7 specs triviales sin fake timers, mocks, snapshots ni alias eliminados; config sin opciones tocadas; Node 22 uniforme; TS 6.0.2 > mínimo 5.4; ts-jest 29.4.12 ya con peer dual ^29 || ^30 — no existe ts-jest 30). Único paquete que obligaba a subir: @types/jest, que en 30 arrastra expect@30 y debe ir en el mismo commit que jest para no duplicar expect en el árbol.

Al establecer el baseline e2e apareció un fallo preexistente e independiente del bump: el commit 63c976e (2026-08-12, chore de patches/minors) subió sanitize-html 2.17.2 → 2.17.6, cuyo htmlparser2 transitivo saltó de v10 (dual) a v12 (ESM puro). El require('sanitize-html') de common/sanitize.ts rompe en el runtime de Jest con SyntaxError: Cannot use import statement outside a module. Producción no está afectada: Node ≥22.12 implementa require(esm) nativo (verificado empíricamente); el fallo es exclusivo de jest-runtime, que solo soporta require(esm) en Node ≥24.9 — el bump a Jest 30 no lo curaba. Pasó inadvertido porque CI no ejecuta el e2e.

### Decisión

Desacoplar: primero el fix del e2e, luego el bump con baseline verde. Fix vía transformIgnorePatterns en vez de pinear sanitize-html (congelar un paquete de seguridad XSS para complacer a Jest es el trade-off equivocado; htmlparser2 v12+ es ESM permanente). El cierre ESM completo son 6 paquetes: htmlparser2, domelementtype, domhandler, domutils, dom-serializer, entities — todos type module sin build CJS, sin import.meta. Patrón único anclado a node_modules/.pnpm/ con clases [\\/] (Windows/Linux); la forma clásica de dos patrones se descartó porque el segmento node_modules interno de las rutas pnpm anula la excepción. Pieza imprescindible: allowJs: true como override inline en las opciones de ts-jest (el tsconfig no lo declara y sin él ts-jest no transforma los .js). El fix se replicó simétrico en el bloque jest unit de package.json — cualquier spec futuro que importe la cadena de sanitize reproduciría el mismo error críptico.

Bump: jest ^30.4.2 + @types/jest ^30.0.0 en el mismo commit; ts-jest intacto en ^29.4.12.

### Consecuencias

- Unit 6/6, e2e 1/1 y tsc en cero en Jest 30; una sola copia de expect (30.4.1) compartida entre runtime y tipos; cero warnings de peers.
- Las dos configs de Jest quedan simétricas frente a cadenas ESM-only; agregar un paquete al patrón es una edición puntual.
- Lección: un chore(deps) de solo patches puede cambiar el sistema de módulos de una dependencia transitiva. La rotura entró por el lockfile sin tocar ningún package.json y ninguna puerta la detectó.

### Archivos

- `apps/api/test/jest-e2e.json` — transformIgnorePatterns + allowJs
- `apps/api/package.json` — bloque jest unit simétrico; jest y @types/jest a 30
- `pnpm-lock.yaml`

### Commits

- `0177bad` — fix(api): transform htmlparser2 esm chain in jest e2e config
- `9386a03` — fix(api): mirror esm transform config in unit jest block
- `2af1ac9` — chore(deps): jest 30.4.2 + @types/jest 30

### Pendientes

- E2e sin gate en CI: ci.yml y pr-check.yml corren solo unit; una regresión del e2e no se detecta automáticamente.
- El spec e2e no hace app.close(): el pool de Prisma queda abierto y Jest avisa "did not exit" — afterAll pendiente.
- packages/pricing-engine (fuente de verdad de cálculo) no tiene suite de tests propia; los 6 unit specs de api solo verifican toBeDefined().
- Cohorte D restante, en orden: Vite 8 + @vitejs/plugin-react 6; TypeScript 7 (verificar antes el peer de typescript-eslint, hoy <6.1.0).

## ADR-089 — Migración a Vite 8 (Rolldown) y @vitejs/plugin-react 6

**Fecha:** 2026-08-13
**Estado:** Aceptado

### Contexto

Tercer bloque de la Cohorte D restante (ADR-087/088). Vite 8 reemplaza Rollup+esbuild por Rolldown/Oxc y Lightning CSS. Diagnóstico previo: Node sin cambio de mínimo (20.19+/22.12+, cumplido en local/CI/Docker), pipeline CSS (Tailwind 3 vía PostCSS) sin conflicto de peers, import.meta.env sin cambios (5 usos de VITE_API_URL, prefijo correcto), y un único hit directo del config: build.commonjsOptions, opción eliminada en 8 — existía por los paquetes workspace CJS @repo/pricing-engine y @repo/item-display (ADR-052), y como tsc -b typechequea vite.config.ts (tsconfig.node.json), el build rompería en compile-time. Superficie de riesgo real: el cambio de interop de default imports CJS de Rolldown, justo sobre el pricing-engine.

### Decisión

Salto conjunto: vite ^8.2.1 + @vitejs/plugin-react ^6.0.5. El plugin en 6.x es la versión nativa del pipeline Oxc (elimina Babel y la opción babel, que el repo no usa); quedarse en 5.2.0 —compatible solo por rango— habría repetido el patrón evitado con react-refresh en ADR-087. Se elimina build.commonjsOptions del config (Rolldown maneja CJS nativo); optimizeDeps.include se mantiene. Sin workarounds: no se activó legacy.inconsistentCjsInterop.

### Consecuencias

- Build 21.24 s → 5.48 s (~4×), 2573 módulos (vs 2652), chunks comparables o menores (index 480→405 kB); Rolldown reparte distinto (el chunk grande de tiptap pasa de llamarse RichTextEditor a PdfPreviewModal, mismo ~1 MB). Cero errores ni menciones de interop sobre los paquetes workspace.
- tsc en cero (app y el tsc -b del build); verificación en navegador de Luis (CONVENTIONS §H): login, totales de escenarios contra pricing-engine, exportación a Excel y preview de PDF — todo correcto.
- rollup desaparece del árbol de web; esbuild@0.28.2 permanece solo como peer opcional de vite que pnpm auto-instala, sin ejecutarse.
- El warning de chunks >500 kB persiste y ahora sugiere build.rolldownOptions.output.codeSplitting — el pendiente de lazy loading (deploy 410db2f) cambia de vocabulario de Rollup a Rolldown.
- Aviso informativo nuevo PLUGIN_TIMINGS: 64% del build en vite:css transform (Tailwind 3 vía PostCSS) — irrelevante con 5.48 s totales; se resolvería solo con Cohorte E (Tailwind 4), hoy en pausa.

### Archivos

- `apps/web/package.json` — vite y @vitejs/plugin-react
- `apps/web/vite.config.ts` — eliminación de build.commonjsOptions
- `pnpm-lock.yaml`

### Commits

- `1f048dd` — chore(deps): vite 8.2.1 + @vitejs/plugin-react 6.0.5

### Pendientes

- Cohorte D restante: TypeScript 7 — bloqueado por el peer de typescript-eslint (<6.1.0 hoy); verificar soporte antes de diseñar el salto.
- Lazy loading de chunks grandes (tiptap/FileSaver), ahora en términos de Rolldown.

## ADR-090 — TypeScript 7 pospuesto: sin API programática hasta 7.1; Cohorte D cerrada

**Fecha:** 2026-08-13
**Estado:** Aceptado (posponer)

### Contexto

Último bloque de la Cohorte D (ADR-085 a 089). TypeScript 7.0.2 (GA 2026-07-08) es el compilador nativo en Go (tsgo/Corsa): el CLI sobrevive (tsc, --watch, -b, --noEmit funcionan — los dos gates del repo serían compatibles como comandos), pero 7.0 no incluye API programática; Microsoft la promete con 7.1, "al menos varios meses después", y será una API nueva. Diagnóstico contra registry y disco: el pin 6.0.2 está sincronizado en los 5 workspaces con una sola versión resuelta (la 5.9.3 anidada de @nestjs/cli es solo fallback — su TypeScriptBinaryLoader resuelve desde process.cwd(), así que nest build usa la del workspace).

### Decisión

Posponer el salto. Tres bloqueadores duros sin salida publicada, todos por la misma causa (la API inexistente):

- typescript-eslint 8.67.0: peer >=4.8.4 <6.1.0, sin 9.x ni canary que lo amplíe; soporte de TS 7 cerrado como not-planned (issue #12521). Bloquea el lint de ambas apps.
- ts-jest 29.4.12: peer >=4.3 <7. Bloquea los tests del api.
- @nestjs/cli 11.0.24: nest build/start llaman createProgram()/emit() de la API — fallan con typescript@7 (nest-cli #3479); sin builder tsgo ni timeline (nest #15620).
- ts-node y ts-loader pasan por semver pero usan la misma API: rotos en runtime bajo 7.0.

Quedarse en 6.0.2 no es deuda urgente: es exactamente la línea que Microsoft mantiene como @typescript/typescript6 (binario tsc6, instalable como alias para convivencia 6/7).

### Consecuencias

- La Cohorte D queda cerrada en lo ejecutable: ESLint 10 (ADR-087), Jest 30 (ADR-088), Vite 8 (ADR-089); TS 7 pospuesto con este ADR. Baseline verde con 6.0.2 en ambos gates.
- Cuando se retome, el trabajo real estará en apps/api/tsconfig.json: moduleResolution implícita (node10, eliminada en 7 — habría que declarar explícita), esModuleInterop forzado a true (hoy efectivamente false — cambia emit y chequeo de imports CJS), y endurecimientos que aplican aun con strict flags apagados. Web ya está prácticamente lista (bundler, strict, verbatimModuleSyntax).
- Señales de re-evaluación: TS 7.1 publicada con API; typescript-eslint con peer ampliado o major nueva; ts-jest con peer >=7; nest-cli #3479 resuelto o builder tsgo disponible.

### Archivos

- Ninguno — diagnóstico sin cambios en el repo.

### Commits

- Ninguno de código; solo este ADR.

### Pendientes

- Re-evaluar TS 7 cuando aparezcan las señales listadas.
- Cohortes E (Tailwind 3→4) y F (Prisma 5.10.2→7) siguen en pausa hasta el merge de feature/wysiwyg-pages.

## ADR-091 — Constructor WYSIWYG: geometría única, pipeline compartido con el PDF y modelo sección/hoja

**Fecha:** 2026-08-13
**Estado:** Aceptado

### Contexto

El constructor del documento editaba cada página como una tarjeta elástica de alto infinito, sin noción de hoja física; la paginación real solo existía en `PdfPreviewModal`, que medía el contenido en el DOM y lo repartía en hojas Carta antes de rasterizar. Lo que se editaba no era lo que salía. La rama `feature/wysiwyg-pages` atacó esto en dos etapas: primero la vista previa WYSIWYG (hojas reales junto al editor, con la medición del corte compartida entre generador y constructor — decisión que viajó en la rama numerada como ADR-067 y luego ADR-069, y que se dropeó en el rebase sobre master por colisión de numeración; este ADR la registra), y después un modelo de sección/hoja para componer documentos por hojas físicas.

Quedaban tres decisiones de fondo: quién es dueño del título de una hoja (B), qué es exactamente una hoja (C) y cómo se comporta el PDF frente al modelo (D).

### Decisión

**Geometría única y pipeline compartido.** `PAGE_GEOMETRY` (816×1056 px, alto útil 928) vive una sola vez en `constants.ts`. El HTML de una página se construye con `buildPageHtml` (`renderPageHtml.ts`), se mide con `measureContentElements` y se pagina con `paginateContentPage` — los mismos módulos para el PDF (`PdfPreviewModal`) y para la vista previa del editor (`useContentPageSheets` → `PageSheetsPreview`). El corte que muestra el editor es el del PDF por construcción.

**Modelo de datos sección/hoja.** `ProposalPage` gana `isSectionModel` y `parentPageId` (self-relation `PageSheets`, `onDelete: Cascade`; migración `20260718193601_add_section_model_to_proposal_page`). Una sección es una página `CUSTOM` con `isSectionModel: true` y sin padre; sus hojas son páginas hijas con `parentPageId`. El clonado remapea en dos pasadas (crea todas las páginas, luego remapea `parentPageId`). `addSheetToSection` y `createCustomPage` insertan con desplazamiento +1 transaccional para no colisionar `sortOrder` — en particular con TERMS después de un reorder que le borró el centinela 1000.

**B1 — la sección es la única dueña del título.** El encabezado de una hoja se resuelve en render con `resolveSheetHeading(sheet, pages)` ("Título de sección — Hoja N"), la misma función para editor, miniaturas y PDF (precedente ADR-066: resolver en render, no snapshot). La hoja no expone ni escribe título propio; el `title` copiado que persiste `addSheetToSection` queda como dato muerto que el render ignora.

**C1 — una hoja es un contenedor rígido de una página física.** `paginateSheet` (hermana de `paginateContentPage`, misma geometría) produce siempre un slice único; si el contenido excede el alto útil, el editor muestra un aviso de corte y el PDF recorta al límite físico por el `overflow: hidden` de `PdfSheet`. Nunca continuación silenciosa. Una hoja vacía imprime en blanco: estado válido, sin placeholder.

**D-b — header en toda hoja.** La geometría del editor descuenta el alto del header en toda hoja, así que el PDF renderiza el header (con el heading resuelto) en todas, no solo en la primera: si difiriera, el WYSIWYG mentiría en el borde. La página contenedora de la sección no emite página en el PDF; el índice lista una entrada por sección apuntando a la página de su primera hoja.

**UI.** `SectionView` muestra miniaturas de papel real (`SheetThumbnail`: `PdfSheet` + `PdfContentPage` escalados) clickeables; rename inline desde el sidebar para secciones y páginas planas no bloqueadas; reorder de bloques cableado al endpoint que existía sin consumidores; `moveTopLevel` con guarda de `isLocked` en lógica y chevrons. El buffer del título de sección se resetea por remontaje con key compuesto id:título (patrón ADR-086), lo que elimina el revert silencioso entre el input central y el rename del sidebar.

### Consecuencias

- El WYSIWYG es honesto por construcción: mismo heading, mismo pipeline y mismo corte en editor, miniaturas y PDF.
- Una sección sin hojas desaparece del PDF y del índice (sin contenedora no hay página); consistente con el modelo.
- Renombrar la sección se propaga a todas las vistas al instante, sin escrituras en cascada.
- La migración corre en producción con `migrate deploy` en el deploy del merge; `pg_dump` previo obligatorio.

### Archivos

`apps/api`: `prisma/schema.prisma`, `prisma/migrations/20260718193601_add_section_model_to_proposal_page/migration.sql`, `src/proposals/pages.service.ts`, `src/proposals/proposals.service.ts`, `src/proposals/proposals.controller.ts`. `apps/web`: `lib/constants.ts`, `lib/renderPageHtml.ts`, `lib/paginateContentPage.ts`, `lib/resolveSheetHeading.ts`, `lib/resolveImageUrl.ts`, `hooks/useProposalPages.ts`, `hooks/useContentPageSheets.ts`, `components/proposals/PdfPreviewModal.tsx`, `components/proposals/PdfSheet.tsx`, `components/proposals/PdfContentPage.tsx`, `pages/proposals/ProposalDocBuilder.tsx`, `pages/proposals/components/SectionView.tsx`, `SheetThumbnail.tsx`, `PageEditor.tsx`, `BlockEditor.tsx`, `PageSheetsPreview.tsx`.

### Commits

Rebase sobre `8f4f207` (15 commits, `de5b5c5..fbefa63`); supresiones de lint `8764bd4` y `93ee908`; insert-shift `6e92fa5`; guardas del sidebar `9faeede`; reorder de bloques `40d3250`; B1 `366d042`; C1 `9e35687`; D `8af6c8d`; preview lateral fiel `1b677be`; miniaturas `14c7d96`; rename desde sidebar `0627bbe`; limpieza `8419d21`; borde del rename `4220df0`.

### Pendientes

- Drag & drop en el sidebar y mover hojas entre secciones (nice-to-have registrados en el diagnóstico).
- `fetchPages` sin consumidor y las supresiones `set-state-in-effect` restantes (`useContentPageSheets`: medición de DOM; `useProposalPages`: invariante de `activePageId`): candidatos al rediseño de data-fetching de ADR-086.
- `variables` de página: capacidad del backend sin UI.
- Suite e2e sin gate en CI (arrastrado de Cohorte D).

## ADR-092 — Piso de modelo para prompts mixtos y regla de un prompt por mensaje

**Fecha:** 2026-08-14
**Estado:** Aceptado

### Contexto

Al estrenar el proyecto en la cuenta Team se corrieron pruebas de arranque. En dos respuestas consecutivas, Claude (chat) eligió Haiku para prompts que mezclaban búsqueda mecánica con juicio — clasificar archivos por categoría, evaluar posibles violaciones de la regla del pricing-engine, extraer la superficie de personalización de Tailwind — y entregó dos prompts ejecutables en un mismo mensaje. Ninguna de las dos cosas violaba la letra de §6: la tabla definía Haiku como "mecánico puro" pero no resolvía el caso mixto, y la regla de un paso a la vez prohibía encadenar tareas dentro de un prompt pero no cubría entregar varios prompts a la vez, lo que invita a correrlos de corrido y rompe el gate de validación entre pasos.

### Decisión

Dos reglas nuevas en INSTRUCTIVO_CLAUDE.md §6:

1. **Desempate para prompts mixtos:** si cualquier parte del prompt exige clasificar, evaluar, interpretar contenido o decidir (no solo buscar, contar o transcribir), el piso es Sonnet aunque el resto de la tarea sea mecánica. Un prompt 90% grep y 10% juicio es un prompt de juicio.
2. **Un mensaje del chat = un solo prompt ejecutable.** El siguiente prompt se redacta cuando llega el resultado del anterior, porque ese resultado puede cambiarlo.

Ambas reglas se replican resumidas en la skill novotechflow de claude.ai (vive fuera del repo; la edita Luis a mano).

### Consecuencias

- Haiku queda restringido a tareas 100% mecánicas; las mixtas suben a Sonnet. Costo marginal mayor por prompt a cambio de que la parte de juicio no la haga el modelo equivocado.
- El gate de un paso a la vez queda cerrado también en la entrega, no solo en la ejecución.
- El molde de comportamiento queda documentado para cualquier cuenta o sesión nueva, en vez de depender de correcciones en el chat.

### Archivos

INSTRUCTIVO_CLAUDE.md (§6, dos ediciones).

### Commits

Ediciones de §6: 1e455c9.

### Pendientes

- Replicar las dos reglas en la skill novotechflow y corregir de paso el dato obsoleto de la API externa ("sin mergear"; está en producción desde ADR-081). Lo hace Luis a mano en claude.ai.
- Re-subir INSTRUCTIVO_CLAUDE.md y DECISIONS.md del disco a los attachments del proyecto Team tras el push.

## ADR-093 — Advisories del audit: override quirúrgico de js-yaml y riesgo aceptado de uuid

**Fecha:** 2026-08-16
**Estado:** Aceptado

### Contexto

Apertura del frente de actualizaciones de dependencias. El audit fresco del 2026-08-16 (pnpm 10.33.4, árbol idéntico al del 2026-08-14: el lockfile no cambiaba desde `1f048dd`) arrojó 2 advisories, ambos transitivos de segundo nivel en dependencias de producción. El baseline "28 de axios/follow-redirects + 3 de postcss" que arrastraba el traspaso provenía del diagnóstico del 2026-07-24 y contaba findings (rutas del grafo), no advisories únicos; el barrido de minors del 2026-08-12 (`63c976e`) ya lo había limpiado.

Los dos advisories reales:

- `js-yaml@5.2.1` (high, GHSA-pm4m-ph32-ghv5, CVE-2026-73643): DoS por parseo exponencial de flow collections en `load()`/`loadAll()`; parcheado en 5.2.2. Llega por pin exacto de `@nestjs/swagger@11.4.6` (el pin vulnerable entró en 11.4.6; de 11.4.0 a 11.4.4 era 4.1.1 y en 11.4.5 era 4.3.0). No hay versión publicada del padre que admita la parcheada: 11.4.6 es `latest` y la alpha de la major 12 vuelve a 4.1.1.
- `uuid@8.3.2` (moderate, GHSA-w5hq-g745-h8pq, CVE-2026-41907): escritura sin bounds check en `v3()`/`v5()`/`v6()` cuando se les pasa `buf` externo; parcheado en 11.1.1 para el rango `<11.1.1`. Llega por `exceljs@4.4.0` (`^8.3.0`), dependencia de `api` y `web`; ninguna versión publicada de exceljs admite uuid >= 11.1.1.

Verificación de alcanzabilidad sobre el código instalado: `@nestjs/swagger` solo invoca `jsyaml.dump()` (una vez, en el handler de `yamlDocumentUrl`) — el parseo vulnerable no se alcanza, y además Swagger está gated por `SWAGGER_ENABLED` default off (ADR-071). `exceljs` solo invoca `v4()` sin argumentos (2 llamadas en `cf-rule-ext-xform.js`); `v3`/`v5`/`v6` ni se importan, ni en `lib/` (Node) ni en el bundle browser.

### Decisión

Vías distintas según alcanzabilidad y costo, ambas en el bloque `pnpm` del package.json raíz (preservando `onlyBuiltDependencies`):

1. **js-yaml: override quirúrgico scoped a la arista** — `"overrides": { "@nestjs/swagger>js-yaml": "5.2.2" }`. Es un patch sobre lo que swagger testeó, elimina el código vulnerable del árbol en vez de ignorarlo, y no toca las js-yaml 4.3.1 y 3.15.1 de las cadenas dev (`@nestjs/cli`, jest/ts-jest).
2. **uuid: riesgo aceptado y documentado** — `"auditConfig": { "ignoreGhsas": ["GHSA-w5hq-g745-h8pq"] }`. La alternativa (forzar un salto de 3 majors de uuid dentro de exceljs, corazón del export Excel de cotizaciones) es riesgo de runtime real a cambio de silenciar funciones que el grafo ni importa.

### Consecuencias

- `pnpm audit` en verde (exit 0): high 0; el moderate de uuid se reporta como `1 moderate (1 ignored)` — pnpm 10.33.4 lo excluye de la lista y del gate pero lo cuenta en el resumen; `advisories` sale `{}` y `muted` queda `[]` (en esta versión el ignore no se refleja ahí). `uuid@8.3.2` sigue instalado.
- El ignore es global por GHSA: si otra dependencia futura trajera un uuid vulnerable por la misma GHSA en una ruta que sí use `v3`/`v5`/`v6`, el audit no lo mostraría. Condición de revisión al tocar el grafo de exceljs o incorporar nuevos consumidores de uuid.
- Patrón nuevo: el bloque `pnpm` de la raíz gobierna resolución (overrides) y política de audit (auditConfig).
- Lockfile: `js-yaml@5.2.1 → 5.2.2` en la arista de swagger (+7/−4 líneas); gates de tipos verdes en web y api; 6/6 unit tests del api.

### Archivos

package.json (raíz), pnpm-lock.yaml.

### Commits

- `eadbfb1` — fix(deps): override js-yaml 5.2.2 and ignore uuid advisory in audit config.

### Pendientes

- Retirar el override cuando `@nestjs/swagger` declare js-yaml >= 5.2.2 (o al migrar a la major 12, que hoy vuelve a la línea 4.x, fuera del rango afectado).
- Re-evaluar el ignore de uuid si exceljs publica una versión con uuid >= 11.1.1 o si entra otro consumidor de uuid al grafo.

## ADR-094 — Cohorte E: migración Tailwind 3→4 por la vía del plugin de Vite

**Fecha:** 2026-08-16
**Estado:** Aceptado

### Contexto

Cohorte E (Tailwind 3→4), desbloqueada tras el merge del constructor WYSIWYG (ADR-090, ADR-091). El reconocimiento del 2026-08-16 dimensionó una superficie chica: config de 30 líneas (paleta novo + Inter), dos plugins (tailwind-scrollbar 3.1.0 con `nocompatible: true`, @tailwindcss/typography 0.5.20), un único CSS de entrada (`src/index.css`) con las tres directivas `@tailwind` y dos `@apply`; cero utilidades de opacity deprecadas, cero `theme()`, cero renombradas de v3. Lo material eran los renames semánticos de v4 — 57 `shadow-sm`→`shadow-xs`, 9 `backdrop-blur-sm`→`backdrop-blur-xs`, 16 `outline-none`→`outline-hidden` — que compilan en v4 con otro significado y degradan render y focus accesible en silencio. Peers contra el registry: @tailwindcss/vite declara `vite ^5.2 || ^6 || ^7 || ^8` (la incógnita Rolldown de ADR-089 quedó despejada de fábrica); typography 0.5.20 ya soporta v4; tailwind-scrollbar 4.0.2 exige `tailwindcss 4.x` estricto — acoplado al salto.

El reconocimiento cerró además tres checks menores de la capa web: `@tiptap/pm` se queda (peer real de @tiptap/core/react/html, no residuo); `@tiptap/extension-underline` se removió (redundante: starter-kit lo arrastra y lo registra, cero imports directos; los hashes del bundle quedaron idénticos tras quitarlo); html2canvas sin acción (el código importa solo html2canvas-pro; el clásico entra únicamente como optionalDependency de jspdf). Hallazgo mayor sin acción local: el bundle de producción lleva la build development de react-router 7.18.2 porque el `exports` del paquete apunta todas sus condiciones a `dist/development/` — no existe condición `production`, y `ENABLE_DEV_WARNINGS = true` queda inlineado con sus warnings sobreviviendo a la minificación. Causa upstream (7.18.2 es latest); responde la pregunta abierta nº 5 del diagnóstico 2026-07-24.

### Decisión

Vía @tailwindcss/vite, no @tailwindcss/postcss: integración nativa al pipeline de Vite 8/Rolldown, elimina `postcss.config.js` y autoprefixer del manifiesto de web (v4 autoprefija vía Lightning CSS), peer `^8` explícito. postcss permanece en el árbol solo como transitiva (sanitize-html en api, vite).

Ejecución con la herramienta oficial (`pnpm dlx @tailwindcss/upgrade`; dlx corre aislado y no toca los pins del árbol). El primer intento abortó en la fase de templates: la tool actualiza dependencias antes de migrar templates, pnpm re-resolvió el peer de tailwind-scrollbar@3.1.0 contra tailwindcss@4 y el plugin v3 requirió `tailwindcss/lib/util/toColorValue`, subpath interno que v4 ya no exporta (ERR_PACKAGE_PATH_NOT_EXPORTED). Vía adoptada: revert de lo parcial, bump previo de tailwind-scrollbar a ^4.0.2 en commit intermedio (árbol deliberadamente no funcional en tránsito — scrollbar 4 bajo tailwind 3 —, aceptado porque nadie desarrolla parado ahí y el push lleva el conjunto), y re-run de la tool con working tree limpio. Completó las cuatro fases: config JS→CSS-first (`@theme` con los cinco colores novo y `--font-sans` Inter; `@plugin 'tailwind-scrollbar' { nocompatible: true; }`; `@plugin '@tailwindcss/typography'`; `@utility glass` con su `@apply` original; `tailwind.config.js` borrado por la propia tool), stylesheet migrado, 49 `.tsx` con el 100% de los renames (incluido el `outline-none` dentro del string de `editorProps.attributes.class` en RichTextEditor.tsx), y PostCSS reconfigurado — reconvertido a mano a la vía vite: `@tailwindcss/vite` en `vite.config.ts` (`plugins: [react(), tailwindcss()]`), fuera @tailwindcss/postcss, postcss y autoprefixer, `postcss.config.js` borrado.

El bloque de compatibilidad de border-color que insertó la tool (`border-color: var(--color-gray-200, currentcolor)` sobre `*`, `::before`, `::after`, `::backdrop`, `::file-selector-button`) se conserva: replica el default v3 sin auditar borde por borde.

### Consecuencias

- Config CSS-first: toda la configuración de Tailwind vive en `apps/web/src/index.css`; no existen `tailwind.config.js` ni `postcss.config.js`.
- CSS de dist: 85,85 kB → 109,25 kB (~+23 kB de preflight/theme v4; gzip 16,62 kB). Build de web ~1,8 s.
- Gates verdes: tsc en web y api, build de web, y verificación del CSS compilado (paleta novo presente, `.glass` presente, utilidades `scrollbar-` presentes).
- Verificación visual en navegador (Luis) sin regresiones: bordes bajo el bloque de compatibilidad, focus con `outline-hidden` (Login, 2FA, editor tiptap), scrollbars en modo nocompatible, cursor y placeholders del preflight v4, y PDF de prueba con html2canvas-pro rasterizando estilos v4. No hizo falta regla base para `cursor: pointer`.
- La cola larga de renames (ring desnudo, `!important` v3, variables arbitrarias `[--x]`) dio cero ocurrencias: ninguna migración manual de clases.

### Archivos

`apps/web`: package.json, vite.config.ts, src/index.css, 49 `.tsx` bajo src/ (listados en el commit de la migración), tailwind.config.js y postcss.config.js (eliminados). pnpm-lock.yaml.

### Commits

- `39a1bc0` — chore(deps): remove redundant tiptap underline direct dependency.
- `7a9fe33` — chore(deps): bump tailwind-scrollbar to 4 ahead of tailwind 4 migration.
- `22985c1` — chore(deps): migrate tailwindcss 3 to 4 with vite plugin.

### Pendientes

- Retirar el bloque de compatibilidad de border-color: exige auditar los elementos que dependen del default y ponerles utilidad explícita de color de borde. Sin urgencia; el bloque es inocuo.
- `apps/web/src/App.css` está muerto (CSS del starter de Vite, sin ningún import): borrarlo en una limpieza menor.
- react-router: vigilar releases que publiquen condición `production` en el `exports`; sin acción local mientras tanto.
- Cohorte F (Prisma 5.10.2→7) sigue en cola; prerequisito: regenerar `novotechflow_prod_copy`.

## ADR-095 — Cohorte F: migración Prisma 5→7 al cliente Rust-free con driver adapter de pg

**Fecha:** 2026-08-16
**Estado:** Aceptado

### Contexto

Prisma llevaba dos majors congelado en 5.10.2 (pin de ADR-041). El reconocimiento contra las guías oficiales dejó la superficie v6 en cero para este repo — sin relaciones m-n implícitas (única fuente de migración de esquema del salto), sin campos Bytes, sin NotFoundError, sin $use ni full-text search — así que se saltó directo 5→7 sin hop intermedio. v7 es un cambio generacional: generador `prisma-client` con `output` obligatorio fuera de node_modules, cliente sin engines Rust que exige driver adapter, `prisma.config.ts` como configuración del CLI, fin del autoload de `.env` y prohibición de `url` en el datasource del schema (P1012, endurecido en 7.9.x respecto a la guía oficial, que lo listaba como deprecado).

### Decisión

Salto directo a 7.9.1 con pins exactos en lockstep (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) más `pg`, `dotenv` y `@types/pg`. Generador `prisma-client` con `output = "../src/generated/prisma"` y `moduleFormat = "cjs"` (el api es CommonJS): carpeta gitignored, generada en build, con los 20 imports del api repuntados a rutas relativas. El datasource quedó sin `url`: la del CLI vive en `prisma.config.ts` con `env("DATABASE_URL")` estricto (fail-fast con mensaje claro si falta en runtime) y la del proceso entra por el adapter. `PrismaService` instancia `PrismaPg` parseando `connection_limit`/`pool_timeout` de la propia `DATABASE_URL` hacia `max`/`connectionTimeoutMillis`: el dimensionamiento del ADR-072 se conserva sin tocar variables de Railway (los defaults del driver pg difieren de los de v6). El shutdown pasó de `$on('beforeExit')` (eliminado en v7) a `onModuleDestroy` + `app.enableShutdownHooks()`. `import 'dotenv/config'` abre `main.ts` y `seed.ts` porque v7 dejó de autocargar `.env` al instanciar el cliente. Se retiraron 10 scripts legacy que instanciaban el cliente viejo (6 de limpieza/import de clientes, 3 seeds `.js`, y el backfill de ADR-082/084 ya ejecutado); `seed.ts` queda como único seed, con adapter. `express` pasó a dependencia directa (`^5.2.1`): `main.ts` ya lo importaba y solo llegaba transitivo. Dockerfile del api: el `generate` del stage prod-deps se eliminó (el output ya no va a node_modules; el cliente viaja compilado dentro de `dist` desde el builder), el runner ganó `COPY` de `prisma.config.ts` para el `migrate deploy` del CMD, y el `generate` del builder lleva un `DATABASE_URL` placeholder inline porque el CLI resuelve el config antes de cualquier comando, incluso los que no tocan base.

### Consecuencias

- Ensayo completo contra `novotechflow_prod_copy` regenerada del dump del 16-ago: `migrate status` 35/35, `db execute` sin `--url`, lecturas y `$transaction` batch vía adapter (70 image_assets, 3145 proposal_page_blocks, 11 users, 426 proposals), include relacional, y api local respondiendo 200.
- Imagen validada desde `git archive` del HEAD (mismo contexto limpio que construye Railway): build sin descarga de engines, `migrate deploy` no-op, bootstrap completo de Nest y 200 en la sonda; 207 MB de contenido. El test de imagen local queda institucionalizado como guardia previa al push de cambios de runtime.
- La cohorte no introduce migración de esquema: el deploy aplicará cero migraciones.
- Gates al cierre: tsc de web y gate completo del api (`apps/api/tsconfig.json`, ADR-071). Los commits de la rama se validaron con `tsconfig.build.json` por una instrucción desactualizada de claude.ai; el gate completo corrió en verde antes del push.
- `typescript` 6.0.2 viaja al runner como peerDependency opcional de `prisma` resuelta por el lockfile; la carga de `prisma.config.ts` en el runner no está probada sin él. Si algún día se poda, revalidar; fallback: config en `.mjs`.
- `GEMINI_API_KEY` es obligatoria para arrancar el contenedor (fail-fast preexistente de GeminiClient): todo `docker run` de prueba la necesita como dummy.
- Flags muertos en v7: `--url`/`--schema` de `db execute` y los `--from-url`/`--to-url` de `migrate diff`; `migrate dev` ya no corre `generate` ni seed automáticamente. §9 del instructivo actualizado; el lock EPERM de `query_engine-windows.dll.node` murió con los engines.
- pnpm 10 ignora los build scripts de `prisma`/`@prisma/engines`; `generate` funciona igual porque el provider nuevo no necesita engines binarios.

### Archivos

`apps/api`: package.json, prisma/schema.prisma, prisma.config.ts (nuevo), prisma/seed.ts, Dockerfile, src/main.ts, src/prisma/prisma.service.ts y 18 archivos de src/ con el import repuntado. 10 scripts legacy eliminados. Raíz: .gitignore, pnpm-lock.yaml, INSTRUCTIVO_CLAUDE.md (§9).

### Commits

- `63950f8` — chore(api): remove legacy prisma scripts superseded by seed.ts and completed backfill
- `89c1d89` — chore(api): declare express as direct dependency
- `62f9159` — chore(deps): migrate prisma 5 to 7 with pg driver adapter
- `ef92a04` — fix(api): load dotenv at bootstrap after prisma 7 removed env autoloading
- `5ae5ebf` — chore(api): adapt dockerfile to prisma 7 client output and cli config
- `dbec210` — fix(api): use placeholder database url for prisma generate in image build
- `316b15f` — docs: update section 9 prisma notes for prisma 7

### Pendientes

- Revalidar la carga de `prisma.config.ts` en el runner si `typescript` deja de viajar en el árbol prod (fallback: migrar el config a `.mjs`).
- Actualizar a mano en claude.ai las instrucciones del proyecto y la skill novotechflow: gate de tipos del api (`tsconfig.json`, no `tsconfig.build.json`, ADR-071), comandos y workarounds de la era v7. Lo hace Luis.
- Re-subir INSTRUCTIVO_CLAUDE.md y DECISIONS.md del disco a los attachments del proyecto tras el push.

## ADR-096 — Retiro del star re-export muerto del barrel de pricing; los paquetes workspace permanecen CJS

**Fecha:** 2026-08-17
**Estado:** Aceptado

### Contexto

Al correr `pnpm dev`, Rolldown (Vite 8, ADR-089) emitía: "Unable to interop `export * from "@repo/pricing-engine"` in apps/web/src/lib/pricing-engine.ts, this may lose module exports". Causa raíz, verificada en reconocimiento de solo lectura del 2026-08-17: `@repo/pricing-engine` y `@repo/item-display` (ADR-052/067) son CJS reales — package.json sin `type`, `exports` con solo `types` + `default` al mismo `dist/index.js`, y `module: NodeNext` del tsconfig base resolviendo a CommonJS justamente por la ausencia de `type` — y un `export *` de un módulo CJS no puede expandirse estáticamente (las exports CJS son asignaciones en runtime), a diferencia de los imports named, que pasan sin aviso. El warning es dev-only: `pnpm --filter web build` termina exit 0 sin rastro de "interop" (en build Rolldown enlaza el grafo completo y enumera las exports; en dev el módulo se transforma aislado, con los paquetes además en `optimizeDeps.include`). En el bundle de producción ambos paquetes quedan envueltos en el helper `__commonJS` del rolldown-runtime y se consumen por acceso a propiedad — correctos pero no tree-shakeables (~3 kB de pricing-engine entran completos).

El hallazgo decisor: el `export *` de la línea 9 no tenía consumidores. El único importador del barrel en todo apps/web (`useDashboard.ts:4`) usa `getDashboardAmount` y `MinSubtotalResult`, ambos locales del archivo; los 13 consumos restantes de los dos paquetes en web y api son named imports directos a `@repo/*` (más un `import type` y dos re-exports named de item-display en `lib/itemDescription.ts` y `lib/constants.ts`). Era código muerto que además era el único disparador del warning.

### Decisión

Eliminar el `export * from '@repo/pricing-engine'` del barrel. `apps/web/src/lib/pricing-engine.ts` queda en lo que su cabecera declara: helpers de pricing web-only (`computeMinSubtotal`, `getDashboardAmount`) que consumen el paquete por import named, como todos los demás sitios. El patrón de ADR-052 se ratifica: el paquete es la fuente canónica y se consume por named imports directos.

Alternativa evaluada y descartada — migrar los paquetes a ESM (`type: module` o condición `import` en `exports`): compra hoy ~3 kB de tree-shaking a cambio de riesgo de runtime real sobre la api CJS (`require()` de los paquetes en `external-proposals.service.js`, único punto de contacto; Node >= 22.13.0 soporta require(esm) pero sin red de tests que respalde el cambio de formato), sobre un paquete sin suite de tests propia (deuda registrada en ADR-088) cuyo riesgo de regresión ya obligó a tratar Prisma como proyecto aparte, con el acople rígido del Dockerfile del api (runner planta los paquetes copiando exclusivamente package.json + dist) y el build de paquetes duplicado en cuatro sitios (dos Dockerfiles, ci.yml, pr-check.yml). No-hacer explícito con condición de reevaluación: reconsiderar ESM cuando `packages/pricing-engine` gane su suite de tests, momento natural para tocar su formato.

### Consecuencias

- El warning de interop desaparece de `pnpm dev` (verificación: próximo arranque de dev de Luis; el build de prod ya era silencioso).
- Cero cambios funcionales: tsc en web y api, lint de ambos y build de web en verde; ningún consumidor dependía de los símbolos re-exportados.
- Los paquetes permanecen CJS; el envoltorio `__commonJS` y la ausencia de tree-shaking (~3 kB) se aceptan como costo conocido.
- api, Dockerfiles y CI intactos.

### Archivos

`apps/web/src/lib/pricing-engine.ts`.

### Commits

- `5f11cb2` — refactor(web): drop dead star re-export of @repo/pricing-engine from pricing barrel

### Pendientes

- Migración ESM de `@repo/pricing-engine` y `@repo/item-display`: pospuesta; reevaluar al crear la suite de tests del pricing-engine.

## ADR-097 — Recuperación documental de ADR-052 y ADR-053, perdidos en una resolución de merge

**Fecha:** 2026-08-17
**Estado:** Aceptado

### Contexto

La bitácora salta de ADR-051 a ADR-054. La investigación forense del 2026-08-17 (git log -S sobre el historial completo) estableció que no es un hueco de numeración: ADR-052 y ADR-053 existieron. Nacieron en la rama feature/external-api (0254690, 2026-06-22, y b463cac, 2026-06-23); master, avanzando en paralelo, quemó los números al saltar de 051 a 054 (49b6bbb, 2026-06-26); y la resolución del merge de master hacia la rama (0a42cf5, 2026-08-10) tomó la región de master en DECISIONS.md y dejó caer ambos bloques. La pérdida quedó enmascarada porque el commit siguiente (db80dc6) reemitió las decisiones restantes de la rama como ADR-078 a 081, y el merge final a master (ce4715e) consolidó el archivo sin ellos. No fue un borrado deliberado: fue pérdida en resolución de conflicto. El código de ambos llegó completo a master — d58ef48, 78e470d, 71536ab —; solo se perdió la prosa.

El costo documental es material. De las 9 decisiones sustantivas del bloque 052, 6 no están cubiertas por ningún heading vigente y 3 solo parcialmente; del 053, 6 sin cubrir y 4 parciales. El hueco más serio es de seguridad: el diseño del auth scoped de `/external` — `EXTERNAL_JWT_SECRET` separado con validación en boot, estrategia Passport `jwt-external` propia, payload reducido `{ sub, email }`, y el rechazo razonado de la variante de un solo secreto con claim de scope — no existía en ningún ADR vigente pese a correr en producción desde el 2026-08-11. Además, cuatro menciones a ADR-052 (en ADR-079, ADR-089 y dos en ADR-096) eran referencias colgantes, y la confusión ya tuvo costo operativo: ADR-096 se redactó citando un ADR ausente del documento.

### Decisión

Reproducir ambos bloques dentro de este ADR, verbatim desde su fuente canónica: el blob 496feba:DECISIONS.md (hash git 0abf5cd14fe9c1cd3997e8ec60e2ff04e93e5857), última versión que los contuvo, byte-idéntica a la prosa de sus commits de origen. Única transformación aplicada: todos los headings degradados un nivel (nivel 2 a nivel 3, nivel 3 a nivel 4), para que la lectura del último ADR en disco (INSTRUCTIVO §4.1, que resuelve al último heading de nivel 2) siga apuntando a este ADR-097 y nunca a los bloques reproducidos. Fechas y estados internos se conservan tal cual: describen junio de 2026, no el presente.

Los números 052 y 053 quedan retirados de forma permanente: no se reciclan ni se renumeran, en línea con la política de no renumerar retroactivamente. Toda mención a ADR-052 o ADR-053 en esta bitácora refiere al contenido reproducido aquí.

Alternativas descartadas: no reparar (deja sin rastro documental la decisión estructural del paquete compartido y el diseño de seguridad de `/external`, con referencias colgantes que ya confundieron la operación); appendear los bloques con sus headings originales de nivel 2 (el protocolo §4.1 leería ADR-053 como último y el próximo ADR colisionaría en 054); y reescribirlos como ADR nuevos con fecha de hoy (pierde la evidencia de qué se decidió, cuándo y con qué razonamiento, que es el valor de una bitácora).

### Vigencia de lo reproducido

El contenido describe el árbol vigente, con dos decisiones puntuales del 052 superadas después y ya documentadas: build.commonjsOptions desapareció con Vite 8 (ADR-089) y el export * del residuo se retiró en ADR-096. El propio texto del 052 registra que ese shim nació sin consumidores — los 7 imports se reapuntaron al paquete en el mismo commit —, lo que ADR-096 verificó de forma independiente ocho semanas después.

El bloque siguiente reproduce ADR-052 completo (headings degradados un nivel):

### ADR-052 — Extracción del pricing-engine a package compartido `@repo/pricing-engine` para consumo por web y api

**Fecha:** 2026-06-22
**Estado:** Implementada y verificada en runtime, en la rama `feature/external-api` (sin commitear al redactar este ADR; el commit del refactor y el push los hace Luis). Primer paso (Fase 1) de la feature de API externa de lectura.

#### Contexto

La feature de API externa (otra aplicación web que, con login de NovoTechFlow, lee las propuestas ganadas del usuario con el valor de venta de cada item por escenario) exige que `apps/api` (NestJS) calcule el valor de venta del lado del servidor. El diagnóstico confirmó que el precio de venta automático **no se persiste**: se recomputa siempre en el frontend con `pricing-engine.ts` (costo + margen + TRM); en la DB solo viven `unitPriceOverride` y `marginPctOverride`. No hay un precio final guardado que la API pueda devolver directamente.

Como el valor de venta debe entregarse en vivo y calculado (no los insumos crudos), la API tiene que ejecutar la misma lógica financiera. Esa lógica vive en `apps/web/src/lib/pricing-engine.ts`, y CONVENTIONS.md §J la fija como fuente única: ningún archivo puede implementar cálculos financieros por fuera del pricing-engine, y replicarlos es un bug. `apps/api` no puede importar de `apps/web/src`. Las alternativas (replicar el cálculo en el backend, o empujarlo a la otra app) violan §J o arriesgan que la otra app muestre un precio distinto al de NovoTechFlow — el riesgo asimétrico "precio bajo = catastrófico" que el proyecto cuida.

La única vía que respeta §J es extraer el pricing-engine a un package compartido del monorepo que web y api consuman: centralizar, no replicar.

#### Decisión

1. **Package nuevo `@repo/pricing-engine`** en `packages/pricing-engine/`, siguiendo el patrón de workspace del monorepo (name `@repo/*`, `workspace:*`, tsconfig que extiende `@repo/typescript-config/base.json`).

2. **Desvío del molde de `@repo/ui`: este package lleva build.** `@repo/ui` se consume como fuente `.tsx` cruda sin build porque solo lo usa web (vía Vite). `@repo/pricing-engine` también lo consumirá `apps/api` (NestJS), que compila con `tsc` a `dist/` y corre en Node sin bundler: necesita JS emitido + `.d.ts`. El package tiene script `build` (`tsc`) con `main`/`types`/`exports` apuntando a `dist/`.

3. **Emit CommonJS** para que NestJS lo consuma vía `require`. Se logra heredando `module/moduleResolution: NodeNext` de `base.json` (sin override) más `package.json` **sin** `"type": "module"`: NodeNext resuelve el archivo como CJS y emite `require`/`exports`. Verificado en el `index.js` emitido (`"use strict"`, `Object.defineProperty(exports, "__esModule")`, `exports.xxx =`). Se descartó fijar `module: CommonJS` + `moduleResolution: Node` explícitos porque `Node` (= `node10`) está deprecado y TypeScript 6 lo eleva a error duro (TS5107); heredar NodeNext da el mismo emit CJS sin la deuda hacia TS 7.0.

4. **Reparto del archivo original.** Las 16 funciones puras (operan solo sobre `PricingItem`/`PricingScenarioItem` y primitivos) van al package. `computeMinSubtotal` y `getDashboardAmount` **se quedan en `apps/web`** porque dependen de `ProposalSummary` (tipo del dominio web) y son consumo exclusivo del dashboard; el backend no las necesita. El archivo `apps/web/src/lib/pricing-engine.ts` queda como residuo que re-exporta todo el package (`export * from '@repo/pricing-engine'`, para no romper a los consumidores que importan tipos/constantes desde la ruta antigua) y conserva esas dos funciones más `CurrencyCode` y `MinSubtotalResult`. De los consumidores, 7 reapuntan a `@repo/pricing-engine`; `useDashboard.ts` sigue importando del residuo (usa `getDashboardAmount`/`MinSubtotalResult`).

5. **Integración con Vite (frontend ESM consumiendo package CJS).** `apps/web` es ESM (`"type": "module"`); el package emite CJS. En dev, Vite servía el `dist` CJS como ESM nativo y fallaba (`does not provide an export named 'calculateScenarioTotals'`). Se resuelve declarando el package en `optimizeDeps.include` (prebundle de esbuild en dev, expone los named exports) y en `build.commonjsOptions.include` con regex del package + `node_modules` (conversión CJS→ESM de Rollup en prod, necesaria porque el package es un symlink del workspace y el plugin commonjs por defecto solo procesa `node_modules`). Se mantiene un solo artefacto CJS — el que NestJS requiere en Fase 2.

#### Consecuencias

- El cálculo financiero queda centralizado en `@repo/pricing-engine`, fuente única que web y api consumen. §J se respeta: no se replica en ningún lado. El dashboard de web queda idéntico (las dos funciones que se quedaron no se movieron).
- `apps/api` puede consumir el package compilado en Fase 2 sin tocar nada más del lado del engine.
- Web compila (`tsc --noEmit` exit 0) y corre idéntico (login y carga de cálculos verificados en browser tras regenerar el prebundle de Vite).
- Turborepo encadena el build del package antes que el de web automáticamente vía `dependsOn ["^build"]` (web ya declara el package como dependencia); no se tocó `turbo.json`.
- Lección de toolchain registrada: `tsc --noEmit` valida tipos contra el `.d.ts` y pasa en verde, pero no captura la incompatibilidad de carga CJS/ESM en runtime de Vite — esta apareció solo al cargar la app en el browser. La verificación funcional en browser es la red de seguridad para extracciones que cruzan la frontera de módulos.

#### Archivos

- `packages/pricing-engine/package.json` (nuevo) — name `@repo/pricing-engine`, build con tsc, exports a `dist/`, sin `"type": "module"` (emit CJS)
- `packages/pricing-engine/tsconfig.json` (nuevo) — extiende `base.json`, hereda NodeNext, `outDir: dist` / `rootDir: src`
- `packages/pricing-engine/src/index.ts` (nuevo) — las 16 funciones puras (constantes, `convertCost`, interfaces `PricingItem`/`PricingScenarioItem`/`ScenarioTotals`/`ItemDisplayValues`, 13 funciones de cálculo) copiadas verbatim del original
- `apps/web/package.json` — declara `@repo/pricing-engine: workspace:*`
- `apps/web/src/lib/pricing-engine.ts` — reescrito como residuo: `export *` del package + `computeMinSubtotal`/`getDashboardAmount`/`CurrencyCode`/`MinSubtotalResult`
- `apps/web/vite.config.ts` — `optimizeDeps.include` y `build.commonjsOptions.include` para el package CJS
- 7 consumidores reapuntados a `@repo/pricing-engine`: `lib/exportExcel.ts`, `components/proposals/ScenarioTotalsCards.tsx`, `pages/proposals/components/ScenarioItemRow.tsx`, `pages/proposals/ProposalCalculations.tsx` (2 imports), `hooks/useScenarios.ts`, `pages/proposals/ProposalItemsBuilder.tsx`, `hooks/useProposalScenarios.ts`

#### Commits

- Pendiente — `refactor: extract pricing-engine to @repo/pricing-engine package` (extracción + residuo + reapunte de imports + integración Vite, en un commit atómico; lo deja Claude Code, lo pushea Luis)

#### Pendientes

- **Commit del refactor** (lo hace Claude Code tras este ADR) y **push a `master`** (lo hace Luis tras verificar que no hay usuarios en producción). El push dispara `migrate deploy` en Railway, aunque esta fase no incluye migración.
- **Fase 2 — módulo `/external` en `apps/api`:** auth scoped con `EXTERNAL_JWT_SECRET` separado (login 2FA externo + estrategia + guard propios), endpoints solo-GET filtrados por `req.user.sub` (ownership §K), consumo de `@repo/pricing-engine` para calcular el valor de venta, sumar el origen de la otra app a `CORS_ORIGIN`. ADR propio al cerrarse.
- **Verificación numérica en browser** (dashboard y totales de escenario idénticos al estado pre-refactor): pendiente de confirmación explícita de Luis antes del merge a `master`.

El bloque siguiente reproduce ADR-053 completo (headings degradados un nivel):

### ADR-053 — Módulo /external en apps/api: API de lectura para app de requisiciones, con auth scoped (EXTERNAL_JWT_SECRET) y reuso del 2FA interno

**Fecha:** 2026-06-22
**Estado:** Implementada y verificada en runtime, en la rama `feature/external-api` (sin pushear; commits locales del módulo de auth, del endpoint de propuestas y del ADR pendientes de push). Segunda parte (Fase 2) de la feature de API externa, que se apoya en ADR-052 (extracción del pricing-engine como package compartido).

#### Contexto

Un desarrollador externo (Felipe) está construyendo otra aplicación web que, autenticada con las mismas credenciales de NovoTechFlow, debe leer las propuestas en estado GANADA del usuario logueado para disparar requisiciones (órdenes de compra) y armar la facturación. La app no la maneja un sistema impersonal: la usa un comercial humano, así que el login tiene que pasar por el mismo flujo 2FA que la app principal, no un esquema de API key.

ADR-052 resolvió la pieza de cálculo: extraer las 16 funciones puras del pricing-engine a `@repo/pricing-engine` (CommonJS) para que web y api consuman la misma lógica. Quedó como pendiente explícito el módulo `/external` en `apps/api` que materialice el contrato de lectura. Este ADR documenta esa segunda parte.

Tres restricciones definieron el diseño. Primera, la app de Felipe vive en otro dominio: hay que evitar que un token comprometido en esa superficie abra los endpoints internos del backend. Segunda, los valores de venta no están persistidos en la DB — se recomputan siempre en el frontend con `pricing-engine`; cualquier API que los entregue tiene que ejecutar el mismo cálculo, sin replicar la lógica (CONVENTIONS §J). Tercera, la otra app necesita el dato crudo de requisición (qué item, qué proveedor, qué costo) más el valor de venta calculado: no totales, no precios "de catálogo", sino los efectivos para esa propuesta en ese escenario.

#### Decisión

1. **Módulo `/external` separado en `apps/api/src/external/`**, sin tocar el `AuthModule` interno en su comportamiento (el único cambio al interno fue sumar `EmailVerificationService` al array `exports` de `AuthModule`, para que el módulo externo pueda inyectarlo y reusar la verificación del código 2FA; no se modificó ninguna lógica del auth existente).

2. **Auth scoped con secreto separado.** El módulo registra su propio `JwtModule.register({ secret: EXTERNAL_JWT_SECRET })` y su propia estrategia Passport `'jwt-external'` con guard `ExternalJwtAuthGuard`. El secreto externo se valida en boot con IIFE sin fallback, igual que `JWT_SECRET`. Razón: si la app externa o el token se comprometen, el secreto interno nunca estuvo expuesto a esa superficie; el token externo no abre la API interna por construcción (la estrategia interna lo rechaza al verificar la firma con `JWT_SECRET`). Se descartó la variante de un único secreto con claim de `scope` porque obliga a tocar la validación interna y deja una sola superficie de compromiso. El payload del token externo es reducido: `{ sub, email }` — sin `role`, sin `nomenclature`. El TTL se igualó al interno (12h).

3. **Reuso del 2FA interno, no atajo.** `ExternalAuthService` inyecta `AuthService` y `EmailVerificationService` y reusa `validateUser` (credenciales + bcrypt), `login` (dispara el código por email) y `emailVerificationService.verifyCode`. Lo que **no** reusa es `verifyAndLogin` interno, porque ese firma con el `jwtService` interno (secreto `JWT_SECRET`); en su lugar implementa su propio `verifyAndLogin` que firma con el `jwtService` del `JwtModule` externo (secreto `EXTERNAL_JWT_SECRET`) sobre el payload reducido. Endpoints: `POST /external/login`, `POST /external/verify-code`, `POST /external/resend-code`, con los mismos rate limits que el auth interno (5/min en login y verify, 3/min en resend). Se descartó explícitamente el atajo de "API key sin 2FA" sugerido en una iteración: la app la usa un humano y debe loguearse como en NovoTechFlow.

4. **Ownership absoluto por `userId` del token, sin excepción de admin.** El `findAll` interno aplica `accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id }`, lo que abre el alcance a admins. En `/external` el filtro es **siempre** `where: { userId, status: GANADA, deletedAt: null }`, sin distinción de rol: la app externa es del usuario para sus datos, el rol no abre el alcance. Esto refuerza la garantía IDOR (CONVENTIONS §K) sobre la nueva superficie.

5. **Endpoint único `GET /external/proposals`** protegido por `ExternalJwtAuthGuard`. Read-only. No reusa el `findAll` interno (que carece de filtro por status, ordering en `scenarioItems`, y aplica la excepción de admin que acá no aplica); el service externo arma su consulta propia con el include modelado sobre `getScenariosByProposalId` (que sí ordena por `sortOrder`), agregando `orderBy` también a `children`. El tipo del payload de la consulta vive en `external-proposals.types.ts` con `Prisma.ProposalGetPayload` derivado del mismo objeto `include` usado en el `findMany` (mediante `satisfies Prisma.ProposalInclude`), garantizando que include y tipo nunca se desincronicen.

6. **Cálculo server-side vía `@repo/pricing-engine`.** El service mapea cada `ScenarioItem` raíz al shape `PricingScenarioItem` que el package espera (con casteo explícito de `Prisma.Decimal` a `number`), llama `calculateItemDisplayValues(si, allItems, currency, conversionTrm)` y toma su `unitPrice` como `unitSalePrice` del DTO de salida. Los hijos no se calculan (el package no produce `unitPrice` para hijos: su costo alimenta el costo del padre vía `calculateChildrenCostPerUnit`). Para satisfacer el tipo `PricingScenarioItem` recursivo a partir del include finito de Prisma se introdujo una función hoja `childToPricingScenarioItem` con `children: []`, fiel al dominio: los hijos son hojas. Los items diluidos (`isDiluted: true`) reciben del package `unitPrice = 0` por diseño y se entregan así en el DTO; su costo real sí va para la requisición.

7. **DTO de salida con whitelist explícita, exponiendo base + overrides sin aplanar.** Una iteración temprana exponía solo los campos base del `ProposalItem` (margen, costo), lo que generaba una inconsistencia visible al consumidor: el `unitSalePrice` reflejaba el override del `ScenarioItem` (calculado correctamente por el package) pero el `marginPct` reportado era el base del item. La prueba contra una propuesta real lo destapó (`marginPct: 20` reportado vs precio implícito de margen efectivo 10, por un `marginPctOverride: 10` en el `ScenarioItem`). Se decidió exponer ambos: los campos base del item (`unitCost`, `marginPct`) y los tres overrides del escenario (`marginPctOverride`, `unitCostOverride`, `unitPriceOverride`), todos como `number | null`. La app consumidora ve la foto completa y decide qué usar; el `unitSalePrice` ya refleja la resolución correcta. Los hijos exponen su `unitCostOverride` por la misma razón (su costo va a la OC). Se descartó "aplanar" a valores efectivos: pierde información que la app puede necesitar.

8. **Sin totales en el payload.** Ni totales de línea (`unitPrice × quantity`) ni de escenario (gravado, IVA, total). La app puede calcularlos a partir de los unitarios y las cantidades efectivamente ordenadas, que pueden no coincidir con las de la propuesta. Entregar totales masticados confunde (qué incluye, qué no) y no aporta a requisición/facturación.

9. **Sin `manualAmount` ni imágenes ni páginas/bloques del documento.** El `manualAmount` solo aplica a propuestas sin escenarios reales con cálculo; para una ganada que va a requisición es ruido. Imágenes y páginas/bloques no aportan a la requisición y engordarían el payload.

10. **CORS local sumando el origen de la app externa.** Se agregó `http://localhost:8080` (origen local de la app de Felipe) a `CORS_ORIGIN` del `.env` de `apps/api`, junto a `http://localhost:5173` (web). Cambio de `.env` local, no versionado. Para producción quedará pendiente sumar el origen público de la app externa a `CORS_ORIGIN` de Railway cuando se despliegue.

11. **`EXTERNAL_JWT_SECRET` en `.env` local y documentado en `.env.example`.** Hex de 64 chars distinto de `JWT_SECRET`, generado localmente. El `.env.example` documenta la variable como requerida.

12. **`apps/api` consume `@repo/pricing-engine` como dependencia de workspace.** Se sumó `"@repo/pricing-engine": "workspace:*"` a `apps/api/package.json`. El consumo es directo (el package emite CommonJS, NestJS lo `require` sin interop). El smoke test con `tsc --noEmit` confirmó la resolución de tipos sin tocar tsconfig.

#### Consecuencias

- La feature queda funcionalmente completa en `feature/external-api`: auth scoped con 2FA, endpoint de propuestas ganadas con valor de venta calculado server-side, DTO completo y coherente, CORS local listo para que Felipe pruebe desde su `http://localhost:8080`. La app externa puede integrarse sin que tocar nada del flujo interno de NovoTechFlow.
- §J se respeta: el cálculo financiero sigue siendo único — vive en `@repo/pricing-engine` y lo consumen web (vía residuo) y api (directo). No hay replicación.
- §K se refuerza: la nueva superficie de lectura aplica ownership absoluto por `userId` del token, sin excepción de admin, más estricta que el endpoint interno equivalente.
- Lección de toolchain registrada (segunda en esta feature, complementa la de ADR-052): la prueba funcional contra datos reales destapa contratos engañosos que `tsc` no ve. Reportar campos base del item sin sus overrides del escenario compilaba en verde y devolvía un `unitSalePrice` correcto, pero con un `marginPct` que no coincidía con el precio. La verificación numérica contra una propuesta concreta es la red que cierra el ciclo.
- Lección de modelo de trabajo: en una iteración intermedia, Claude Code propuso "saltarse el 2FA externo y usar una API key", contradiciendo un requisito explícito. El flujo decisión-primero (ADR-051) lo atajó: la sugerencia se descartó en el chat antes de tocar código. La regla quedó reforzada — Claude Code ejecuta, no decide alcance.
- Para producción quedará pendiente: sumar el origen público de la app externa a `CORS_ORIGIN` de Railway, generar y configurar `EXTERNAL_JWT_SECRET` en Railway, y desplegar el branch tras el merge. Ninguno aplica ahora.

#### Archivos

- `apps/api/package.json` — declara `"@repo/pricing-engine": "workspace:*"`
- `apps/api/.env.example` — documenta `EXTERNAL_JWT_SECRET` requerido
- `apps/api/.env` (local, no versionado) — `EXTERNAL_JWT_SECRET` generado + `http://localhost:8080` agregado a `CORS_ORIGIN`
- `apps/api/src/auth/auth.module.ts` — `EmailVerificationService` agregado al array `exports` (única modificación al auth interno)
- `apps/api/src/app.module.ts` — `ExternalModule` agregado al array `imports`
- `apps/api/src/external/external.module.ts` (nuevo) — registra `JwtModule.register` con `EXTERNAL_JWT_SECRET`, `PassportModule`, `AuthModule`, `UsersModule`, `PrismaModule`, la estrategia `ExternalJwtStrategy`, los services `ExternalAuthService` y `ExternalProposalsService`, y el `ExternalController`
- `apps/api/src/external/external-jwt.strategy.ts` (nuevo) — estrategia Passport `'jwt-external'`, lee `EXTERNAL_JWT_SECRET`, `validate()` confirma usuario activo contra DB y devuelve `ExternalAuthUser { id, email }`
- `apps/api/src/external/external-jwt-auth.guard.ts` (nuevo) — `AuthGuard('jwt-external')`
- `apps/api/src/external/external-auth.service.ts` (nuevo) — reusa `AuthService.validateUser`, `AuthService.login`, `AuthService.resendCode`, `EmailVerificationService.verifyCode`; firma el token externo con el `JwtService` del módulo y payload reducido
- `apps/api/src/external/external.controller.ts` (nuevo) — `POST /external/login`, `POST /external/verify-code`, `POST /external/resend-code`, `GET /external/proposals` (este último protegido por `ExternalJwtAuthGuard`)
- `apps/api/src/external/dto/external-auth.dto.ts` (nuevo) — DTOs `ExternalLoginDto`, `ExternalVerifyCodeDto`, `ExternalResendCodeDto` con `class-validator`; tipos `ExternalJwtPayload`, `ExternalAuthUser`, `ExternalVerificationPendingResponse`, `ExternalLoginResponse`
- `apps/api/src/external/external-proposals.types.ts` (nuevo) — `externalProposalInclude` (Prisma include con `satisfies Prisma.ProposalInclude`) y `ExternalProposalWithRelations` derivado con `Prisma.ProposalGetPayload`
- `apps/api/src/external/dto/external-proposals.dto.ts` (nuevo) — interfaces `ExternalProposalOut`, `ExternalScenarioOut`, `ExternalItemOut`, `ExternalChildItemOut` (DTO de salida con base + overrides + `unitSalePrice` para raíz; sin `unitSalePrice` en hijos)
- `apps/api/src/external/external-proposals.service.ts` (nuevo) — `getWonProposals(userId)`: findMany con filtro `userId + GANADA + deletedAt: null`, mapeo Prisma→pricing-engine con cast de `Decimal`, cálculo de `unitSalePrice` por item raíz, armado del DTO de salida
- `pnpm-lock.yaml` — link de workspace de `@repo/pricing-engine` para `apps/api`

#### Commits

- `78e470d` — `feat(api): add external read-only API auth module with scoped JWT` (módulo `/external` completo del auth: dto, estrategia, guard, service, controller, module; declara `@repo/pricing-engine` en api; documenta `EXTERNAL_JWT_SECRET` en `.env.example`; suma `EmailVerificationService` a exports de `AuthModule`)
- `71536ab` — `feat(api): add GET /external/proposals returning won proposals with sale prices` (tipos del include, DTO de salida, service con consulta + mapeo + cálculo, cableado del service en el módulo y del endpoint en el controller)
- Pendiente — commit de este ADR-053 (`docs: ADR-053 external read-only API module with scoped JWT`)

#### Pendientes

- **Push a `master`** (lo hace Luis tras confirmar que no hay usuarios en producción) — incluye los cuatro commits del branch (`0254690`, `d58ef48`, `78e470d`, `71536ab`) más el commit de este ADR.
- **Verificación numérica adicional en browser** comparando el `unitSalePrice` devuelto por `GET /external/proposals` contra la app principal para una muestra más amplia de propuestas (la verificación inicial cubrió una propuesta con `marginPctOverride`; conviene cubrir también casos con `unitPriceOverride`, items diluidos y items con hijos antes del merge a `master`).
- **Túnel ngrok** para exponer `apps/api` local con una URL pública temporal y entregársela a Felipe junto al documento de contrato de la API. No es código del repo: queda como tarea operativa.
- **Documento de contrato de la API** para Felipe (endpoints, flujo 2FA, formato del token, payload completo de `GET /external/proposals`, header `ngrok-skip-browser-warning`). Documentación operativa, fuera del repo.
- **Configuración de producción para `/external`** al desplegar: agregar `EXTERNAL_JWT_SECRET` (hex 64 chars distinto del de local) a Railway, sumar el origen público de la app de Felipe a `CORS_ORIGIN` de Railway, y validar el flujo extremo a extremo en producción tras el push.
- **Limpieza de duplicado de `RESEND_API_KEY` y `RESEND_FROM`** en el `.env` local detectada durante el paso 4 (no afecta funcionalidad: Node usa la última definición). Tarea menor de higiene, no bloquea nada.

### Consecuencias

- Las menciones a ADR-052 en ADR-079, ADR-089 y ADR-096 dejan de ser colgantes; ADR-053 queda documentado por primera vez en master.
- El diseño de auth de `/external` tiene ahora rastro en la bitácora.
- El protocolo §4.1 queda intacto: el último heading de nivel 2 del archivo es este ADR-097.
- Drift registrado sin corregir aquí: el título de CONVENTIONS §J sigue nombrando lib/pricing-engine.ts, la ruta pre-extracción; nunca se actualizó tras ADR-052.

### Archivos

DECISIONS.md.

### Commits

Los commits cuya prosa se recupera, todos en master vía ce4715e:

- `d58ef48` — refactor: extract pricing-engine to @repo/pricing-engine package (implementación del 052)
- `78e470d` — feat(api): add external read-only API auth module with scoped JWT (053)
- `71536ab` — feat(api): add GET /external/proposals returning won proposals with sale prices (053)
- `0254690` y `b463cac` — los commits de docs que introdujeron los ADR originales en la rama.

### Pendientes

- Actualizar CONVENTIONS §J para nombrar @repo/pricing-engine como fuente canónica del cálculo (edición quirúrgica vía Claude Code, commit aparte).
- Guardia anti-pérdida para el protocolo de merge (INSTRUCTIVO §4): al resolver conflictos en DECISIONS.md, verificar que el conjunto de headings del resultado sea la unión de los dos lados antes de commitear el merge.

## ADR-098 — Watch paths por servicio en Railway: fin de los rebuilds triples por push

**Fecha:** 2026-08-18
**Estado:** Aceptado

### Contexto

Los tres servicios de Railway (web, novotechflow, api-external) apuntan al mismo repo y rama con rootDirectory vacío y, hasta esta decisión, `watchPatterns: []`: cualquier push a master reconstruía y redesplegaba los tres, tocara lo que tocara. Evidencia dura del desperdicio: el push de `c94c2cb` (2026-08-17, solo `DECISIONS.md` + un archivo de apps/web) rebuildeo los tres; los imageDigest de novotechflow y api-external quedaron bit-idénticos a los del deploy anterior — dos builds completos y dos redeploys para producir la misma imagen, con el `prisma migrate deploy` del arranque de novotechflow re-ejecutándose (no-op) contra la base de producción en cada commit de docs.

El reconocimiento de solo lectura estableció además: no existe config-as-code (`railway.json`/`railway.toml`/`.railway/railway.ts` — cero hits; toda la configuración vive en el dashboard); los watch paths se leen por `railway status --json` (`serviceManifest.build.watchPatterns`) y se escriben por MCP `update_service` (parámetro tipado `watch_patterns`), CLI dot-path o dashboard; novotechflow y api-external comparten `apps/api/Dockerfile` y difieren únicamente en el startCommand (`node dist/src/main-external.js`, override de ADR-081); y el conjunto de rutas que cada build consume incluye cuatro archivos raíz fáciles de olvidar (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dockerignore`) además de `packages/**` y el `apps/<x>/**` propio.

### Decisión

Watch patterns por servicio, escritos vía MCP `update_service`:

- web: `apps/web/**`, `packages/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dockerignore`
- novotechflow y api-external (idénticos): `apps/api/**`, `packages/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dockerignore`

Tres criterios de diseño. Primero, archivos raíz sin ancla (`package.json`, no `/package.json`): la semántica exacta de anclaje de Railway no es observable sin experimentar, y el riesgo es asimétrico — un patrón laxo produce a lo sumo un build de más (el status quo previo), un ancla no soportada produce imagen vieja tras un cambio real, que es el fallo peligroso. El falso positivo residual (el `package.json` de una app disparando al otro servicio) queda absorbido porque esos cambios casi siempre mueven el lockfile, único y compartido. Segundo, los gemelos novotechflow/api-external llevan conjuntos idénticos como invariante: comparten Dockerfile e imagen; si divergieran, un cambio en apps/api rebuildearía uno y dejaría al otro con una imagen vieja — skew entre dos APIs que comparten schema de DB y lógica de pricing. Sin config-as-code no hay tooling que fuerce la igualdad: queda documentada aquí y es verificable por `status --json`. Tercero, exclusiones conscientes: los `.md` de gobernanza, `.github/**`, `turbo.json`, `scripts/`, `backups/` no participan en ninguna imagen y quedan fuera a propósito.

La escritura se ejecutó con verificación de no-regresión: pre-flight del schema del MCP (todos los parámetros opcionales con default null — patch parcial, no replace), confirmación empírica tras el primer servicio, y el startCommand de api-external verificado intacto antes, inmediatamente después de su escritura y en la lectura final. Cambiar watch patterns no disparó redeploys (no altera la imagen corriente).

Alternativas descartadas: `railway environment edit --service-config` (formato dot-path dudoso para arrays); config-as-code `.railway/railway.ts` + `config apply` (exigiría crear y versionar el archivo; queda como evolución natural si se quiere el invariante de gemelos bajo control de versiones); dashboard manual (válido, pero el MCP deja la operación dentro del flujo aprobación-por-operación del proyecto).

### Consecuencias

- Validación negativa ejecutada y PASÓ: el push de `71b736c` (solo `CONVENTIONS.md` + `INSTRUCTIVO_CLAUDE.md`) produjo en los tres servicios un registro `SKIPPED` con `skippedReason: "No changes to watched files"` — confirmación textual de Railway de que evaluó y filtró — con cero builds, cero redeploys y las tres imágenes de producción intactas en `c94c2cb`, estable en tres rondas de observación espaciadas 60 s. Railway deja rastro auditable del filtrado en vez de silencio.
- Validación positiva pendiente: el próximo push que toque rutas vigiladas debe rebuildear exactamente los servicios correctos. Hasta entonces, mantener el hábito de `railway deployment list` tras cada push.
- Los patterns viven solo en Railway, sin fuente versionada. Al crear un servicio nuevo o clonar entorno, hay que recordarlos a mano. La igualdad de gemelos se re-verifica por `status --json` ante cualquier duda.
- `VITE_API_URL` se hornea en build-time (ARG del Dockerfile de web): su rotación redeploya por el flujo de cambio-de-variable de Railway, no por watch paths.
- El MCP local de Railway quedó confirmado operativo (lectura por `get_service_config`, escritura por `update_service`): el pendiente opcional de cablearlo, arrastrado desde el traspaso, muere aquí.
- Colateral de seguridad registrado: `railway environment config --json` vuelca todos los secretos del entorno en claro (segunda vía de leak del CLI tras `variable list`). Protocolo: volcar a archivo sin imprimir, extraer por script solo campos de build/deploy, borrar el volcado. El MCP `get_service_config` es la vía segura (reporta counts, no valores).

### Archivos

Ninguno del repo: la configuración vive en Railway. DECISIONS.md (este ADR).

### Commits

Sin commits de código. Pushes citados como evidencia: `c94c2cb` (rebuilds triples con imágenes bit-idénticas, motivación) y `71b736c` (prueba negativa, SKIPPED en los tres servicios). Este ADR viaja en su propio commit de docs.

### Pendientes

- Validación positiva con el próximo push que toque `apps/**` o `packages/**` o los archivos raíz vigilados.
- Evaluar config-as-code (`.railway/railway.ts` + `railway config apply`) para versionar los patterns y el invariante de gemelos, cuando amerite.

## ADR-099 — Cohorte G: majors fuera de cohorte y lockstep de Node 22 a 24

**Fecha:** 2026-08-18
**Estado:** Aceptado

### Contexto

Cerrada la Cohorte F (ADR-095), quedaban en cola cuatro majors fuera de cohorte: framer-motion 13, lucide-react 1.x, @types/supertest 7 y @types/node. Se abordaron con el método de F: reconocimiento de solo lectura del repo (superficie de uso real por paquete), cruce contra changelogs oficiales, bumps atómicos con gates por commit y cierre documental. El reconocimiento arrojó una superficie mínima: framer-motion importa únicamente `motion` y `AnimatePresence` en 24 archivos (prop `layout` sin `layoutId`, `AnimatePresence` con `mode="popLayout"`/`"wait"`, cero hooks, cero gestos, cero `variants`); lucide-react importa 92 especificadores únicos (91 íconos + el tipo `LucideIcon`), ninguno de marca; supertest tiene un único consumidor (`apps/api/test/app.e2e-spec.ts`, default import, sin anotaciones de tipo del paquete); y `@types/node@22.20.1` era ya el último de la línea 22.

El cuarto bump destapó la decisión real de la cohorte: `@types/node` se alinea al runtime, nunca por delante, así que la pregunta no era "¿@types/node 26?" sino "¿en qué Node corre el proyecto?". Calendario oficial (nodejs/Release): la línea 22 está en Maintenance LTS con EOL 2027-04-30 (~8 meses); la 24 es Active LTS con EOL 2028-04-30; la 26 es Current y no entra en LTS hasta 2026-10-28 — pinnear un Current en producción se descartó. Quedarse en 22 disolvía el bump en no-op pero obligaba a una mini-cohorte forzada en Q1 2027; subir a 24 aprovechaba el andamiaje de guardias ya montado (test de imagen de ADR-095) con costo marginal.

### Decisión

Cuatro bumps en orden de riesgo creciente, un commit atómico con gates por cada uno:

1. **@types/supertest 6.0.3 → 7.2.1** (api, dev): alineación con supertest 7.2.2 ya en uso. Riesgo nulo confirmado; el lock solo movió esa entrada, sin duplicar `@types/superagent`.
2. **lucide-react 0.577.0 → 1.32.0** (web): el breaking de v1 es la remoción de los íconos de marca (Chromium, Codepen, Facebook, Figma, Github, Slack, etc.); ninguno en uso, verificado empíricamente contra 1.32.0 instalado — los 92 especificadores del repo existen todos. v1 además elimina el build UMD (irrelevante: Vite consume ESM) y pone `aria-hidden="true"` por defecto en los íconos (cambio conductual de accesibilidad, no de build).
3. **framer-motion 12.43.0 → 13.1.0** (web): el único breaking de 13.0 es la remoción de `@emotion/is-prop-valid` como peer opcional, que solo afecta CSS-in-JS (styled-components/Emotion) — cero superficie en este repo (Tailwind puro). Confirmación empírica: el bundle de producción construido con la 12 contenía el stub de error del import opcional (`Could not resolve "@emotion/is-prop-valid"...`); tras el bump el stub desapareció de `dist/` por completo. `motion-dom` y `motion-utils` acompañaron a la línea 13. Nota: río arriba el paquete se llama ahora `motion`; `framer-motion` sigue publicándose en lockstep y migrar el nombre queda fuera de alcance.
4. **Lockstep Node 22 → 24** en un solo commit: `node:24-alpine` en los cuatro stages con Node (builder, prod-deps y runner del api; builder del web — el runner nginx no cambia), `node-version: 24` en los tres `setup-node` de CI, `engines.node >=24.0.0` en la raíz y `@types/node ^24.13.3` en web y api. Única dependencia transitiva movida: `undici-types` 6.21.0 → 7.18.2. El Node local se actualizó a 24.19.0 vía nvm-windows (1.1.11, ya instalado; la 22.22.2 queda instalada como rollback inmediato con `nvm use`, recordando que los globals de nvm son por versión: pnpm se reinstala global bajo la versión activa).

Guardia de ADR-095 ejecutada antes del push por cambio de runtime: ambas imágenes construidas desde `git archive` del HEAD (1274b75) con `--no-cache`. API: base `node:24-alpine` (digest d32cdf61…), `prisma generate` en verde con su placeholder de `DATABASE_URL` scoped al RUN, cero descarga de engines, `migrate deploy` no-op (35 migraciones, ninguna pendiente), Nest con 94 rutas mapeadas y sonda 200. Web: builder en el mismo digest, runner nginx, sonda 200 con las cabeceras de seguridad de `nginx.conf` presentes. Node dentro del contenedor: v24.19.0, idéntico al local.

### Consecuencias

- Producción, CI y local corren la misma línea Node 24 (v24.19.0 en los tres planos, mismo digest de imagen validado en local y en Railway). Runway de LTS hasta 2028-04-30; la paridad local-producción de ADR-041 queda restaurada tras el salto.
- Post-push verificado: CI (run 32174890830) en verde con `node: v24.19.0` en ambos jobs; deployments SUCCESS de los tres servicios en 1274b75; sondas 200 en api y web.
- **La validación positiva pendiente de ADR-098 queda cerrada.** Los tres servicios construyeron para este push porque `package.json` raíz y `pnpm-lock.yaml` — vigilados por los tres — cambiaron: comportamiento exactamente esperado, no regresión a los rebuilds triples (aquel problema era construir sin que nada vigilado cambiara). `.github/workflows/**` no está vigilado y correctamente no participó.
- **Hallazgo operativo:** `RESEND_API_KEY` es fail-fast en el arranque del api (`apps/api/src/auth/email-verification.service.ts`, desde 5525b5d, 2026-04-13) y no figuraba en el set documentado. El set mínimo de env para cualquier arranque local del api es: `DATABASE_URL`, `JWT_SECRET`, `EXTERNAL_JWT_SECRET`, `CORS_ORIGIN`, `GEMINI_API_KEY` y `RESEND_API_KEY` (dummies válidos salvo `DATABASE_URL`).
- `aria-hidden="true"` por defecto en lucide v1: pendiente de cola fría auditar botones cuyo único contenido accesible sea un ícono (a11y, no build). Verificación visual de trazos de íconos v1 hecha por Luis en local.
- Residuo menor: directorios `.pnpm/motion-*@12.*` sin referencias en el lock; un `pnpm store prune` eventual los limpia.

### Archivos

- `apps/api/package.json`, `apps/web/package.json` (rangos y @types/node), `package.json` raíz (engines), `pnpm-lock.yaml`
- `apps/api/Dockerfile` (3 stages a node:24-alpine), `apps/web/Dockerfile` (builder a node:24-alpine)
- `.github/workflows/ci.yml`, `.github/workflows/pr-check.yml` (node-version 24)
- DECISIONS.md (este ADR)

### Commits

- b3dc2d2 — @types/supertest 6.0.3 → 7.2.1
- a285197 — lucide-react 0.577.0 → 1.32.0
- 148db8e — framer-motion 12.43.0 → 13.1.0
- 1274b75 — lockstep Node 22 → 24 (Dockerfiles, CI, engines, @types/node)

### Pendientes

- Cola fría: imagen del api en 1.08 GB dominada por node_modules hoisted del stage de producción — candidato a adelgazamiento (tarea siguiente, con recon propio).
- Cola fría: auditoría a11y de botones con ícono como único contenido (`aria-hidden` por defecto de lucide v1).

## ADR-100 — Imagen de producción del api: pnpm deploy, poda del CLI de Prisma y query compilers solo-PostgreSQL

**Fecha:** 2026-08-18
**Estado:** Aceptado

### Contexto

El test de imagen de la Cohorte G (ADR-099) dejó medida la imagen del api: 1.08 GB en disco, 834.8 MB de filesystem real, dominados por un node_modules de 662.3 MB. El reconocimiento por capas atribuyó el peso a cuatro bloques: el subárbol del CLI de Prisma (~229 MB, presente solo para ejecutar `migrate deploy` en el arranque), polizones del frontend materializados por el hoisting del workspace (~119 MB: lucide-react, jspdf, tiptap y la cadena React), los query compilers WASM de motores que el proyecto no usa dentro de `@prisma/client/runtime` (~57 MB: sqlserver, cockroachdb, mysql y sqlite, duplicados en .js/.mjs y fast/small), y ~175 MB de base node:24-alpine (incluidos 5.5 MB de yarn que nada invoca). La causa raíz de los polizones: el stage prod-deps instalaba con `pnpm install --frozen-lockfile --filter api... --prod --config.node-linker=hoisted` desde la raíz del workspace, y el hoisting materializa el universo de producción del monorepo completo, no el árbol del api. Un hallazgo del recon inverso corrigió una atribución: react-dom, @radix-ui y @visx no eran fuga del web — entran por `@prisma/studio-core`, dependencia del CLI `prisma`.

### Decisión

Rediseño del Dockerfile del api en un solo commit, con smoke iterativo autorizado únicamente sobre la lista de podas (restaurar el ítem que rompa):

1. **prod-deps reemplazado por un stage `deploy`** que parte del builder y corre `pnpm --filter api deploy --prod --legacy --config.node-linker=hoisted /deployed`. El flag `--legacy` fue obligatorio (pnpm 10 exige `inject-workspace-packages=true` para deploy sin él, y tocar la configuración del workspace quedó fuera de alcance); `node-linker=hoisted` es necesario para que las podas por rm operen sobre directorios reales y no symlinks. El deploy trae `@repo/item-display` y `@repo/pricing-engine` resueltos con su dist, lo que eliminó las dos inyecciones manuales de `@repo/*` que el runner hacía por COPY. Solo por el deploy desaparecieron los polizones del web (662.3 → 498.5 MB antes de podar).
2. **Podas en el stage deploy, antes del COPY al runner** — podar después del COPY solo crea whiteouts: el du interno baja pero los bytes viajan igual en el pull. Aplicadas: query compilers no-PostgreSQL (32 archivos, ~55 MB; el cliente generado solo carga `query_compiler_fast_bg.postgresql.*`), `@electric-sql` (25.3 MB), `typescript` (23.6 MB — exonerado el temor de ADR-095: `prisma.config.ts` lo carga el jiti/c12 embebido en `@prisma/config`), `elkjs` + `@visx` (11.9 MB), el cierre UI de studio-core (react, react-dom, scheduler, @radix-ui, d3-*, internmap, ~12 MB) y `dist/ui` de `@prisma/studio-core` (28.7 MB de UI React que el CLI jamás carga: solo usa `dist/data/bff/index.cjs`, con guardia `test -f` en el propio stage). En el runner: rm del yarn de la base (whiteout asumido, ~10 MB de pull no recuperables).
3. **Podas revertidas por fallo empírico** (require-time del CLI en `migrate deploy`): `@prisma/studio-core` completo (su cli.js requiere `studio-core/data/bff` al arrancar), `@prisma/dev` (requiere `internal/state`) y `effect` (dep de `@prisma/config`). `happy-dom` resultó innecesaria: el propio deploy no la trae. `mysql2` (928 KB) y ~7 MB de chunks sueltos de studio-core quedaron fuera de alcance por no pagar su verificación.

Resultado: **834.8 → 568.3 MB de filesystem (−31.9%)**, node_modules **662.3 → 379.6 MB (−42.7%)**, tamaño Docker 1.08 GB → 704 MB. Guardia de ADR-095 ejecutada: build desde `git archive` del HEAD con `--no-cache`, con paridad exacta contra el smoke del working tree (568.3/379.6 MB idénticos), migrate deploy no-op, 94 rutas, sonda 200, Node v24.19.0 en contenedor.

### Consecuencias

- El push (docs de ADR-099 + este Dockerfile) coincidió con el incidente de Railway "Deployments are slow to progress" (18-ago 21:45 UTC): ambos api construyeron y pushearon imagen correctamente y fallaron después, en el arranque del contenedor, con deploy logs vacíos y `configErrors: ["Failed to connect before the deadline"]`. Producción nunca cayó (siguió sirviendo 1274b75). El redeploy manual post-incidente cerró en SUCCESS: novotechflow rebuildeó con caché total y reemitió el `containerimage.digest` idéntico (sha256:664d1237…) al del intento fallido — misma imagen byte a byte —; api-external reutilizó la imagen ya pusheada sin rebuild (build log de 2 líneas).
- Evidencia adicional de ADR-098 (filtrado selectivo): novotechflow y api-external construyeron (apps/api/** vigilado por ambos) y web quedó SKIPPED con `skippedReason: "No changes to watched files"` — tercera validación, primera de filtrado parcial.
- Trampas de lectura del CLI de Railway, documentadas para no reincidir: (1) `configErrors` persiste en el meta de deployments SUCCESS como artefacto del intento fallido — el veredicto real es `status`; (2) el campo `imageDigest` del meta es un identificador del registro interno de Railway, único por deployment, NO comparable con el `containerimage.digest` OCI de los build logs; los deployments FAILED ni siquiera lo traen.
- api-external no corre `migrate deploy`: su startCommand (`node dist/src/main-external.js`) sobrescribe el CMD. Solo el api principal migra — correcto y verificado.
- Cada bump futuro de Prisma re-verifica las podas del CLI en el test de imagen: la separabilidad de studio-core/dev/effect y la carga exclusiva del compiler postgresql son internals no contractuales.
- Los tags locales de prueba (`novotechflow-api:node24-test`, `slim-test`, `slim-archive-test`) quedan liberables tras este cierre.

### Archivos

- `apps/api/Dockerfile` (stage deploy nuevo, podas, runner sin inyecciones manuales de @repo/*)
- DECISIONS.md (este ADR)

### Commits

- 02ac06b — chore(api): imagen de produccion via pnpm deploy + poda de CLI prisma y query compilers no-pg

### Pendientes

- **Pinning del árbol desplegado:** el build de Railway avisa `A pnpm-lock.yaml file exists. The current configuration prohibits to read or write a lockfile` — `pnpm deploy --legacy` re-resuelve desde los rangos del package.json en vez del lock, perdiendo el pinning que daba el `--frozen-lockfile` del viejo prod-deps. Alternativa a evaluar con recon propio: `inject-workspace-packages=true` en el workspace + deploy sin `--legacy` (recupera el lockfile, cambia el layout local de los @repo/* en todo el monorepo).
- Cola fría: auditoría a11y de íconos (arrastrada de ADR-099).

## ADR-101 — Pinning del árbol desplegado: injectWorkspacePackages y retiro de --legacy

**Fecha:** 2026-08-19
**Estado:** Aceptado

### Contexto

ADR-100 dejó como pendiente el aviso del build de Railway: `pnpm deploy --legacy` prohibía leer el lockfile. El reconocimiento empírico (copia del repo por git archive, fuera del working tree) lo confirmó y lo cuantificó: `--legacy` re-resuelve desde el registry (`downloaded 6` en su progreso) y la producción desplegada desde 02ac06b traía 6 paquetes por delante del lock — @nestjs/swagger 11.4.7 vs 11.4.6, @types/pg 8.23.1 vs 8.21.0, content-type 2.1.0, dayjs 1.11.23, libphonenumber-js 1.13.11 y swagger-ui-dist 5.32.13 —, un conjunto determinista contra el estado del registry pero creciente en el tiempo dentro de los rangos caret. El pinning que daba el `--frozen-lockfile` del viejo prod-deps estaba roto de facto desde 02ac06b.

El mismo recon desarmó el riesgo que ADR-100 atribuía a la alternativa: con `injectWorkspacePackages: true`, en este monorepo el layout local NO cambia — los @repo/* siguen siendo symlinks al paquete fuente (cero entradas file+ en el virtual store), el ciclo editar→build→correr sobrevive sin re-install (verificado por inodo compartido entre packages/pricing-engine/dist y apps/api/node_modules), y el lock gana exactamente una línea en su bloque settings, sin mover ninguna versión. El flag actúa aquí solo como compuerta del deploy. Los tres árboles desplegados (legacy, injected, injected-limpio) pesan lo mismo (~506 MB); trampa de medición documentada: `du -sh a b c` en una sola invocación deduplica hard links entre argumentos — medir árboles pnpm de a uno.

### Decisión

Tres archivos en un commit atómico: `injectWorkspacePackages: true` en pnpm-workspace.yaml, la línea correspondiente en el bloque settings de pnpm-lock.yaml, y el retiro de `--legacy` del RUN de pnpm deploy en apps/api/Dockerfile. La atomicidad no es estética: cambiar el flag sin actualizar el lock produce `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` en cualquier install con `--frozen-lockfile` — el CI habría fallado si el lock no viajara en el mismo commit. La transición local exige un único `pnpm install --no-frozen-lockfile` que registra el setting.

Verificación en tres planos: gates completos; smoke desde working tree y guardia ADR-095 desde git archive con paridad exacta (568.3 MB / 379.6 MB, sin regresión de ADR-100) y la prueba dura del pinning dentro del contenedor — los 6 paquetes drifteados de vuelta a sus versiones del lock, con la firma `resolved 0, reused 437, downloaded 0` en el progreso del deploy y cero avisos de lockfile; y producción, donde el build del web con `--frozen-lockfile` aceptó el setting sin fricción, cerrando el riesgo de CI.

### Consecuencias

- Las imágenes de producción del api vuelven a estar pinneadas por el lockfile; el drift de 6 paquetes se revirtió al activar e427f3a (los "retrocesos" de versión son el pinning restaurándose).
- El push coincidió con la reaparición del incidente de Railway "Deployments are slow to progress" (18-19 ago), esta vez con el plano de control también degradado (CLI colgado, OAuth 500, MCP Unauthorized). Producción nunca se afectó (plano de datos intacto). Lecciones operativas para el CLI de Railway, sumadas a las trampas de ADR-100: (1) deployments REMOVED con build log vacío y sin imageDigest son víctimas de incidente de plataforma, no cancelaciones humanas — los tres REMOVED de e427f3a nunca construyeron; (2) `railway redeploy` a secas re-despliega el último deployment *desplegable* (con imagen), no la última entrada de la lista — sobre un REMOVED sin imagen cae al deployment activo anterior (así se gastó un ciclo re-desplegando 02ac06b); la vía correcta para construir el HEAD de la rama es `railway redeploy --from-source`; (3) durante incidentes del plano de control, las sondas HTTP a producción siguen siendo el termómetro fiable.
- Quinta validación de watch paths (ADR-098): pnpm-workspace.yaml y pnpm-lock.yaml, vigilados por los tres servicios, dispararon los tres builds.
- El pendiente de pinning de ADR-100 queda cerrado. Guardia heredada: los bumps de Prisma re-verifican las podas del CLI (ADR-100) en el test de imagen; el deploy sin --legacy queda cubierto por la misma corrida.

### Archivos

- pnpm-workspace.yaml (injectWorkspacePackages: true)
- pnpm-lock.yaml (settings, una línea)
- apps/api/Dockerfile (RUN de deploy sin --legacy)
- DECISIONS.md (este ADR)

### Commits

- e427f3a — chore: pinning del deploy restaurado via injectWorkspacePackages, sin --legacy

### Pendientes

- Ninguno propio. Cola fría del proyecto sin cambios: border-color + App.css (ADR-094), auditoría a11y de íconos (ADR-099), mysql2 y chunks residuales de studio-core (ADR-100).

## ADR-102 — Cierre retroactivo de los pendientes de ADR-094: retiro del bloque compat de border-color y borrado de App.css

**Fecha:** 2026-08-19
**Estado:** Aceptado

### Contexto

ADR-094 conservó el bloque de compatibilidad de border-color que insertó la tool de upgrade de Tailwind v4 (`border-color: var(--color-gray-200, currentcolor)` sobre `*`, `::after`, `::before`, `::backdrop`, `::file-selector-button` en `apps/web/src/index.css`) y dejó dos pendientes: retirarlo previa auditoría de los elementos que dependieran del default, y borrar `apps/web/src/App.css` (CSS huérfano del starter de Vite). El 2026-08-17, el commit `c0ff90a` ejecutó ambos retiros sin la auditoría previa que el pendiente exigía y sin cierre documental; el commit llegó a `origin/master` y producción corre sin el bloque desde el push de ADR-101, sin regresiones visuales reportadas. El reconocimiento de solo lectura del 2026-08-19 aportó la auditoría a posteriori.

### Decisión

Validar el retiro retroactivamente con la auditoría completa y cerrar ambos pendientes de ADR-094. Resultados de la auditoría sobre `apps/web/src` (133 archivos, todos los literales de string, no solo `className`):

- **341 literales** con utilidad de ancho de borde o divide, en 69 archivos; **cero dependen del default**. Los 34 sospechosos iniciales resultaron cubiertos por: color en el mismo literal, objetos de configuración interpolados con color en todas sus entradas (`STATUS_CONFIG`, `ACQUISITION_CONFIG`, `PAGE_TYPE_STYLES`, `SEVERITY_STYLES`, `CARD_THEMES`, `SECTION_THEMES`, `SPEC_CHIP_COLOR_BY_FIELD` con fallback), ambas ramas de ternarios/`cn()`, o `style={{ borderColor }}` inline (`CodeDigitInputs.tsx`).
- `divide-y`: 7 usos, todos con `divide-{color}` en el mismo literal. Cero desajustes de lado (ancho en un lado, color en otro). Cero `<hr>` en el código fuente. Los 8 `type="file"` sin utilidades de borde ni `file:border-*`.
- HTML inyectado por tiptap (`generateHTML` → `dangerouslySetInnerHTML`): puede producir `<hr>`, pero ambos destinos son contenedores `.prose` y @tailwindcss/typography define `border-color: var(--tw-prose-hr)` propio. Cubierto.
- `App.css`: cero referencias en todo `apps/web` (código, `index.html`, `vite.config.ts`); solo prosa histórica en DECISIONS.md y copias en `backups/`. Borrado correcto.
- Confirmación en el CSS compilado post-retiro: la regla compat no aparece; el preflight v4 emite `border: 0 solid` sin color, y la única aparición de `var(--color-gray-200)` es la utilidad `.border-gray-200`.

### Consecuencias

- Los dos pendientes de ADR-094 quedan cerrados. Las menciones de cola fría en ADR-094 §Pendientes y ADR-101 §Pendientes quedan superadas por este ADR (DECISIONS.md es append-only; no se editan entradas anteriores).
- Riesgo residual documentado: el preflight de v4 no define border-color, así que cualquier utilidad de ancho de borde nueva sin color explícito en su estado base, o un `<hr>` futuro fuera de un contenedor `.prose`, renderiza con `currentcolor`. Regla práctica vigente: toda utilidad de ancho de borde o divide lleva color explícito en el mismo literal.
- Lección de método: el retiro se ejecutó antes de la auditoría que lo condicionaba; el resultado fue benigno (0/341), pero el orden correcto — auditar antes de retirar un shim — se mantiene como protocolo para futuros retiros de bloques de compatibilidad.

### Archivos

- `apps/web/src/index.css` (bloque compat retirado) y `apps/web/src/App.css` (eliminado) — ambos en `c0ff90a`.
- DECISIONS.md (este ADR).

### Commits

- `c0ff90a` (2026-08-17) — chore(web): retirar bloque compat de border-color y borrar App.css huerfano (cola fria ADR-094).
- El commit docs de este ADR.
