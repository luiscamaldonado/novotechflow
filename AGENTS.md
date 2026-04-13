# DIRECTRICES DE DESARROLLO — CÓDIGO PROFESIONAL

> **Eres un ingeniero de software senior.** Todo código que generes, modifiques o revises DEBE cumplir estrictamente las siguientes directrices. No hay excepciones.

---

## 1. ARQUITECTURA Y ESTRUCTURA DEL PROYECTO

- Aplica una arquitectura modular con separación clara de responsabilidades (Separation of Concerns).
- Organiza el proyecto por features/dominios, NO por tipo de archivo.
  - ✅ `/features/auth/`, `/features/dashboard/`, `/features/invoices/`
  - ❌ `/components/`, `/hooks/`, `/utils/` como carpetas raíz únicas.
- Cada módulo/feature debe ser autocontenido: sus componentes, hooks, tipos, servicios y tests viven juntos.
- Usa barrel exports (`index.ts`) para exponer solo la API pública de cada módulo.
- Mantén una capa de abstracción clara: **UI → Lógica de negocio → Datos/API**.
- Nunca acoples directamente un componente de UI a una llamada HTTP o query de base de datos.

> **NOTA — Estado actual del proyecto (abril 2026):**
> El proyecto usa una estructura híbrida (type-based con subdominios por feature). La migración completa a feature-based está planificada pero no ejecutada. Para código nuevo:
> - Seguir la estructura existente
> - Agrupar componentes relacionados en subcarpetas dentro de `pages/` (ej: `pages/proposals/components/`)
> - Los hooks de negocio van en `hooks/` con nombre descriptivo (`useDashboard.ts`, `useScenarios.ts`)
> - La lógica de cálculos y utilidades compartidas van en `lib/`

---

## 2. PRINCIPIOS FUNDAMENTALES (Aplícalos siempre)

- **SOLID**: Responsabilidad única, abierto/cerrado, sustitución de Liskov, segregación de interfaces, inversión de dependencias.
- **DRY** (Don't Repeat Yourself): Si algo se repite más de 2 veces, abstráelo. Pero NO sobre-abstraigas prematuramente.
- **KISS** (Keep It Simple, Stupid): Prefiere la solución más simple que resuelva el problema. La cleverness mata la mantenibilidad.
- **YAGNI** (You Aren't Gonna Need It): No implementes funcionalidad especulativa. Construye solo lo que se necesita ahora.
- **Composition over Inheritance**: Prefiere composición y hooks/funciones reutilizables sobre herencia de clases.
- **Fail Fast**: Valida entradas temprano, lanza errores claros, no dejes que datos inválidos viajen por el sistema.
- **Principle of Least Surprise**: El código debe comportarse como cualquier desarrollador razonable esperaría.

---

## 3. CÓDIGO LIMPIO — REGLAS NO NEGOCIABLES

### Naming (Nomenclatura)
- Variables y funciones: nombres descriptivos que revelen intención.
  - ✅ `filteredActiveUsers`, `calculateMonthlyRevenue()`
  - ❌ `data`, `temp`, `x`, `handleClick2`, `processStuff()`
- Booleanos: siempre con prefijo `is`, `has`, `can`, `should`.
  - ✅ `isLoading`, `hasPermission`, `canEdit`
- Constantes: `UPPER_SNAKE_CASE` → `MAX_RETRY_COUNT`, `API_BASE_URL`.
- Componentes: PascalCase. Hooks: camelCase con prefijo `use`.
- Archivos: kebab-case para utilidades, PascalCase para componentes.

### Funciones
- Máximo 20-30 líneas por función. Si excede, refactoriza.
- Una función = una responsabilidad. Si necesitas usar "y" para describir qué hace, divídela.
- Máximo 3 parámetros. Si necesitas más, usa un objeto de configuración.
- Prefiere funciones puras (sin side effects) siempre que sea posible.
- Retorna temprano (early return) para evitar nesting profundo.
  - ✅ `if (!user) return null;` al inicio
  - ❌ `if (user) { if (user.active) { if (user.role === 'admin') { ... } } }`

### Archivos
- Máximo 150-200 líneas por archivo. Si excede, es señal de que debe dividirse.
- Un componente por archivo.
- Los imports deben estar ordenados: externos → internos → tipos → estilos.

---

## 4. MANEJO DE ERRORES Y RESILIENCIA

- NUNCA uses `catch` vacíos. Siempre loguea o maneja el error explícitamente.
- Crea tipos de error personalizados para el dominio de la aplicación.
- Usa error boundaries en React para errores de renderizado.
- Toda llamada asíncrona debe tener manejo de errores explícito.
- Proporciona mensajes de error útiles para el usuario Y para el desarrollador (logs).
- Implementa estados de loading, error y empty state en TODA vista que consuma datos.

---

## 5. TIPADO (TypeScript)

- **NUNCA uses `any`**. Si no conoces el tipo, usa `unknown` y haz type narrowing.
- **Prohibido `@ts-ignore` y `@ts-expect-error`**. Si necesitas uno, hay un error de diseño que corregir.
- Define interfaces/types para TODAS las estructuras de datos: props, API responses, state, etc.
- Usa tipos discriminados (discriminated unions) para modelar estados:
  ```typescript
  type RequestState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error };
  ```
- Exporta los tipos junto al módulo que los define.
- Prefiere `interface` para objetos extensibles, `type` para uniones y tipos compuestos.
- Usa generics cuando una función/componente opere sobre tipos variables.
- Los tipos compartidos entre módulos van en `lib/types.ts`.
- Usa `type` imports cuando solo se necesita el tipo: `import type { ProposalCalcItem } from ...`.

---

## 6. GESTIÓN DE ESTADO

- Estado local (`useState`) para lo que solo afecta a un componente.
- Estado compartido (Zustand/Context) solo cuando múltiples componentes no relacionados lo necesitan.
- NUNCA pongas todo el estado en un store global. Pregúntate: "¿Quién más necesita esto?"
- Deriva estado en lugar de duplicarlo. Si puedes calcularlo, no lo almacenes.
- Los stores deben estar segmentados por dominio/feature, no ser un mega-store monolítico.

---

## 7. SEGURIDAD

- NUNCA expongas secretos, API keys o tokens en el código del cliente.
- Sanitiza TODA entrada del usuario antes de procesarla o mostrarla.
- Usa parametrized queries / RPCs; nunca construyas queries con string concatenation.
- Implementa Row Level Security (RLS) en la base de datos. No confíes solo en validaciones del frontend.
- Valida permisos tanto en el cliente (UX) como en el servidor (seguridad real).
- Usa HTTPS exclusivamente. Configura headers de seguridad (CSP, HSTS, etc.).

---

## 8. RENDIMIENTO

- Mide antes de optimizar. No optimices prematuramente.
- Usa `React.memo`, `useMemo`, `useCallback` solo cuando el profiler confirme un problema real.
- Implementa lazy loading para rutas y componentes pesados.
- Pagina o virtualiza listas largas (>100 items).
- Optimiza imágenes: usa formatos modernos (WebP/AVIF), lazy loading, y dimensiones apropiadas.
- Minimiza re-renders: evita crear objetos/arrays nuevos en cada render.

---

## 9. TESTING

- Escribe tests para la lógica de negocio crítica, no para detalles de implementación.
- Nombra los tests describiendo el comportamiento esperado:
  - ✅ `"should calculate tax correctly for Colombian NIIF rules"`
  - ❌ `"test1"`, `"works"`
- Testea los edge cases: valores nulos, arrays vacíos, strings vacíos, errores de red.
- Los componentes se testean por comportamiento del usuario (Testing Library), no por estructura interna.

---

## 10. PATRONES PROHIBIDOS — NUNCA HAGAS ESTO

- ❌ Funciones de más de 50 líneas.
- ❌ Más de 3 niveles de nesting/indentación.
- ❌ Props drilling de más de 2 niveles (usa Context o un store).
- ❌ `console.log` como estrategia de debugging en producción.
- ❌ Comentarios que explican "qué" hace el código (el código debe ser autoexplicativo). Solo comenta el "por qué" cuando no sea obvio.
- ❌ Código muerto o comentado. Si no se usa, se elimina. Git es tu historial.
- ❌ Variables mutables cuando puedes usar `const` y operaciones inmutables.
- ❌ Magic numbers/strings. Usa constantes con nombre descriptivo.
- ❌ Copiar y pegar bloques de código. Abstrae en funciones o componentes.
- ❌ Imports circulares entre módulos.
- ❌ Mezclar lógica de negocio con lógica de presentación en el mismo componente.

---

## 11. GIT Y FLUJO DE TRABAJO

- Commits atómicos y descriptivos: `feat(auth): add OTP email verification`.
- Usa Conventional Commits: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
- Un PR/commit = un cambio lógico. No mezcles refactor con features nuevas.
- Antes de cada commit, revisa que no haya errores de TypeScript, linting, ni tests rotos.

---

## 12. DOCUMENTACIÓN MÍNIMA VIABLE

- README actualizado con: setup, variables de entorno necesarias, scripts disponibles.
- JSDoc en funciones/utilidades públicas complejas.
- Tipos de TypeScript bien nombrados SON documentación.
- Documenta decisiones arquitectónicas importantes en un archivo `DECISIONS.md` o ADRs.

---

## REGLA DE ORO

Antes de escribir cualquier línea de código, pregúntate:

> **"¿Otro desarrollador que no conoce este proyecto entendería este código en 30 segundos?"**

Si la respuesta es no, reescríbelo hasta que la respuesta sea sí.

---
---

## ADDENDUM: PATRONES ESPECÍFICOS DEL PROYECTO NOVOTECHFLOW

> Las siguientes son convenciones adicionales establecidas durante la auditoría de código del proyecto. Complementan las reglas generales anteriores.

### A. HOOKS PERSONALIZADOS (Patrón del proyecto)

Extrae lógica de negocio de los componentes a hooks `useXxx`. El componente solo maneja estado de UI (modals, buffers de edición) y JSX.

Hooks ya establecidos:
- `useProposalBuilder` — CRUD de items, carga de catálogos, actualización de propuesta
- `useScenarios` — CRUD de escenarios, delegación de cálculos al pricing-engine, TRM
- `useDashboard` — Estado del dashboard, filtros, billingCards, acciones de propuestas
- `useProjections` — CRUD de proyecciones de facturación
- `useProposalPages` — CRUD de páginas y bloques del documento

### B. COMPONENTES REUTILIZABLES (Patrón del proyecto)

- Componentes reutilizables en `components/` con subcarpetas por dominio.
- Componentes de UI **nunca** importan `api` directamente. Reciben callbacks via props.
- **Data-driven**: Configuración declarativa en lugar de JSX condicional (ver `SPEC_FIELDS_BY_ITEM_TYPE`).
- **Controlled modals**: `isOpen`, `onClose`, `onAction` como props estándar.

Componentes ya establecidos:
- `SpecFieldsSection` — campos dinámicos con autocompletado
- `ItemPickerModal` — modal de picking de artículos
- `ScenarioTotalsCards` — tarjetas de totales financieros (importa de pricing-engine)
- `ScenarioItemRow` — fila de item en tabla de cálculos
- `ScenarioSidebar` — panel lateral de escenarios
- `ScenarioHeader` — barra superior del escenario activo
- `BillingCards` — tarjetas de resumen financiero del dashboard
- `ProjectionModal` — modal CRUD de proyecciones
- `CityCombobox` — combobox de ciudades colombianas
- `PageEditor` — editor de página del documento
- `BlockEditor` — editor de bloque dentro de una página

### C. CONSTANTES CENTRALIZADAS

Magic numbers y strings centralizados en `lib/constants.ts`:
- `IVA_RATE`, `MAYORISTA_FLETE_PCT`, `PROVEEDOR_MAYORISTA`
- `ITEM_TYPE_LABELS`, `SPEC_FIELDS_BY_ITEM_TYPE`
- Constantes locales a un módulo se definen al inicio del archivo con JSDoc.

Constantes ya establecidas en `lib/constants.ts`:
- `IVA_RATE`, `MAX_MARGIN` (del pricing-engine)
- `ITEM_TYPE_LABELS`, `SPEC_FIELDS_BY_ITEM_TYPE`
- `PAGE_TYPE_LABELS`, `PAGE_TYPE_STYLES`, `VIRTUAL_TECH_SPEC_ID`, `VIRTUAL_ECONOMIC_ID`
- `STATUS_CONFIG`, `ALL_STATUSES`, `PROJECTION_STATUSES`
- `ACQUISITION_CONFIG`, `AcquisitionMode`, `ACQUISITION_OPTIONS`
- `formatCOP` (utilidad de formato de moneda)

### D. VALIDACIÓN Y DTOs (Backend — NestJS)

- Cada endpoint usa un **DTO tipado** con decoradores `class-validator`.
- **Prohibido `@Body() data: any`** o `@Request() req: any` en controladores.
- Los DTOs reflejan exactamente el Prisma schema (ej: `Int?` → `@IsInt()` + `@IsOptional()`).
- `ValidationPipe` habilitado globalmente con `whitelist: true` y `transform: true`.
- No usar `parseInt()`/`parseFloat()` redundantes cuando el DTO ya valida el tipo.

### E. COERCIÓN DE TIPOS (Frontend → API)

Los inputs HTML siempre devuelven strings. Antes de enviar al API, coercionar en el hook:
```typescript
// ✅ Correcto
quantity: Number(formValue) || 1,
marginPct: Number(formValue) || 0,

// ❌ Incorrecto — enviar string donde el DTO espera number
quantity: formValue,
```

### F. CHECKLIST ANTES DE CADA CAMBIO

- [ ] **Sin `any`** — ¿Todos los tipos son explícitos?
- [ ] **Sin magic numbers** — ¿Los valores están en constantes?
- [ ] **Separación de concerns** — ¿La lógica está en un hook, no en el componente?
- [ ] **DTOs validados** — ¿El backend usa DTOs con `class-validator`?
- [ ] **Coerción numérica** — ¿Los inputs se convierten a `Number()` antes de enviar al API?
- [ ] **Componente < 200 líneas** — Si no, ¿se puede descomponer?
- [ ] **`tsc --noEmit` pasa** — ¿Cero errores de TypeScript?
- [ ] **Funcionalidad verificada** — ¿Se probó que no se rompió nada?

---

### G. CREDENCIALES DE PRUEBA

Para pruebas locales y verificación en el navegador:
- **Admin**: `admin@novotechno.com` / `admin123`
- ⚠️ El dominio `@novotechflow.com` **NO existe**. No usar en pruebas.

**Autocompletado del navegador**: El navegador tiene autocompletado activo, por lo que los campos de email y contraseña pueden prellenarse automáticamente. Al hacer pruebas en el browser:
- Si el autocompletado ya rellenó los campos correctamente, simplemente hacer clic en el botón de login.
- Si se necesita escribir las credenciales, **primero borrar/limpiar los campos** (Ctrl+A → Delete) antes de escribir las credenciales para evitar texto duplicado.

---

### H. PRUEBAS EN EL NAVEGADOR

- Las pruebas y verificaciones en el navegador las realiza **exclusivamente el usuario**.
- El agente de IA **NO debe ejecutar pruebas en el browser** ni abrir el navegador para verificar funcionalidad.
- El agente se limita a implementar los cambios en código y, si aplica, ejecutar validaciones estáticas (`tsc --noEmit`, linting, etc.).

---

### I. ESTRUCTURA REAL DEL PROYECTO

Mapa actualizado de la estructura del monorepo. El agente DEBE respetar esta organización al crear o mover archivos.

```
novotechflow/
├── apps/
│   ├── api/                          # Backend NestJS
│   │   ├── prisma/                   # Schema, migraciones, seeds
│   │   ├── scripts/                  # Scripts de utilidad (imports, limpieza)
│   │   │   └── dev/                  # Scripts de desarrollo (gen_token)
│   │   ├── src/
│   │   │   ├── auth/                 # Módulo de autenticación (JWT, guards)
│   │   │   ├── billing-projections/  # Módulo de proyecciones de facturación
│   │   │   ├── catalogs/             # Módulo de catálogos
│   │   │   ├── clients/              # Módulo de clientes
│   │   │   ├── common/               # Utilidades compartidas (sanitize, upload-validation)
│   │   │   ├── prisma/               # PrismaService
│   │   │   ├── proposals/            # Módulo principal de propuestas
│   │   │   │   ├── dto/              # DTOs con class-validator
│   │   │   │   ├── proposals.controller.ts
│   │   │   │   ├── proposals.service.ts    # Core CRUD (~370 líneas)
│   │   │   │   ├── scenarios.service.ts    # Escenarios + ownership
│   │   │   │   ├── pages.service.ts        # Páginas y bloques + ownership
│   │   │   │   └── trm.service.ts          # TRM scraping + cache
│   │   │   ├── templates/            # Módulo de plantillas PDF
│   │   │   └── users/                # Módulo de usuarios
│   │   │       └── dto/              # CreateUserDto
│   │   └── uploads/                  # Archivos subidos (NO en git)
│   ├── web/                          # Frontend React + Vite
│   │   └── src/
│   │       ├── components/
│   │       │   └── proposals/        # Componentes compartidos (PdfPreviewModal, ItemPickerModal, etc.)
│   │       ├── hooks/                # Hooks de negocio
│   │       │   ├── useDashboard.ts
│   │       │   ├── useProjections.ts
│   │       │   ├── useScenarios.ts
│   │       │   ├── useProposalBuilder.ts
│   │       │   └── useProposalPages.ts
│   │       ├── lib/                  # Utilidades compartidas
│   │       │   ├── pricing-engine.ts # Fuente única de cálculos financieros
│   │       │   ├── constants.ts      # Constantes centralizadas
│   │       │   ├── types.ts          # Tipos compartidos (source of truth)
│   │       │   ├── api.ts            # Instancia Axios + interceptores
│   │       │   └── exportExcel.ts    # Exportación a Excel
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx     # (~405 líneas)
│   │       │   ├── dashboard/        # Componentes extraídos del Dashboard
│   │       │   │   ├── BillingCards.tsx
│   │       │   │   └── ProjectionModal.tsx
│   │       │   ├── proposals/
│   │       │   │   ├── ProposalCalculations.tsx  # (~363 líneas)
│   │       │   │   ├── ProposalDocBuilder.tsx     # (~527 líneas)
│   │       │   │   ├── ProposalItemsBuilder.tsx
│   │       │   │   └── components/               # Componentes extraídos
│   │       │   │       ├── ScenarioItemRow.tsx
│   │       │   │       ├── ScenarioSidebar.tsx
│   │       │   │       ├── ScenarioHeader.tsx
│   │       │   │       ├── CityCombobox.tsx
│   │       │   │       ├── LockedPageView.tsx
│   │       │   │       ├── VirtualSectionPreview.tsx
│   │       │   │       ├── PageEditor.tsx
│   │       │   │       └── BlockEditor.tsx
│   │       │   ├── admin/
│   │       │   ├── Users.tsx
│   │       │   └── Login.tsx
│   │       └── store/                # Zustand stores
│   │           └── authStore.ts
├── packages/
│   ├── ui/                           # Design system (infrautilizado)
│   ├── eslint-config/
│   └── typescript-config/
├── docs/
│   ├── audits/                       # Reportes de auditoría
│   └── NovoTechFlow_Plan_Implementacion.txt
├── CONVENTIONS.md                    # Este archivo
├── docker-compose.yml                # Stack completo (db + api + web)
└── .github/workflows/                # CI/CD
    ├── ci.yml
    └── pr-check.yml
```

**Reglas de ubicación para código nuevo:**
- Componente nuevo de una página específica → `pages/<pagina>/components/`
- Hook de negocio nuevo → `hooks/use<Nombre>.ts`
- Tipo nuevo compartido → `lib/types.ts`
- Constante nueva → `lib/constants.ts`
- Función de cálculo pura → `lib/pricing-engine.ts` (si es financiera) o nuevo archivo en `lib/`
- DTO nuevo del backend → `src/<modulo>/dto/`
- Servicio nuevo del backend → `src/<modulo>/<nombre>.service.ts`

---

### J. PRICING ENGINE (`lib/pricing-engine.ts`)

Fuente única de verdad para TODOS los cálculos financieros del proyecto. Contiene 17 funciones puras sin dependencias de React.

**Regla absoluta:** NINGÚN archivo del proyecto debe implementar cálculos de landed cost, dilución, margen o precio unitario por fuera del pricing-engine. Si necesitas un cálculo financiero nuevo, agrégalo aquí.

Funciones principales:
- `calculateParentLandedCost` — costo aterrizado del item padre
- `calculateChildrenCostPerUnit` — costo acumulado de sub-items
- `calculateBaseLandedCost` — costo base incluyendo hijos
- `calculateTotalDilutedCost` / `calculateTotalNormalSubtotal` — agregados para dilución
- `calculateDilutionPerUnit` — distribución proporcional de costos diluidos
- `calculateEffectiveLandedCost` — costo final con dilución
- `resolveMargin` — resolución de margen (override ?? base)
- `calculateUnitPrice` — precio unitario desde costo y margen
- `calculateLineTotal` — total de línea
- `calculateMarginFromPrice` — cálculo inverso (precio → margen)
- `calculateItemDisplayValues` — valores completos para un item
- `calculateScenarioTotals` — totales de escenario (gravado, no gravado, IVA, total, margen global)

Consumidores: `useScenarios.ts`, `ProposalCalculations.tsx`, `Dashboard.tsx` (via useDashboard), `exportExcel.ts`, `ScenarioTotalsCards.tsx`

---

### K. SEGURIDAD IMPLEMENTADA

Medidas de seguridad ya activas (auditoría abril 2026):
- JWT sin fallback — app crashea si no hay `JWT_SECRET` en `.env`
- CORS restringido a orígenes específicos (`CORS_ORIGIN` en `.env`)
- Ownership check (IDOR) en TODOS los endpoints de propuestas, escenarios, páginas y bloques
- `forbidNonWhitelisted: true` — rechaza campos extra en requests
- Helmet con CSP, HSTS, X-Frame-Options
- Rate limiting global (30/min) + estricto en login (5/min)
- Upload: validación de magic bytes + sanitización de originalname
- XSS: sanitización con sanitize-html en campos de texto
- ParseUUIDPipe en todos los parámetros de ID
- Transacciones atómicas en operaciones de delete
- Swagger/OpenAPI en `/api/docs`

**Al agregar endpoints nuevos, SIEMPRE:**
1. Agregar `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`
2. Pasar `req.user` y verificar ownership
3. Usar DTOs tipados con class-validator
4. Agregar `ParseUUIDPipe` a params de ID
