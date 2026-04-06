# 🔍 Auditoría de Duplicación de Lógica Financiera

> [!IMPORTANT]
> Se identificaron **4 archivos** con lógica de cálculos financieros duplicada (no 3). El archivo `exportExcel.ts` también contiene una copia completa del engine de cálculos.

---

## 1. Mapa de Archivos Involucrados

| # | Archivo | Rol | Líneas con cálculos |
|---|---------|-----|---------------------|
| A | [useScenarios.ts](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts) | **Source of truth** — hook de estado + cálculos | L353–487 |
| B | [ProposalCalculations.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalCalculations.tsx) | Cálculos **inline en el JSX** para display de tabla | L512–559 |
| C | [Dashboard.tsx](file:///d:/novotechflow/apps/web/src/pages/Dashboard.tsx) | Función `computeMinSubtotal` para cards de facturación | L26–69 |
| D | [exportExcel.ts](file:///d:/novotechflow/apps/web/src/lib/exportExcel.ts) | Cálculos para generar filas del Excel | L136–193 |

---

## 2. Tabla Maestra de Fórmulas

### 2.1 Landed Cost del Padre (parentLandedCost)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `parentLandedCost = unitCost × (1 + fletePct / 100)` |
| **Entradas** | `item.unitCost`, `item.internalCosts.fletePct` |
| **Salida** | Costo unitario aterrizado del ítem padre |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L364, L435 | `cost * (1 + flete / 100)` | ✅ Base |
| **ProposalCalculations.tsx** | L534 | `cost * (1 + flete / 100)` | ✅ Idéntica |
| **Dashboard.tsx** | L39 | `cost * (1 + flete / 100)` | ✅ Idéntica |
| **exportExcel.ts** | L167 | `cost * (1 + flete / 100)` | ✅ Idéntica |

> **Diferencias:** Ninguna. Las 4 son idénticas.

---

### 2.2 Children Cost Per Unit (childrenCostPerUnit)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `childrenCostPerUnit += childUnitCost × (1 + childFletePct / 100) × childQuantity` |
| **Entradas** | `child.item.unitCost`, `child.item.internalCosts.fletePct`, `child.quantity` |
| **Salida** | Costo total acumulado de sub-ítems ocultos |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L370–373, L439–443 | `cCost * (1 + cFlete / 100) * child.quantity` | ✅ Base |
| **ProposalCalculations.tsx** | L539–543 | `cCost * (1 + cFlete / 100) * child.quantity` | ✅ Idéntica |
| **Dashboard.tsx** | L43–47 | `cCost * (1 + cFlete / 100) * child.quantity` | ✅ Idéntica |
| **exportExcel.ts** | L172–176 | `cCost * (1 + cFlete / 100) * child.quantity` | ✅ Idéntica |

> **Diferencias:** Ninguna.

---

### 2.3 Base Landed Cost (baseLandedCost)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `baseLandedCost = parentLandedCost + (childrenCostPerUnit / quantity)` |
| **Entradas** | `parentLandedCost`, `childrenCostPerUnit`, `si.quantity` |
| **Salida** | Costo aterrizado unitario incluyendo sub-ítems |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L375, L446 | `parentLandedCost + (childrenCostPerUnit / si.quantity)` | ✅ Base |
| **ProposalCalculations.tsx** | L544 | `parentLandedCost + (childrenCostPerUnit / si.quantity)` | ✅ Idéntica |
| **Dashboard.tsx** | L50 | `parentLanded + (childrenCost / si.quantity)` | ✅ Idéntica (solo nombres de variables) |
| **exportExcel.ts** | L177 | `parentLandedCost + (childrenCostPerUnit / si.quantity)` | ✅ Idéntica |

> **Diferencias:** Solo nombres de variables en Dashboard.

---

### 2.4 Dilución: Total Diluted Cost (totalDilutedCost)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `totalDilutedCost = Σ(unitCost × quantity)` para ítems con `isDilpidate === true` |
| **Entradas** | Todos los `scenarioItems` donde `isDilpidate === true` |
| **Salida** | Costo total a diluir entre ítems normales |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L416–422 | `Number(si.item.unitCost) * si.quantity` | ✅ Base |
| **ProposalCalculations.tsx** | L517–520 | `Number(di.item.unitCost) * di.quantity` | ✅ Idéntica |
| **Dashboard.tsx** | — | **No implementada** | ⚠️ **AUSENTE** |
| **exportExcel.ts** | L141–144 | `Number(di.item.unitCost) * di.quantity` | ✅ Idéntica |

> [!WARNING]
> **Dashboard.tsx NO tiene lógica de dilución.** La función `computeMinSubtotal` ignora completamente los ítems diluidos — los trata como ítems normales con su propio precio, lo que produce subtotales **incorrectos** para propuestas que usan dilución.

---

### 2.5 Dilución: Total Normal Subtotal (peso para distribución)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `totalNormalSubtotal = Σ(unitCost × quantity)` para ítems con `isDilpidate === false` |
| **Entradas** | Todos los `scenarioItems` normales |
| **Salida** | Base para calcular peso proporcional de cada ítem |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L424–428 | `Number(si.item.unitCost) * si.quantity` | ✅ Base |
| **ProposalCalculations.tsx** | L522–526 | `Number(ni.item.unitCost) * ni.quantity` | ✅ Idéntica |
| **Dashboard.tsx** | — | **No implementada** | ⚠️ **AUSENTE** |
| **exportExcel.ts** | L146–149 | `Number(ni.item.unitCost) * ni.quantity` | ✅ Idéntica |

---

### 2.6 Dilución: Peso del ítem (itemWeight) y dilución por unidad

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `itemWeight = (unitCost × quantity) / totalNormalSubtotal` |
| **Fórmula** | `dilutionPerUnit = (itemWeight × totalDilutedCost) / quantity` |
| **Entradas** | `unitCost`, `quantity`, `totalNormalSubtotal`, `totalDilutedCost` |
| **Salida** | Costo de dilución distribuido por unidad |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L449–455 | `(cost * si.quantity) / totalNormalSubtotal` → `(itemWeight * totalDilutedCost) / si.quantity` | ✅ Base |
| **ProposalCalculations.tsx** | L549–552 | `(cost * si.quantity) / totalNormalSubtotal` → `(itemWeight * totalDilutedCost) / si.quantity` | ✅ Idéntica |
| **Dashboard.tsx** | — | **No implementada** | ⚠️ **AUSENTE** |
| **exportExcel.ts** | L182–184 | `(cost * si.quantity) / totalNormalSubtotal` → `(itemWeight * totalDilutedCost) / si.quantity` | ✅ Idéntica |

---

### 2.7 Effective Landed Cost (effectiveLandedCost)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `effectiveLandedCost = baseLandedCost + dilutionPerUnit` |
| **Entradas** | `baseLandedCost`, `dilutionPerUnit` |
| **Salida** | Costo unitario final ajustado (con dilución) |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L457 | `baseLandedCost + dilutionPerUnit` | ✅ Base |
| **ProposalCalculations.tsx** | L547–553 | `baseLandedCost + dilutionPerUnit` | ✅ Idéntica |
| **Dashboard.tsx** | L50 | Usa `effectiveLanded` directamente (= `baseLandedCost` sin dilución) | ⚠️ **DIFERENTE** |
| **exportExcel.ts** | L180–184 | `baseLandedCost + dilutionPerUnit` | ✅ Idéntica |

---

### 2.8 Resolución de Margen (margin)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `margin = marginPctOverride ?? item.marginPct` |
| **Entradas** | `si.marginPctOverride`, `item.marginPct` |
| **Salida** | Margen efectivo del ítem |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L459–460 | `marginOverride !== undefined && marginOverride !== null ? marginOverride : Number(item.marginPct)` | ✅ Base |
| **ProposalCalculations.tsx** | L555 | `si.marginPctOverride !== undefined ? si.marginPctOverride : Number(item.marginPct)` | ⚠️ **DIFERENTE** — no chequea `null` |
| **Dashboard.tsx** | L51 | `si.marginPctOverride ?? Number(item.marginPct)` | ⚠️ **DIFERENTE** — usa `??` (nullish coalescing) |
| **exportExcel.ts** | L187–189 | `si.marginPctOverride !== undefined && si.marginPctOverride !== null ? Number(si.marginPctOverride) : Number(item.marginPct)` | ✅ Idéntica al hook |

> [!CAUTION]
> **3 variantes distintas de la misma lógica:**
> - Hook: `!== undefined && !== null` (explícito)
> - ProposalCalculations: `!== undefined` (no chequea `null`)  
> - Dashboard: `??` (nullish coalescing, equivale a `!== undefined && !== null`)
>
> Si `marginPctOverride` es `null` (valor legítimo del backend), ProposalCalculations lo trataría como un override válido (`null`), lo que causaría `NaN` en cálculos posteriores.

---

### 2.9 Precio Unitario (unitPrice)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `unitPrice = effectiveLandedCost / (1 - margin / 100)` si `margin < 100` |
| **Entradas** | `effectiveLandedCost`, `margin` |
| **Salida** | Precio de venta unitario |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L462–465 | `effectiveLandedCost / (1 - margin / 100)` con guard `margin < 100` | ✅ Base |
| **ProposalCalculations.tsx** | L556–559 | `effectiveLandedCost / (1 - margin / 100)` con guard `!si.isDilpidate && margin < 100` | ⚠️ **DIFERENTE** — agrega check de dilución |
| **Dashboard.tsx** | L52–55 | `effectiveLanded / (1 - margin / 100)` con guard `margin < 100` | ✅ Idéntica |
| **exportExcel.ts** | L190–193 | `effectiveLandedCost / (1 - margin / 100)` con guard `margin < 100` | ✅ Idéntica |

> **Nota:** ProposalCalculations agrega la condición `!si.isDilpidate` porque muestra "—" para ítems diluidos en la UI. En el hook, los ítems diluidos se procesan en un bloque separado y nunca llegan a esta línea.

---

### 2.10 Total por Línea (lineTotal)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `lineTotal = unitPrice × quantity` |
| **Entradas** | `unitPrice`, `si.quantity` |
| **Salida** | Total de la línea del ítem |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L467 | `unitPrice * si.quantity` | ✅ Base |
| **ProposalCalculations.tsx** | L683 | `unitPrice * si.quantity` (inline en JSX) | ✅ Idéntica |
| **Dashboard.tsx** | L57 | `unitPrice * si.quantity` | ✅ Idéntica |
| **exportExcel.ts** | L199 | `unitPrice * si.quantity` | ✅ Idéntica |

---

### 2.11 Clasificación Gravado / No Gravado

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `if (item.isTaxable) → beforeVat += total; else → nonTaxed += total;` |
| **Entradas** | `item.isTaxable`, `lineTotal` |
| **Salida** | Acumuladores `beforeVat` / `nonTaxed` |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L470–474 | `item.isTaxable → beforeVat; else → nonTaxed` | ✅ Base |
| **ProposalCalculations.tsx** | — | **No calcula** (usa `totals` del hook) | ✅ Consume hook |
| **Dashboard.tsx** | L58–59 | `item.isTaxable → beforeVat; else → nonTaxed` | ✅ Idéntica |
| **exportExcel.ts** | — | Calcula implícitamente via `ivaPct` (L195) | ⚠️ Diferente enfoque |

---

### 2.12 Subtotal

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `subtotal = beforeVat + nonTaxed` |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L482 | `beforeVat + nonTaxed` | ✅ Base |
| **Dashboard.tsx** | L62 | `beforeVat + nonTaxed` | ✅ Idéntica |

---

### 2.13 IVA

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `vat = beforeVat × 0.19` |
| **Constante** | **Tasa IVA = 19% (0.19)** — hardcoded |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L483 | `beforeVat * 0.19` | ✅ Base |
| **exportExcel.ts** | L196 | `ivaPct = item.isTaxable ? 19 : 0` → `1 + ivaPct/100` | ✅ Mismo 19% |

---

### 2.14 Total con IVA

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `total = beforeVat + vat + nonTaxed` |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L484 | `beforeVat + vat + nonTaxed` | ✅ Base |
| **ScenarioTotalsCards** | L47 | Solo muestra `totals.total` (consume hook) | ✅ Consume |

---

### 2.15 Margen Global

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `globalMarginPct = ((totalPrice - totalCost) / totalPrice) × 100` |
| **Entradas** | `totalPrice` (subtotal), `totalCost` (Σ effectiveLandedCost × qty) |
| **Salida** | Margen global del escenario (%) |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L480–481 | `((totalPrice - totalCost) / totalPrice) * 100` | ✅ Solo aquí |

> Solo existe en el hook.

---

### 2.16 Cálculo inverso: Precio → Margen (updateUnitPrice)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `newMargin = ((unitPrice - effectiveLandedCost) / unitPrice) × 100` |
| **Entradas** | `val` (nuevo precio), `effectiveLandedCost` |
| **Salida** | Nuevo `marginPct` para almacenar |

| Archivo | Línea(s) | Código literal | ¿Idéntica? |
|---------|----------|----------------|------------|
| **useScenarios.ts** | L353–389 | `((val - effectiveLandedCost) / val) * 100` | ✅ Solo aquí |

> Solo existe en el hook. Incluye su propia copia del cálculo de `effectiveLandedCost` incluyendo children.

---

### 2.17 Landed Cost de hijos (display en ProposalCalculations)

| Atributo | Detalle |
|----------|---------|
| **Fórmula** | `cLanded = childUnitCost × (1 + childFletePct / 100)` |
| **Contexto** | Solo para **display** del costo individual de cada hijo en la UI |

| Archivo | Línea(s) | Código literal |
|---------|----------|----------------|
| **ProposalCalculations.tsx** | L737–738 | `cCost * (1 + cFlete / 100)` |

> Solo en ProposalCalculations. Es la misma fórmula base de landed cost pero aplicada a un hijo individual para mostrarlo en la UI.

---

## 3. Tabla Resumen de Cobertura

| Fórmula | useScenarios.ts | ProposalCalc.tsx | Dashboard.tsx | exportExcel.ts | ¿Idénticas? | Diferencias |
|---------|:-:|:-:|:-:|:-:|:-:|---|
| parentLandedCost | L364,435 | L534 | L39 | L167 | ✅ | — |
| childrenCostPerUnit | L370,439 | L539 | L43 | L172 | ✅ | — |
| baseLandedCost | L375,446 | L544 | L50 | L177 | ✅ | Solo nombres vars |
| totalDilutedCost | L416 | L517 | ❌ | L141 | ⚠️ | **Dashboard NO tiene** |
| totalNormalSubtotal | L424 | L522 | ❌ | L146 | ⚠️ | **Dashboard NO tiene** |
| itemWeight + dilutionPerUnit | L449 | L549 | ❌ | L182 | ⚠️ | **Dashboard NO tiene** |
| effectiveLandedCost | L457 | L547 | L50 ⚠️ | L180 | ⚠️ | Dashboard = sin dilución |
| margin resolution | L459 | L555 | L51 | L187 | ⚠️ | **3 variantes distintas** |
| unitPrice | L462 | L557 | L52 | L190 | ⚠️ | ProposalCalc guarda check dilución extra |
| lineTotal | L467 | L683 | L57 | L199 | ✅ | — |
| beforeVat / nonTaxed | L470 | via hook | L58 | per-row via IVA% | ✅ish | Enfoque distinto en Excel |
| subtotal | L482 | via hook | L62 | fórmula Excel | ✅ | — |
| IVA (19%) | L483 | via hook | ❌ | L196 | ✅ | Dashboard no calcula IVA |
| total con IVA | L484 | via hook | ❌ | fórmula Excel | ✅ | Dashboard no calcula total |
| globalMarginPct | L481 | via hook | ❌ | ❌ | ✅ | Solo en hook |
| updateUnitPrice (inversa) | L376 | ❌ | ❌ | ❌ | ✅ | Solo en hook |

---

## 4. Tipos e Interfaces Duplicados

### ScenarioTotals (2 definiciones idénticas)

| Archivo | Línea(s) | Campos |
|---------|----------|--------|
| [useScenarios.ts](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts#L41-L48) | L41–48 | `beforeVat, nonTaxed, subtotal, vat, total, globalMarginPct` |
| [types.ts](file:///d:/novotechflow/apps/web/src/lib/types.ts#L163-L170) | L163–170 | `beforeVat, nonTaxed, subtotal, vat, total, globalMarginPct` |

> Idénticas. `ScenarioTotalsCards.tsx` importa de `useScenarios.ts`, no de `types.ts`.

### ScenarioItem (2 definiciones con diferencias)

| Archivo | Línea(s) | Campos extra |
|---------|----------|-------------|
| [useScenarios.ts](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts#L22-L31) | L22–31 | `parentId`, `isDilpidate`, `children` |
| [types.ts](file:///d:/novotechflow/apps/web/src/lib/types.ts#L145-L151) | L145–151 | ❌ **Faltan** `parentId`, `isDilpidate`, `children` |

> [!WARNING]
> La interfaz `ScenarioItem` en `types.ts` **no incluye** los campos `isDilpidate`, `parentId`, ni `children`. Esto causaría problemas si algún componente importa `ScenarioItem` de `types.ts` y necesita esos campos.

### Scenario (2 definiciones idénticas)

| Archivo | Línea(s) |
|---------|----------|
| [useScenarios.ts](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts#L33-L39) | L33–39 |
| [types.ts](file:///d:/novotechflow/apps/web/src/lib/types.ts#L154-L160) | L154–160 |

### ProposalCalcItem (useScenarios) vs ProposalItemFromApi (types)

| Archivo | Interfaz | Campos |
|---------|----------|--------|
| useScenarios.ts L5–20 | `ProposalCalcItem` | Campos similares + `technicalSpecs` como `Record<string, string \| undefined>` |
| types.ts L111–124 | `ProposalItemFromApi` | Campos similares + `brand`, `partNumber`, `technicalSpecs` tipados |

> Son esencialmente la misma entidad pero con tipado ligeramente diferente.

---

## 5. Constantes Hardcoded

| Constante | Valor | Archivo(s) |
|-----------|-------|------------|
| **Tasa de IVA** | `0.19` / `19` | useScenarios.ts:L483, exportExcel.ts:L195 |
| **Guard de margen** | `margin < 100` (evitar división por cero) | useScenarios.ts:L463, Dashboard.tsx:L53, exportExcel.ts:L191, ProposalCalc.tsx:L557 |
| **Formato locales** | `'es-CO'` | ProposalCalc.tsx, Dashboard.tsx, ScenarioTotalsCards.tsx |

> [!TIP]
> La tasa de IVA del 19% está hardcoded como `0.19` y `19` en diferentes sitios. Debería ser una constante exportada.

---

## 6. Edge Cases y Condiciones Especiales

### 6.1 Ítems con Dilución (`isDilpidate = true`)

| Comportamiento | useScenarios.ts | ProposalCalc.tsx | Dashboard.tsx | exportExcel.ts |
|---|:-:|:-:|:-:|:-:|
| Se filtran de cálculos normales | ✅ L417–418 | ✅ L513–514 | ❌ **No filtra** | ✅ L138–139 |
| Su costo se distribuye proporcionalmente | ✅ L449–457 | ✅ L548–553 | ❌ | ✅ L181–184 |
| Margen forzado a 0 al activar | ✅ L336 (toggle) | ✅ Display "0.00" L615 | ❌ | N/A |
| Precio unitario = 0 | ✅ Implícito | ✅ L557 guard | ❌ Se calcula precio | ✅ Solo normal items |
| Display como "Diluido" | N/A | ✅ L679 | N/A | ✅ Excluidos del Excel |

> [!CAUTION]
> **BUG en Dashboard.tsx:** Los ítems diluidos no se excluyen. `computeMinSubtotal` les asigna precio unitario con su margen original, resultando en un subtotal inflado artificialmente.

### 6.2 Ítems sin IVA (`isTaxable = false`)

Manejado consistentemente en todos los archivos donde aplica (se suman a `nonTaxed` en vez de `beforeVat`).

### 6.3 División por Cero

| Condición | Protección |
|-----------|------------|
| `margin === 100` | Guard `margin < 100` → `unitPrice = 0` |
| `quantity === 0` | `si.quantity > 0` check en dilución del hook (L453) |
| `totalNormalSubtotal === 0` | Guard en hook L449, ProposalCalc L548, Excel L181 |

### 6.4 Modo DaaS (margen = 0)

Solo ProposalCalculations.tsx tiene lógica de DaaS (L60–100). Los márgenes se fuerzan a 0 en la UI, pero los cálculos del hook siguen siendo los mismos.

---

## 7. Resumen de Hallazgos Críticos

> [!CAUTION]
> ### Bugs / Inconsistencias Detectadas
>
> 1. **Dashboard.tsx ignora dilución completamente** — Subtotales incorrectos para propuestas con ítems diluidos
> 2. **Resolución de margen con 3 variantes** — Riesgo de `NaN` si `marginPctOverride === null` en ProposalCalculations.tsx
> 3. **Interface `ScenarioItem` desincronizada** — `types.ts` no tiene `isDilpidate`, `parentId`, `children`
> 4. **`ScenarioTotals` duplicada** — Definida idéntica en `useScenarios.ts` y `types.ts`

> [!IMPORTANT]
> ### Oportunidades de Consolidación
>
> 1. **Crear un módulo `calcEngine.ts`** con todas las funciones puras de cálculo
> 2. **Unificar tipos** en `types.ts` (single source of truth) y eliminar duplicados en `useScenarios.ts`
> 3. **Extraer constantes** (`IVA_RATE = 0.19`, `MAX_MARGIN = 100`)
> 4. **`computeMinSubtotal` en Dashboard** debe usar el mismo engine (incluyendo dilución)
> 5. **ProposalCalculations.tsx** debe consumir cálculos pre-computados en vez de recalcular inline
> 6. **exportExcel.ts** debe usar el engine centralizado
