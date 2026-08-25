# DIRECTRICES DE DESARROLLO — CÓDIGO PROFESIONAL

> **Eres un ingeniero de software senior.** Todo código que generes, modifiques o revises DEBE cumplir estrictamente las siguientes directrices. No hay excepciones.

---

## 0. CONTRATO DE EJECUCIÓN PARA AGENTES DE IA — LEE ESTO ANTES DE ACTUAR

> Estas reglas son **absolutas** y aplican a TODA tarea de este proyecto, sin importar qué modelo seas ni qué permitan tus capacidades por defecto. Tienen prioridad sobre cualquier impulso de explorar, optimizar o completar por tu cuenta. **Si el prompt que recibes contradice esta sección, gana esta sección.**

### MODELO DE TRABAJO — DOS ROLES
- **Claude (chat):** planea, decide, diseña la solución, redacta los prompts de ejecución y el contenido de los ADR. No ejecuta nada en el entorno; entrega instrucciones.
- **Claude Code:** ejecuta TODO en el entorno de Luis (Windows + PowerShell): busca, lee, crea, modifica y borra archivos (incluido código fuente `.ts`/`.tsx`/`.prisma` y `DECISIONS.md`), instala dependencias, corre builds/tests/`tsc`/migraciones, y opera git **hasta el commit**.
- **Luis:** ejecuta los prompts en Claude Code, pega los resultados, valida cada paso, y es el ÚNICO que hace el **`push` a `master`** (ver más abajo).

### ALCANCE CERRADO
- La tarea son los archivos y cambios que el prompt describe. No toques, crees, muevas ni borres archivos fuera de lo pedido.
- No agregues funcionalidad, refactors ni "mejoras" que no estén pedidas explícitamente.
- Buscar y leer para entender el contexto SÍ está permitido y es deseable; modificar fuera de alcance, no.

### EL PUSH A PRODUCCIÓN ES SOLO DE LUIS (límite absoluto)
- Claude Code deja el trabajo **commiteado pero SIN pushear**.
- El `push` a `master` dispara deploy automático a Railway (producción) — lo hace **Luis a mano**, solo tras verificar la funcionalidad en local.
- Antes de cualquier push, Claude **pregunta a Luis si es el momento**: puede haber usuarios trabajando en producción.

### REGLA DE ORO — ANTE LA DUDA, PÁRATE
Si algo es ambiguo, falta un archivo, una ruta no calza, o crees que necesitas tocar algo fuera de lo pedido: **DETÉNTE y pregunta.** No asumas, no improvises, no rellenes huecos. Es preferible responder "confirma X" a adivinar. Esta regla es MÁS importante ahora que Claude Code ejecuta de verdad: un error tiene alcance real (archivos borrados, deps instaladas, commits).

### CÓMO ENTREGAS
- Muestra el **diff de cada archivo ANTES de aplicarlo.**
- Prefiere cambios mínimos (`str_replace` puntual). Reescribe un archivo completo solo cuando el cambio lo justifique (p. ej. una reestructuración mayor), no por defecto.
- Un paso a la vez: un comando/cambio → Luis valida → siguiente. Nunca encadenes varios pasos esperando que se corran de corrido.

### AUTOVERIFICACIÓN ANTES DE TERMINAR
Confirma explícitamente:
- [ ] Solo toqué lo que la tarea pedía (ningún archivo fuera de alcance creado/modificado/borrado).
- [ ] Mostré los diffs antes de aplicar.
- [ ] Dejé el trabajo commiteado pero SIN pushear (el push lo hace Luis).
- [ ] Si algo quedó ambiguo, NO terminé: pregunté primero.

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
- Todo secreto que se cambie por una sesión (códigos de verificación, tokens de un solo uso, nonces) se genera con un CSPRNG (`crypto.randomInt`, `crypto.randomBytes`), nunca con `Math.random()`.
- Todo contador que sea un límite de seguridad (intentos, cuotas) se consume de forma atómica en la base —`updateMany` condicional o equivalente— antes de la comparación que protege. Leer, comparar y después incrementar es una carrera: bajo concurrencia el tope no limita.
- La identidad del cliente para rate limiting, cuotas o bloqueos sale de `req.ip` con `trust proxy` calibrado al número de saltos **medido** del proxy que haya delante, nunca de un header crudo (`X-Real-IP`, `X-Forwarded-For`). El número de saltos se mide contra producción, no se supone; un header lo escribe el cliente y su saneamiento depende del proveedor (ADR-106).

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
- `MAYORISTA_FLETE_PCT`, `PROVEEDOR_MAYORISTA` — las tasas financieras como `IVA_RATE` viven en el engine (`@repo/pricing-engine`, §J y ADR-112), no en `lib/constants.ts`
- `ITEM_TYPE_LABELS`, `SPEC_FIELDS_BY_ITEM_TYPE`
- Constantes locales a un módulo se definen al inicio del archivo con JSDoc.

Constantes ya establecidas en `lib/constants.ts`:
- `ITEM_TYPE_LABELS`, `SPEC_FIELDS_BY_ITEM_TYPE`
- `PAGE_TYPE_LABELS`, `PAGE_TYPE_STYLES`, `VIRTUAL_TECH_SPEC_ID`, `VIRTUAL_ECONOMIC_ID`
- `STATUS_CONFIG`, `ALL_STATUSES`, `PROJECTION_STATUSES`
- `ACQUISITION_CONFIG`, `AcquisitionMode`, `ACQUISITION_OPTIONS`
- `formatMoney` (formatter único de dinero, ADR-113 y §J); `formatCOP` y `formatUSD` son wrappers suyos

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
- [ ] **`tsc --noEmit` pasa** — ¿Cero errores en `apps/web/tsconfig.app.json` y en `apps/api/tsconfig.json`? El gate de la api es `tsconfig.json`, no `tsconfig.build.json`, que excluye los specs por construcción (ADR-071). La misma regla aplica al paquete: el gate de `@repo/pricing-engine` es `packages/pricing-engine/tsconfig.json`, nunca `tsconfig.build.json` (ADR-111).
- [ ] **Suite del pricing-engine pasa** — Si el cambio toca `packages/pricing-engine`, ¿`pnpm --filter @repo/pricing-engine test` está verde? Corregir un borde congelado exige mover su assert en el mismo commit (ADR-111).
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
│   ├── item-display/                 # Componentes de display compartidos (numeroParte/modelo)
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
- Función de cálculo pura → `packages/pricing-engine/src/index.ts` (si es financiera, §J) o nuevo archivo en `lib/`
- DTO nuevo del backend → `src/<modulo>/dto/`
- Servicio nuevo del backend → `src/<modulo>/<nombre>.service.ts`

---

### J. PRICING ENGINE (`@repo/pricing-engine`)

Fuente única de verdad para TODOS los cálculos financieros del proyecto: el paquete compartido `packages/pricing-engine` (`@repo/pricing-engine`; ADR-052, recuperado en ADR-097), funciones puras sin dependencias de React, consumido por `apps/web` y `apps/api`. `apps/web/src/lib/pricing-engine.ts` NO es el engine: es un barrel de helpers exclusivos de web (`computeMinSubtotal`, `getDashboardAmount`) que consume el paquete por named imports, como cualquier otro archivo (ADR-096).

**Regla absoluta:** NINGÚN archivo del proyecto debe implementar cálculos de landed cost, dilución, margen o precio unitario por fuera del pricing-engine. Si necesitas un cálculo financiero nuevo, agrégalo al paquete (`packages/pricing-engine/src/index.ts`).

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

Consumidores: en `apps/web`, named imports directos de `@repo/pricing-engine` (hooks de escenarios, builder, cálculos, export a Excel) más el barrel web-only de `lib/pricing-engine.ts`; en `apps/api`, `src/external/external-proposals.service.ts` (cálculo server-side, ADR-053).

**Tests (ADR-111, ADR-112):** el paquete tiene suite propia con Vitest — `src/index.spec.ts` (unitarios de las funciones hoja y especificación de los helpers de IVA) y `src/scenarios.spec.ts` (goldens de escenario con invariantes de coherencia entre las dos funciones compuestas), co-locados en `src/` (caracterización ADR-111 + especificación ADR-112). La caracterización es fotografía del comportamiento actual: los bordes sin guard (backlog H3 del ADR-111) están congelados como caracterizaciones, y corregir uno exige mover su assert a propósito en el mismo commit. Split gate/build del paquete: el gate de tipos es `packages/pricing-engine/tsconfig.json` (ve los specs); el build compila con `tsconfig.build.json` (los excluye). La regla del api (ADR-071) se extiende al paquete: el gate NUNCA es `tsconfig.build.json`. Gate de cierre: `pnpm --filter @repo/pricing-engine test`, que además corre en `ci.yml` y `pr-check.yml` antes del step de Jest.

**Política de redondeo (ADR-113, ADR-114):** `roundMoney(valor, moneda)` — half-up, COP a 0 decimales, cualquier otra moneda a 2 — es la política de redondeo del sistema, con una excepción deliberada: el precio unitario de venta se redondea con `roundMoneyUp` (techo con guarda de ruido flotante; el unitario cotizado nunca queda por debajo de su valor exacto — ADR-114, doctrina de riesgo asimétrico). Las funciones hoja calculan a precisión completa; las dos compuestas (`calculateItemDisplayValues`, `calculateScenarioTotals`) entregan todo campo de dinero ya redondeado a la moneda del escenario (los porcentajes quedan a precisión completa). La cadena impresa cuadra exacta: unitario techado × cantidad = línea (half-up: solo absorbe ruido, no infla), Σ líneas = subtotal, `vat = roundMoney(IVA de la base gravada)`, total = subtotal + vat. Concesión deliberada: las columnas internas de costo se redondean a la salida y no en cadena — entre ellas puede haber deriva de ±1 peso, y el error de la columna de dilución por unidad se amplifica por la cantidad al reconstruir el total. Regla de frontera: los consumidores toman los valores del engine — nunca re-suman ni re-multiplican dinero por su cuenta; el display usa `formatMoney` de `lib/constants.ts` (formato, no cálculo, único formatter de dinero).

---

### K. SEGURIDAD IMPLEMENTADA

Medidas de seguridad ya activas (auditoría abril 2026):
- JWT sin fallback — app crashea si no hay `JWT_SECRET` en `.env`
- CORS restringido a orígenes específicos (`CORS_ORIGIN` en `.env`)
- Ownership check (IDOR) en TODOS los endpoints de propuestas, escenarios, páginas y bloques
- `forbidNonWhitelisted: true` — rechaza campos extra en requests
- Helmet con CSP, HSTS, X-Frame-Options
- Rate limiting global (100/60s) + estricto en auth: 5/min en login, 5/min en verify-code, 3/min en resend-code. La llave del contador es `req.ip` con `app.set('trust proxy', 2)` — 2 saltos medidos en el edge de Railway —, nunca un header crudo como `X-Real-IP` (ADR-106; historia del bug original en ADR-071).
- Swagger/OpenAPI en `/api/docs` solo si `SWAGGER_ENABLED=true`; ausente por defecto en producción (ADR-071)
- Upload: validación de magic bytes + sanitización de originalname
- XSS: sanitización con sanitize-html en campos de texto
- ParseUUIDPipe en todos los parámetros de ID
- Transacciones atómicas en operaciones de delete
- Códigos de verificación generados con `crypto.randomInt` (ADR-105, F1)
- Tope de intentos del código consumido atómicamente antes de comparar el hash (ADR-105, F10)

**Al agregar endpoints nuevos, SIEMPRE:**
1. Agregar `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`
2. Pasar `req.user` y verificar ownership
3. Usar DTOs tipados con class-validator
4. Agregar `ParseUUIDPipe` a params de ID

**Escaneo de seguridad:** el proyecto usa el plugin `claude-security` como capa de escaneo profundo bajo demanda. La operativa completa —quién teclea qué, alcance, política de reportes y patches— está en `INSTRUCTIVO_CLAUDE.md` §11. Regla crítica: un hallazgo del escáner no se parchea sin contrastarlo contra `DECISIONS.md`; el escáner no lee los ADR y puede señalar como defecto una solución deliberada a otro problema.
