# 🔒 Auditoría de Seguridad Aplicativa — NovoTechFlow

**Fecha:** 2026-04-05  
**Auditor:** Análisis AppSec Automatizado  
**Alcance:** Backend NestJS (`apps/api/src/`), Prisma ORM, upload de archivos, configuración HTTP  

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| 🔴 Crítica | 3 |
| 🟠 Alta | 8 |
| 🟡 Media | 9 |
| 🔵 Baja | 4 |
| **Total** | **24** |

---

## 1. Autenticación y Autorización

### 🔴 SEC-01 — JWT Secret hardcoded en código fuente (CRÍTICA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | El secreto JWT está hardcodeado como fallback: `'super-secret-novotechflow-key-change-me'`. Si `JWT_SECRET` no está en `.env`, cualquiera puede forjar tokens válidos. El `.env` actual **no define `JWT_SECRET`**, por lo que se usa el fallback. |
| **Severidad** | 🔴 Crítica |
| **OWASP** | A07:2021 – Identification and Authentication Failures |
| **Archivos** | [auth.module.ts:14](file:///d:/novotechflow/apps/api/src/auth/auth.module.ts#L14), [jwt.strategy.ts:13](file:///d:/novotechflow/apps/api/src/auth/jwt.strategy.ts#L13) |
| **Evidencia** | `.env` solo contiene `DATABASE_URL`. No hay `JWT_SECRET` definido. |

**Recomendación:**
```diff
# .env
+ JWT_SECRET=<clave-aleatoria-de-64-caracteres-mínimo>
```
```typescript
// auth.module.ts — eliminar fallback, fallar rápido si no se configura
JwtModule.register({
-  secret: process.env.JWT_SECRET || 'super-secret-novotechflow-key-change-me',
+  secret: (() => {
+    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
+    return process.env.JWT_SECRET;
+  })(),
   signOptions: { expiresIn: '12h' },
}),
```

---

### 🔴 SEC-02 — IDOR: Endpoints de propuestas y escenarios carecen de verificación de propiedad (CRÍTICA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Los endpoints `GET :id`, `PATCH :id`, `DELETE :id`, `POST :id/items`, `POST :id/scenarios`, `POST :id/pages`, etc. reciben un ID por parámetro pero **nunca verifican** que la propuesta pertenezca al usuario autenticado. Un usuario COMMERCIAL puede leer, modificar o eliminar propuestas de CUALQUIER otro usuario conociendo su UUID. |
| **Severidad** | 🔴 Crítica |
| **OWASP** | A01:2021 – Broken Access Control |
| **Archivos** | [proposals.controller.ts:70-73](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L70-L73) (getById), [proposals.controller.ts:76-78](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L76-L78) (update), [proposals.controller.ts:106-108](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L106-L108) (delete) |
| **Evidencia** | `getById(id)` → `proposalsService.getProposalById(id)` — no se pasa el `user.id`. `updateProposal`, `deleteProposal`, `addProposalItem`, etc. tampoco filtran por `userId`. |

**Recomendación:**
```typescript
// proposals.service.ts — agregar ownership check
async getProposalById(id: string, user: AuthenticatedUser) {
  const proposal = await this.prisma.proposal.findUnique({
    where: { id },
    include: { proposalItems: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
+ if (user.role !== 'ADMIN' && proposal.userId !== user.id) {
+   throw new ForbiddenException('No tienes acceso a esta propuesta.');
+ }
  return proposal;
}
```

Aplicar el mismo patrón a **todos** los métodos: `updateProposal`, `deleteProposal`, `addProposalItem`, `removeProposalItem`, `updateProposalItem`, `createScenario`, `cloneProposal`, `initializeDefaultPages`, `createCustomPage`, `createBlock`, etc.

---

### 🟠 SEC-03 — IDOR en billing-projections: update/delete sin verificación de ownership (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `PATCH :id` y `DELETE :id` en billing-projections no verifican que la proyección pertenezca al usuario autenticado (COMMERCIAL). Cualquier usuario autenticado puede modificar o eliminar proyecciones de otros. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A01:2021 – Broken Access Control |
| **Archivos** | [billing-projections.controller.ts:23-25](file:///d:/novotechflow/apps/api/src/billing-projections/billing-projections.controller.ts#L23-L25) (update), [billing-projections.controller.ts:29-31](file:///d:/novotechflow/apps/api/src/billing-projections/billing-projections.controller.ts#L29-L31) (delete) |

**Recomendación:**
```typescript
// billing-projections.controller.ts
@Patch(':id')
async update(
  @Param('id') id: string,
  @Request() req: { user: AuthenticatedUser },
  @Body() data: UpdateBillingProjectionDto,
) {
  return this.service.update(id, data, req.user);
}

// billing-projections.service.ts
async update(id: string, data: UpdateBillingProjectionDto, user: AuthenticatedUser) {
  const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException();
+ if (user.role !== 'ADMIN' && existing.userId !== user.id) {
+   throw new ForbiddenException('No tienes acceso a esta proyección.');
+ }
  // ... update logic
}
```

---

### 🟠 SEC-04 — Endpoint `client-history` expone datos de propuestas cross-tenant (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `GET /proposals/client-history?clientName=X` busca propuestas de TODOS los usuarios sin filtrar por rol. Un COMMERCIAL puede ver propuestas de otros comerciales incluyendo nombre de usuario, asunto y datos del cliente. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A01:2021 – Broken Access Control |
| **Archivo** | [proposals.service.ts:38-63](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L38-L63), [proposals.controller.ts:58-61](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L58-L61) |

**Recomendación:** Si es intencional (detectar cruces de cuenta) documentarlo explícitamente. Si no, filtrar por `userId` para COMMERCIAL.

---

### 🟠 SEC-05 — Login endpoint no usa DTO tipado, bypassing ValidationPipe (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `auth.controller.ts` usa `@Body() signInDto: Record<string, string>` en vez del `LoginDto` definido en `auth.dto.ts`. El `ValidationPipe` global **no puede validar** un `Record<string, string>` — no hay decoradores de class-validator. El DTO `LoginDto` está definido pero nunca se usa. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A07:2021 – Identification and Authentication Failures |
| **Archivo** | [auth.controller.ts:10](file:///d:/novotechflow/apps/api/src/auth/auth.controller.ts#L10) |

**Recomendación:**
```diff
- async login(@Body() signInDto: Record<string, string>) {
-   const user = await this.authService.validateUser(signInDto.email, signInDto.password);
+ async login(@Body() signInDto: LoginDto) {
+   const user = await this.authService.validateUser(signInDto.email, signInDto.password);
```

---

### 🟠 SEC-06 — Users controller acepta `createUserDto: any` sin DTO validado (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `POST /users` acepta `@Body() createUserDto: any`, lo que bypasea completamente la `ValidationPipe`. Un atacante con rol ADMIN podría enviar campos extra que podrían contaminar el modelo de datos (`role`, `isActive`, etc.). |
| **Severidad** | 🟠 Alta |
| **OWASP** | A03:2021 – Injection |
| **Archivo** | [users.controller.ts:24](file:///d:/novotechflow/apps/api/src/users/users.controller.ts#L24) |

**Recomendación:**
```typescript
// Crear CreateUserDto con validación estricta
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsEnum(Role)
  role: Role;

  @IsString() @MinLength(2) @MaxLength(10)
  nomenclature: string;

  @IsString() @MinLength(8)
  password: string;
}
```

---

### 🟡 SEC-07 — No hay rate limiting en endpoint de login (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | No hay `@nestjs/throttler` ni ningún otro mecanismo de rate limiting. El endpoint `POST /auth/login` es vulnerable a ataques de fuerza bruta. |
| **Severidad** | 🟡 Media |
| **OWASP** | A07:2021 – Identification and Authentication Failures |
| **Archivo** | [auth.controller.ts:9](file:///d:/novotechflow/apps/api/src/auth/auth.controller.ts#L9), [package.json](file:///d:/novotechflow/apps/api/package.json) |

**Recomendación:**
```bash
pnpm add @nestjs/throttler
```
```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    // ...
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
```
```typescript
// auth.controller.ts — límite más estricto para login
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post('login')
```

---

### 🟡 SEC-08 — JWT con expiración de 12h sin refresh token (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Los tokens JWT tienen TTL de 12 horas. No hay mecanismo de refresh token ni blacklisting. Si un token se compromete, permanece válido 12 horas completas. |
| **Severidad** | 🟡 Media |
| **OWASP** | A07:2021 – Identification and Authentication Failures |
| **Archivo** | [auth.module.ts:15](file:///d:/novotechflow/apps/api/src/auth/auth.module.ts#L15) |

**Recomendación:** Implementar refresh token con `expiresIn: '15m'` para access token + `expiresIn: '7d'` para refresh token.

---

## 2. Validación y Sanitización de Inputs

### 🟡 SEC-09 — ValidationPipe con `forbidNonWhitelisted: false` (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | La `ValidationPipe` global tiene `forbidNonWhitelisted: false`, lo que permite enviar propiedades extra no declaradas en los DTOs. Aunque `whitelist: true` las remueve, no devuelve error al cliente, lo que dificulta detectar intentos de mass assignment. |
| **Severidad** | 🟡 Media |
| **OWASP** | A03:2021 – Injection |
| **Archivo** | [main.ts:14](file:///d:/novotechflow/apps/api/src/main.ts#L14) |

**Recomendación:**
```diff
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
-   forbidNonWhitelisted: false,
+   forbidNonWhitelisted: true,
  }));
```

---

### 🟡 SEC-10 — No hay validación UUID en parámetros `:id` de rutas (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Ningún endpoint valida que los parámetros `:id`, `:itemId`, `:scenarioId`, `:pageId`, `:blockId` sean UUIDs válidos. Se pasan directamente a Prisma sin sanitización. Prisma lanzará un error genérico si no es UUID, pero el mensaje de error podría filtrar info interna de la BD. |
| **Severidad** | 🟡 Media |
| **OWASP** | A03:2021 – Injection |
| **Archivos** | Todos los controllers con `@Param('id')` |

**Recomendación:**
```typescript
// Usar ParseUUIDPipe de NestJS
import { ParseUUIDPipe } from '@nestjs/common';

@Get(':id')
async getById(@Param('id', ParseUUIDPipe) id: string) {
  return this.proposalsService.getProposalById(id);
}
```

---

### 🟠 SEC-11 — No hay sanitización XSS en campos de texto libre (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Los campos `subject` (propuestas), `description` (escenarios), `content` (bloques RICH_TEXT), `name` (ítems), `body` (email logs), `clientName` se almacenan sin sanitización HTML/XSS. El contenido RICH_TEXT (TipTap) puede contener HTML arbitrario que se renderiza en el frontend. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A03:2021 – Injection (Stored XSS) |
| **Archivos** | [proposals.dto.ts:17](file:///d:/novotechflow/apps/api/src/proposals/dto/proposals.dto.ts#L17) (subject), [proposals.dto.ts:79](file:///d:/novotechflow/apps/api/src/proposals/dto/proposals.dto.ts#L79) (description), [proposals.dto.ts:308](file:///d:/novotechflow/apps/api/src/proposals/dto/proposals.dto.ts#L308) (content) |

**Recomendación:**
```bash
pnpm add sanitize-html
```
```typescript
// Crear un decorador o pipe de sanitización en el backend
import sanitizeHtml from 'sanitize-html';

// Usar en el service antes de guardar
const sanitizedSubject = sanitizeHtml(data.subject, { allowedTags: [] });
```
Para contenido RICH_TEXT, usar sanitize-html con allowedTags restringidos a los necesarios por TipTap:
```typescript
const sanitizedContent = sanitizeHtml(jsonContent, {
  allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'span', 'img'],
  allowedAttributes: { 'img': ['src', 'alt'], 'span': ['style'], '*': ['class'] },
});
```

---

### 🟡 SEC-12 — Templates controller: Body sin DTO tipado (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `POST /templates` y `PATCH /templates/:id` usan objetos inline como `@Body() body: { name: string; ... }` en vez de DTOs con class-validator. La ValidationPipe no valida estos objetos ya que no son clases decoradas. |
| **Severidad** | 🟡 Media |
| **OWASP** | A03:2021 – Injection |
| **Archivo** | [templates.controller.ts:38](file:///d:/novotechflow/apps/api/src/templates/templates.controller.ts#L38), [templates.controller.ts:52](file:///d:/novotechflow/apps/api/src/templates/templates.controller.ts#L52), [templates.controller.ts:65](file:///d:/novotechflow/apps/api/src/templates/templates.controller.ts#L65), [templates.controller.ts:75](file:///d:/novotechflow/apps/api/src/templates/templates.controller.ts#L75) |

**Recomendación:** Crear DTOs con class-validator para cada endpoint del templates controller.

---

## 3. Upload de Archivos

### 🟠 SEC-13 — Upload de imágenes valida solo MIME type del header, no magic bytes (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Los 3 endpoints de upload (`proposals/pages/upload-image`, `templates/:id/blocks/:blockId/image`, `users/:id/signature`) validan el `file.mimetype` usando regex, pero esto solo revisa el header `Content-Type` del request HTTP, que el cliente puede falsificar. Un archivo `.exe` renombrado a `.jpg` con MIME falsificado será aceptado. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivos** | [proposals.controller.ts:247-253](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L247-L253), [templates.controller.ts:112-117](file:///d:/novotechflow/apps/api/src/templates/templates.controller.ts#L112-L117), [users.controller.ts:50-55](file:///d:/novotechflow/apps/api/src/users/users.controller.ts#L50-L55) |

**Recomendación:**
```bash
pnpm add file-type
```
```typescript
import { fileTypeFromBuffer } from 'file-type';
import { readFile, unlink } from 'fs/promises';

async uploadImage(@UploadedFile() file: Express.Multer.File) {
  // Validar magic bytes del archivo ya guardado
  const buffer = await readFile(file.path);
  const type = await fileTypeFromBuffer(buffer);
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!type || !allowedMimes.includes(type.mime)) {
    await unlink(file.path); // Eliminar archivo malicioso
    throw new BadRequestException('Tipo de archivo no permitido');
  }
  
  return { url: `/uploads/${file.filename}`, originalName: file.originalname };
}
```

---

### 🟠 SEC-14 — `originalname` no se sanitiza contra path traversal (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Aunque el `filename` generado para almacenamiento usa un timestamp único (seguro), el `originalname` se retorna tal cual al cliente sin sanitización. Más importante: el `extname(file.originalname)` se usa en la generación del filename — un `originalname` malicioso como `../../../etc/passwd` haría que `extname()` devuelva una extensión vacía, pero un archivo como `image.jpg.exe` devolvería `.exe`. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A01:2021 – Broken Access Control |
| **Archivos** | [proposals.controller.ts:244](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L244), [users.controller.ts:47](file:///d:/novotechflow/apps/api/src/users/users.controller.ts#L47), [templates.controller.ts:109](file:///d:/novotechflow/apps/api/src/templates/templates.controller.ts#L109) |

**Recomendación:**
```typescript
filename: (_req, file, cb) => {
  // Sanitizar originalname
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const ext = extname(sanitizedName).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Extensión no permitida'), '');
  }
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  cb(null, uniqueSuffix + ext);
},
```

---

### 🟡 SEC-15 — No hay rate limiting ni cuota por usuario en uploads (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Un usuario autenticado puede subir archivos ilimitados (hasta 10MB c/u). No hay límite de uploads totales por usuario. Esto permite ataques de agotamiento de disco. |
| **Severidad** | 🟡 Media |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivos** | [proposals.controller.ts:237-258](file:///d:/novotechflow/apps/api/src/proposals/proposals.controller.ts#L237-L258) |

**Recomendación:** Implementar un middleware o guard que rastree uploads por usuario y aplique cuota (e.g., máximo 100MB total o 50 archivos por hora).

---

### 🟡 SEC-16 — Carpeta uploads servida como static assets sin restricciones (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `app.useStaticAssets(uploadsPath, { prefix: '/uploads/' })` sirve **todo** el contenido de `uploads/` como archivos estáticos públicos sin autenticación. Cualquier persona sin JWT puede acceder a `http://host/uploads/filename.jpg`, incluyendo firmas de usuarios. |
| **Severidad** | 🟡 Media |
| **OWASP** | A01:2021 – Broken Access Control |
| **Archivo** | [main.ts:27](file:///d:/novotechflow/apps/api/src/main.ts#L27) |

**Recomendación:** Servir uploads a través de un controller autenticado que valida el JWT:
```typescript
@Controller('uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Get(':filename')
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '');
    const filePath = join(process.cwd(), 'uploads', safeName);
    return res.sendFile(filePath);
  }
}
```

---

## 4. Configuración de Seguridad HTTP

### 🔴 SEC-17 — CORS completamente abierto: `app.enableCors()` sin configuración (CRÍTICA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `app.enableCors()` sin parámetros permite requests desde **cualquier origen** con cualquier método y header. En producción esto permite ataques CSRF desde cualquier dominio, exfiltración de datos, etc. |
| **Severidad** | 🔴 Crítica |
| **OWASP** | A05:2021 – Security Misconfiguration |
| **Archivo** | [main.ts:10](file:///d:/novotechflow/apps/api/src/main.ts#L10) |

**Recomendación:**
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
```

---

### 🟠 SEC-18 — No hay security headers (Helmet ausente) (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | No se usa `helmet` ni ninguna configuración de security headers. Faltan CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. La aplicación es vulnerable a clickjacking, MIME sniffing, y carece de protecciones estándar de capa HTTP. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A05:2021 – Security Misconfiguration |
| **Archivo** | [main.ts](file:///d:/novotechflow/apps/api/src/main.ts), [package.json](file:///d:/novotechflow/apps/api/package.json) |

**Recomendación:**
```bash
pnpm add helmet
```
```typescript
// main.ts
import helmet from 'helmet';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

## 5. Base de Datos y Prisma

### 🟠 SEC-19 — `deleteProposal` ejecuta 6 deletes sin `$transaction` (ALTA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `deleteProposal()` ejecuta 6 operaciones `deleteMany` + 1 `delete` secuencialmente sin envolverlas en `prisma.$transaction()`. Si falla a la mitad, la BD queda en estado inconsistente con datos huérfanos. |
| **Severidad** | 🟠 Alta |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivo** | [proposals.service.ts:429-459](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L429-L459) |

**Recomendación:**
```typescript
async deleteProposal(id: string) {
  return this.prisma.$transaction(async (tx) => {
    await tx.proposalPageBlock.deleteMany({ where: { page: { proposalId: id } } });
    await tx.proposalPage.deleteMany({ where: { proposalId: id } });
    await tx.scenarioItem.deleteMany({ where: { scenario: { proposalId: id } } });
    await tx.scenario.deleteMany({ where: { proposalId: id } });
    await tx.proposalItem.deleteMany({ where: { proposalId: id } });
    return tx.proposal.delete({ where: { id } });
  });
}
```

---

### 🟡 SEC-20 — `deleteUser` ejecuta 12 deletes sin `$transaction` (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Igual que SEC-19, pero `deleteUser()` ejecuta **12 operaciones** de eliminación secuenciales sin transacción atómica. |
| **Severidad** | 🟡 Media |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivo** | [users.service.ts:74-145](file:///d:/novotechflow/apps/api/src/users/users.service.ts#L74-L145) |

**Recomendación:** Envolver toda la lógica en `this.prisma.$transaction(async (tx) => { ... })`.

---

### 🟡 SEC-21 — `deleteScenario` sin transacción (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `deleteScenario()` hace `deleteMany` de ScenarioItems seguido de `delete` de Scenario sin transacción. |
| **Severidad** | 🟡 Media |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivo** | [proposals.service.ts:599-602](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L599-L602) |

---

### 🔵 SEC-22 — `reorderPages` y `reorderBlocks` usan `Promise.all` sin transacción (BAJA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `reorderPages()` y `reorderBlocks()` ejecutan múltiples updates con `Promise.all` sin transacción. Si uno falla, el orden queda parcialmente aplicado. También `templates.service.reorder()` tiene el mismo patrón. |
| **Severidad** | 🔵 Baja |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivos** | [proposals.service.ts:903-910](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L903-L910), [proposals.service.ts:954-960](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts#L954-L960), [templates.service.ts:327-333](file:///d:/novotechflow/apps/api/src/templates/templates.service.ts#L327-L333) |

**Recomendación:**
```typescript
async reorderPages(proposalId: string, data: ReorderPagesDto) {
  await this.prisma.$transaction(
    data.pageIds.map((id, index) =>
      this.prisma.proposalPage.update({ where: { id }, data: { sortOrder: index + 1 } })
    )
  );
  return this.getPagesByProposalId(proposalId);
}
```

---

## 6. Exposición de Datos

### 🟡 SEC-23 — `findOneById` selecciona `passwordHash` (MEDIA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `UsersService.findOneById()` incluye `passwordHash: true` en su select. Este método es invocado por `JwtStrategy.validate()` para verificar usuarios activos. Aunque el hash no se devuelve directamente al cliente (validate retorna un subconjunto), el campo viaja innecesariamente por la memoria del servidor y podría exponerse si se agrega un endpoint de "me" o "profile" sin cuidado. |
| **Severidad** | 🟡 Media |
| **OWASP** | A04:2021 – Insecure Design |
| **Archivo** | [users.service.ts:19-31](file:///d:/novotechflow/apps/api/src/users/users.service.ts#L19-L31) |

**Recomendación:**
```diff
  async findOneById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        nomenclature: true,
        signatureUrl: true,
        isActive: true,
-       passwordHash: true,
+       // passwordHash: NO incluir — no es necesario para validación JWT
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<User | null>;
  }
```

---

### 🔵 SEC-24 — Credenciales de BD hardcodeadas en docker-compose.yml y .env (BAJA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | `docker-compose.yml` y `.env` contienen `password123` como contraseña de PostgreSQL. Aunque `.env` está en `.gitignore`, `docker-compose.yml` **no está en `.gitignore`** y se commitea al repositorio con credenciales visibles. |
| **Severidad** | 🔵 Baja (dev environment) |
| **OWASP** | A05:2021 – Security Misconfiguration |
| **Archivos** | [docker-compose.yml:9](file:///d:/novotechflow/docker-compose.yml#L9), [.env:1](file:///d:/novotechflow/apps/api/.env#L1) |

**Recomendación:** Usar variables de entorno en docker-compose:
```yaml
environment:
  POSTGRES_USER: ${DB_USER}
  POSTGRES_PASSWORD: ${DB_PASSWORD}
  POSTGRES_DB: ${DB_NAME}
```

---

### 🔵 SEC-25 — Scripts de utilidad con secretos hardcodeados commiteados (BAJA)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Los archivos `gen_token.js`, `gen_token_nest.js`, `e2e_search_test.js`, `e2e_search_test_v2.js` contienen el JWT secret hardcodeado y pueden ser usados para generar tokens válidos. Estos archivos están trackeados en git. |
| **Severidad** | 🔵 Baja |
| **OWASP** | A05:2021 – Security Misconfiguration |
| **Archivos** | [gen_token.js:3](file:///d:/novotechflow/apps/api/gen_token.js#L3), [gen_token_nest.js:4](file:///d:/novotechflow/apps/api/gen_token_nest.js#L4), [e2e_search_test.js:5](file:///d:/novotechflow/apps/api/e2e_search_test.js#L5) |

**Recomendación:** Agregar estos scripts a `.gitignore` o moverlos a un directorio de utilities no trackeado. Usar `process.env.JWT_SECRET` en lugar de hardcodear.

---

## Matriz de Prioridad de Remediación

| Prioridad | ID | Descripción | Esfuerzo |
|-----------|-----|-------------|----------|
| 🔴 P0 | SEC-01 | JWT secret hardcoded (en producción se usa fallback) | 15min |
| 🔴 P0 | SEC-02 | IDOR en todos los endpoints de propuestas | 2-4h |
| 🔴 P0 | SEC-17 | CORS completamente abierto | 15min |
| 🟠 P1 | SEC-03 | IDOR en billing-projections | 30min |
| 🟠 P1 | SEC-05 | Login sin validación DTO | 15min |
| 🟠 P1 | SEC-06 | Create user sin validación DTO | 30min |
| 🟠 P1 | SEC-11 | Sin sanitización XSS | 2-3h |
| 🟠 P1 | SEC-13 | Upload sin magic bytes | 1h |
| 🟠 P1 | SEC-14 | originalname sin sanitizar | 30min |
| 🟠 P1 | SEC-18 | Helmet/security headers ausentes | 30min |
| 🟠 P1 | SEC-19 | Delete sin transacción | 1h |
| 🟡 P2 | SEC-04 | Client-history cross-tenant | 30min |
| 🟡 P2 | SEC-07 | Sin rate limiting | 1h |
| 🟡 P2 | SEC-08 | JWT 12h sin refresh | 4-8h |
| 🟡 P2 | SEC-09 | forbidNonWhitelisted false | 5min |
| 🟡 P2 | SEC-10 | Sin ParseUUIDPipe | 1h |
| 🟡 P2 | SEC-12 | Templates sin DTO tipado | 1h |
| 🟡 P2 | SEC-15 | Sin cuota de uploads | 2h |
| 🟡 P2 | SEC-16 | Uploads públicos sin auth | 1-2h |
| 🟡 P2 | SEC-20 | deleteUser sin transacción | 30min |
| 🟡 P2 | SEC-21 | deleteScenario sin transacción | 15min |
| 🟡 P2 | SEC-23 | passwordHash en findOneById | 5min |
| 🔵 P3 | SEC-22 | Reorder sin transacción | 30min |
| 🔵 P3 | SEC-24 | Credenciales en docker-compose | 15min |
| 🔵 P3 | SEC-25 | Scripts con secrets hardcodeados | 15min |

---

> [!CAUTION]
> Los hallazgos **SEC-01** (JWT secret), **SEC-02** (IDOR masivo) y **SEC-17** (CORS abierto) deben remediarse **antes de cualquier deploy a producción**. Juntos permiten a un atacante forjar tokens JWT y acceder/modificar todas las propuestas comerciales de todos los usuarios desde cualquier origen.
