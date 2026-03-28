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
- `useScenarios` — CRUD de escenarios, cálculos financieros, TRM

### B. COMPONENTES REUTILIZABLES (Patrón del proyecto)

- Componentes reutilizables en `components/` con subcarpetas por dominio.
- Componentes de UI **nunca** importan `api` directamente. Reciben callbacks via props.
- **Data-driven**: Configuración declarativa en lugar de JSX condicional (ver `SPEC_FIELDS_BY_ITEM_TYPE`).
- **Controlled modals**: `isOpen`, `onClose`, `onAction` como props estándar.

Componentes ya establecidos:
- `SpecFieldsSection` — campos dinámicos con autocompletado
- `ItemPickerModal` — modal de picking de artículos
- `ScenarioTotalsCards` — tarjetas de totales financieros

### C. CONSTANTES CENTRALIZADAS

Magic numbers y strings centralizados en `lib/constants.ts`:
- `IVA_RATE`, `MAYORISTA_FLETE_PCT`, `PROVEEDOR_MAYORISTA`
- `ITEM_TYPE_LABELS`, `SPEC_FIELDS_BY_ITEM_TYPE`
- Constantes locales a un módulo se definen al inicio del archivo con JSDoc.

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
