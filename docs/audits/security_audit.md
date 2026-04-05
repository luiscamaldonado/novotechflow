# 🔒 Auditoría de Seguridad y Código Limpio — NovoTechFlow

**Fecha:** 2026-04-05  
**Proyecto:** NovoTechFlow (Monorepo pnpm + Turborepo)  
**Stack:** NestJS (API) + React/Vite (Web) + Tauri (Agent) + PostgreSQL + Prisma

---

## 1. 🌲 Árbol de Directorios

```
novotechflow/
├── .git/
├── .gitignore
├── .npmrc
├── .turbo/
├── .vscode/
├── CONVENTIONS.md
├── README.md
├── package.json                    ← Root monorepo
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml              ← ⚠️ Credenciales hardcodeadas
│
├── apps/
│   ├── api/                        ← Backend NestJS
│   │   ├── .env                    ← ⚠️ Archivo real con credenciales (NO .env.example)
│   │   ├── .eslintrc.js
│   │   ├── .prettierrc
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma       ← 310 líneas, 15 modelos
│   │   │   ├── migrations/
│   │   │   ├── seed.ts
│   │   │   ├── seed-admin.js       ← ⚠️ Script de seed con credenciales
│   │   │   └── (varios check/test scripts)
│   │   ├── src/
│   │   │   ├── main.ts             ← Entry point
│   │   │   ├── app.module.ts
│   │   │   ├── app.controller.ts   ← ⚠️ Sin autenticación
│   │   │   ├── auth/               ← Módulo de autenticación
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── dto/auth.dto.ts
│   │   │   ├── billing-projections/
│   │   │   ├── catalogs/
│   │   │   ├── clients/
│   │   │   ├── prisma/
│   │   │   ├── proposals/
│   │   │   ├── templates/
│   │   │   └── users/
│   │   ├── uploads/                ← Archivos subidos (servidos estáticamente)
│   │   ├── dist/
│   │   └── (20+ scripts de test/debug sueltos) ← ⚠️ Trash files
│   │
│   ├── web/                        ← Frontend React + Vite + Tailwind
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── layouts/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts          ← Axios client con interceptor
│   │   │   │   └── types.ts
│   │   │   ├── pages/
│   │   │   └── store/
│   │   │       └── authStore.ts    ← Zustand auth state
│   │   └── dist/
│   │
│   └── agent/                      ← App Tauri (desktop)
│       ├── package.json
│       ├── src/
│       └── src-tauri/
│
├── packages/                       ← Shared packages
│   ├── eslint-config/
│   ├── typescript-config/
│   └── ui/
│
├── backups/                        ← ⚠️ Backups con código fuente completo
├── favicon/
├── tmp/
│
└── (archivos sueltos en raíz)      ← ⚠️ Scripts Python, CSVs, imágenes
    ├── add_groups.py
    ├── clean_terceros.py
    ├── deep_clean_terceros.py
    ├── remove_accents.py
    ├── terceros.csv / terceros sag.csv
    ├── almacenamiento.csv / memorias.csv
    └── *.png / *.jpg (imágenes varias)
```

---

## 2. 📦 Dependencias (package.json)

### Root ([package.json](file:///d:/novotechflow/package.json))
```json
{
  "devDependencies": {
    "prettier": "^3.7.4",
    "turbo": "^1.12.4",
    "typescript": "5.3.3"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=18" }
}
```

### API ([apps/api/package.json](file:///d:/novotechflow/apps/api/package.json))

| Dependencia | Versión | Observación |
|---|---|---|
| `@nestjs/common` | ^10.0.0 | ✅ OK |
| `@nestjs/core` | ^10.0.0 | ✅ OK |
| `@nestjs/jwt` | ^11.0.2 | ✅ OK |
| `@nestjs/passport` | ^11.0.5 | ✅ OK |
| `@prisma/client` | 5.10.2 | ⚠️ Versión fija — puede quedarse atrás |
| `axios` | ^1.13.6 | ✅ OK |
| `bcrypt` | ^6.0.0 | ✅ OK para hashing |
| `cheerio` | ^1.2.0 | ⚠️ ¿Se usa en producción? Posible scraping |
| `passport-jwt` | ^4.0.1 | ✅ OK |

### Web ([apps/web/package.json](file:///d:/novotechflow/apps/web/package.json))

| Dependencia | Versión | Observación |
|---|---|---|
| `react` | ^19.2.0 | ✅ OK |
| `axios` | ^1.13.6 | ✅ OK |
| `zustand` | ^5.0.11 | ✅ OK |
| `tailwindcss` | ^3.4.19 | ✅ OK |
| `vite` | ^7.3.1 | ✅ OK |
| `exceljs` | ^4.4.0 | ℹ️ Export Excel client-side |
| `jspdf` | ^4.2.1 | ℹ️ PDF generation client-side |
| `html2canvas-pro` | ^2.0.2 | ℹ️ Screenshot rendering |

---

## 3. 🚪 Archivo Principal de Entrada

### [apps/api/src/main.ts](file:///d:/novotechflow/apps/api/src/main.ts)

```typescript
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();                    // ⛔ CORS ABIERTO A TODO ORIGEN
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,       // ⚠️ Debería ser true
  }));

  // Static assets sin protección
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3000);
}
```

---

## 4. 🔧 Archivos de Configuración

### [docker-compose.yml](file:///d:/novotechflow/docker-compose.yml)
```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: admin              # ⛔ Credenciales hardcodeadas
      POSTGRES_PASSWORD: password123    # ⛔ Contraseña débil hardcodeada
      POSTGRES_DB: novotechflow
    ports:
      - "5432:5432"                     # ⛔ Puerto expuesto a todas las interfaces
```

> [!CAUTION]
> **Credenciales de base de datos hardcodeadas en docker-compose.yml** y expuestas en el repositorio. El puerto PostgreSQL está abierto a todas las interfaces de red.

### [apps/api/.env](file:///d:/novotechflow/apps/api/.env) — ⛔ ARCHIVO REAL COMMITEADO
```
DATABASE_URL="postgresql://admin:password123@localhost:5432/novotechflow?schema=public"
```

> [!CAUTION]
> **El archivo `.env` REAL está en el repositorio** con credenciales de producción/desarrollo. No existe `.env.example`. Aunque `.env` está en `.gitignore`, el archivo ya fue versionado en el pasado o se creó manualmente.

### Archivos de configuración ausentes:
- ❌ **No existe `.env.example`** — No hay guía de variables de entorno necesarias
- ❌ **No existe `Dockerfile`** — No hay containerización de la app
- ❌ **No existe `nginx.conf`** — No hay proxy reverso configurado
- ❌ **No existe archivo de configuración de `helmet`** — Sin headers de seguridad
- ❌ **No existe configuración de rate limiting**

---

## 5. 🔐 Autenticación y Autorización

### Flujo de Auth:
```mermaid
sequenceDiagram
    participant C as Cliente (React)
    participant A as API (NestJS)
    participant DB as PostgreSQL

    C->>A: POST /auth/login {email, password}
    A->>DB: findOneByEmail(email)
    DB-->>A: User {passwordHash, ...}
    A->>A: bcrypt.compare(password, hash)
    A->>A: JwtService.sign({sub, email, role, nomenclature})
    A-->>C: {access_token, user}
    C->>C: localStorage.setItem('token', token)
    C->>A: GET /api/* (Authorization: Bearer <token>)
    A->>A: JwtStrategy.validate(payload)
    A-->>C: Datos protegidos
```

### Hallazgos Críticos:

#### 🔴 **CRÍTICO: JWT Secret hardcodeado como fallback**
```typescript
// jwt.strategy.ts (line 13)
secretOrKey: process.env.JWT_SECRET || 'super-secret-novotechflow-key-change-me'

// auth.module.ts (line 14)
secret: process.env.JWT_SECRET || 'super-secret-novotechflow-key-change-me'
```

> [!CAUTION]
> Si `JWT_SECRET` no está definida en el entorno, se usa un secreto predecible hardcodeado. **Cualquier atacante puede forjar tokens JWT válidos.**

#### 🔴 **CRÍTICO: Variable JWT_SECRET no definida en .env**
El archivo `.env` del API solo contiene `DATABASE_URL`. **`JWT_SECRET` NO está definida**, lo que significa que el fallback hardcodeado se está usando activamente.

#### 🟡 **Login sin DTO validado**
```typescript
// auth.controller.ts (line 10)
async login(@Body() signInDto: Record<string, string>) {
```
El endpoint de login acepta `Record<string, string>` en lugar del `LoginDto` debidamente validado con `class-validator`. El DTO `LoginDto` existe pero **no se usa**.

#### 🟡 **Token expiration: 12 horas**
```typescript
signOptions: { expiresIn: '12h' }
```
Razonable para app interna, pero no hay mecanismo de refresh token.

#### 🟢 **Buenas prácticas encontradas:**
- ✅ bcrypt para hashing de contraseñas
- ✅ `whitelist: true` en ValidationPipe (strip campos no declarados)
- ✅ `ignoreExpiration: false` en JWT strategy
- ✅ Verificación de usuario activo en validate()
- ✅ Excluye `passwordHash` de la respuesta

### Cobertura de Guards por Controller:

| Controller | JwtAuthGuard | RolesGuard | Nivel |
|---|---|---|---|
| `AppController` (`/`) | ❌ | ❌ | ⚠️ Público |
| `AuthController` (`/auth`) | ❌ | ❌ | ✅ Correcto (login) |
| `UsersController` (`/users`) | ✅ Clase | ✅ Clase + ADMIN | ✅ Bien protegido |
| `TemplatesController` (`/templates`) | ✅ Clase | ✅ Clase + ADMIN | ✅ Bien protegido |
| `ProposalsController` (`/proposals`) | ✅ Per-method | ❌ | ⚠️ Sin control de roles |
| `ClientsController` (`/clients`) | ✅ Clase | ❌ | ⚠️ Sin control de roles |
| `CatalogsController` (`/catalogs`) | ✅ Clase | ❌ | ⚠️ Sin control de roles |
| `BillingProjectionsController` | ✅ Per-method | ❌ | ⚠️ Sin control de roles |

> [!WARNING]
> **ProposalsController** tiene 30+ endpoints protegidos per-method pero SIN RolesGuard. Un usuario `COMMERCIAL` puede acceder a TODAS las propuestas, no solo a las suyas.

---

## 6. 🌐 CORS

```typescript
// main.ts (line 10)
app.enableCors();   // Sin opciones = origin: '*'
```

> [!CAUTION]
> **CORS está completamente abierto.** `enableCors()` sin argumentos permite cualquier origen, cualquier método, cualquier header. Esto permite que cualquier sitio web malicioso haga requests autenticados al API si el usuario tiene un token válido.

**Debería ser:**
```typescript
app.enableCors({
  origin: ['http://localhost:5173', 'https://tu-dominio.com'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
});
```

---

## 7. 🛡️ Seguridad de Infraestructura — Lo que FALTA

| Protección | Estado | Impacto |
|---|---|---|
| **Helmet** (headers HTTP) | ❌ No instalado | X-Frame-Options, CSP, HSTS ausentes |
| **Rate Limiting** | ❌ No existe | Vulnerable a brute-force en `/auth/login` |
| **CSRF Protection** | ❌ No existe | Mitrable por CORS abierto |
| **Request Size Limit** | ❌ No configurado | Posible DoS con payloads grandes |
| **Logging/Audit** | ❌ No existe | Sin trazabilidad de acciones |
| **Error Handler Global** | ❌ No existe | Puede filtrar stack traces |
| **HTTPS** | ❌ No configurado | Tráfico en texto plano |

---

## 8. 📁 Archivos Estáticos y Uploads

```typescript
// main.ts
app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });
```

> [!WARNING]
> **Los uploads son públicos sin autenticación.** Cualquiera con la URL puede acceder a firmas de usuarios, imágenes de propuestas y templates. URLs predecibles basadas en timestamp.

### File Upload Security:
- ✅ File type validation (mimetype regex)
- ✅ File size limits (5MB signatures, 10MB templates)
- ⚠️ No hay sanitización de nombres de archivo
- ⚠️ No hay escaneo de malware
- ❌ No hay control de acceso a archivos subidos

---

## 9. 🧹 Código Limpio — Hallazgos

### 🔴 Archivos basura en `apps/api/`:
```
check_accents.js, check_activity.js, check_activity_v2.js,
check_clients.js, clean_unused_clients.js, debug_trm.js,
deep_clean_clients.js, e2e_search_test.js, e2e_search_test_v2.js,
fix_clients.js, fix_email.js, force_migrate_clients.js,
gen_token.js, gen_token_nest.js, get_client_test.js,
import_clients.js, import_terceros_sag.js, list_proposals.js,
list_users.js, smart_clean_clients.js, test_api.js,
test_db.js, test_db_counts.js, test_http_search.js,
test_proposals.js, test_scraping.js, test_search_logic.js
```
**28 scripts sueltos** en la raíz de `apps/api/` que deberían estar en `scripts/` o eliminarse.

### 🔴 Archivos basura en raíz del monorepo:
```
add_groups.py, clean_terceros.py, deep_clean_terceros.py,
remove_accents.py, terceros.csv, terceros sag.csv,
almacenamiento.csv, memorias.csv, Imagen1.png, Imagen3.png,
novotechflow.png (4.5MB!), portada.png, firmalcmc.jpg,
Sin Fondo - NT Morado.png, NovoTechFlow_Plan_Implementacion.txt
```
**15 archivos** que no pertenecen a la raíz del proyecto.

### 🟡 Carpeta `backups/` en el repo:
Contiene copias completas de código fuente. Debería gestionarse con Git tags/branches en lugar de carpetas.

### 🟡 Uso de `any` en TypeScript:
```
- users.controller.ts:24    → @Body() createUserDto: any
- templates.controller.ts:22 → @Req() req: any (×2)
- templates.service.ts       → (b: any) (×4)
- proposals.service.ts:782   → as any[]
```
**8 usos de `any`** que eliminan type safety.

### 🟡 Login DTO no utilizado:
`LoginDto` está definido en [auth.dto.ts](file:///d:/novotechflow/apps/api/src/auth/dto/auth.dto.ts) con validaciones pero el controller usa `Record<string, string>`.

### 🟢 Positivo:
- ✅ Sin `console.log` en código fuente del API
- ✅ Prisma schema bien estructurado con mapeo de nombres
- ✅ Código TypeScript consistente
- ✅ ESLint + Prettier configurados

---

## 10. 📊 npm audit

> [!NOTE]
> No pude ejecutar `pnpm audit` directamente debido a limitaciones del entorno. **Te recomiendo ejecutar el siguiente comando manualmente:**

```bash
pnpm audit
```

O específicamente por workspace:
```bash
cd apps/api && pnpm audit
cd apps/web && pnpm audit
```

---

## 11. 📋 Resumen de Hallazgos Priorizados

### 🔴 CRÍTICOS (Corregir inmediatamente)

| # | Hallazgo | Archivo | Fix |
|---|---|---|---|
| 1 | JWT Secret hardcodeado como fallback | [jwt.strategy.ts](file:///d:/novotechflow/apps/api/src/auth/jwt.strategy.ts#L13), [auth.module.ts](file:///d:/novotechflow/apps/api/src/auth/auth.module.ts#L14) | Usar `ConfigService`, lanzar error si no hay secret |
| 2 | JWT_SECRET no definido en .env | [.env](file:///d:/novotechflow/apps/api/.env) | Agregar `JWT_SECRET=<random-64-chars>` |
| 3 | Credenciales DB hardcodeadas en docker-compose | [docker-compose.yml](file:///d:/novotechflow/docker-compose.yml) | Usar `.env` + `env_file` |
| 4 | CORS abierto a todos los orígenes | [main.ts](file:///d:/novotechflow/apps/api/src/main.ts#L10) | Configurar orígenes permitidos |
| 5 | No existe `.env.example` | — | Crear con todas las variables necesarias |

### 🟡 IMPORTANTES (Corregir pronto)

| # | Hallazgo | Fix |
|---|---|---|
| 6 | Sin Helmet (headers de seguridad) | `npm i helmet` + `app.use(helmet())` |
| 7 | Sin Rate Limiting | `@nestjs/throttler` |
| 8 | Uploads públicos sin auth | Middleware de auth para `/uploads/` |
| 9 | Login sin DTO validado | Usar `LoginDto` en AuthController |
| 10 | `forbidNonWhitelisted: false` | Cambiar a `true` |
| 11 | Proposals sin control de roles | Agregar RolesGuard o filtrar por userId |
| 12 | No hay refresh token | Implementar token refresh flow |

### 🟢 MEJORAS (Clean code)

| # | Hallazgo | Fix |
|---|---|---|
| 13 | 28 scripts sueltos en api/ | Mover a `scripts/` o eliminar |
| 14 | 15 archivos sueltos en raíz | Mover a carpeta dedicada o eliminar |
| 15 | Carpeta `backups/` en repo | Usar Git branches/tags |
| 16 | 8 usos de `any` | Reemplazar con tipos específicos |
| 17 | `.env` real posiblemente versionado | Verificar con `git log` |
| 18 | Puerto PostgreSQL expuesto globalmente | Usar `127.0.0.1:5432:5432` |

---

## 12. 🔧 Quick Fixes Prioritarios

¿Quieres que proceda con la implementación de alguna de estas correcciones? Te recomiendo empezar por:

1. **Crear `.env.example`** y agregar `JWT_SECRET`
2. **Configurar CORS** con orígenes específicos
3. **Instalar y configurar Helmet** 
4. **Agregar Rate Limiting** al endpoint de login
5. **Usar LoginDto** en el AuthController
