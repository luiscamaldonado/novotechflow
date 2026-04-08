# Fix: Document Builder Currency Conversion Bug

## Descripción del Bug

En la **Ventana de Construcción del Documento** (PDF preview), los precios de venta se mostraban sin conversión de moneda cuando un item tenía una moneda de costo diferente a la moneda del escenario.

**Ejemplo:** Un item con `costCurrency: 'USD'` y `unitCost: 100` en un escenario con `currency: 'COP'` y `conversionTrm: 4200` mostraba el precio calculado sobre USD 100 (sin convertir) pero con el label "COP", produciendo precios absurdamente bajos.

## Causa Raíz

El archivo `apps/web/src/hooks/useProposalScenarios.ts` tenía su **propia función `calculateItemUnitPrice`** que duplicaba la lógica del pricing engine (`lib/pricing-engine.ts`), pero **sin llamar a `convertCost`** del pricing engine.

La función usaba `Number(item.unitCost)` directamente sin conversión de moneda, ignorando completamente los campos `costCurrency` del item y `conversionTrm` del escenario.

Además, los tipos locales del hook carecían de:
- `costCurrency?: string` en `ProposalItemData`
- `conversionTrm?: number | null` en `ScenarioData`

## Fix Aplicado

### 1. Import de `convertCost`
```diff
 import { IVA_RATE } from '../lib/constants';
+import { convertCost } from '../lib/pricing-engine';
```

### 2. Tipo `ProposalItemData` — campo `costCurrency`
```diff
     unitCost: number;
+    costCurrency?: string;
     marginPct: number;
```

### 3. Tipo `ScenarioData` — campo `conversionTrm`
```diff
     currency: string;
+    conversionTrm?: number | null;
     scenarioItems: ScenarioItemData[];
```

### 4. Función `calculateItemUnitPrice` — nuevos parámetros y conversión
```diff
 export function calculateItemUnitPrice(
     si: ScenarioItemData,
     allItems: ScenarioItemData[],
+    scenarioCurrency?: string,
+    conversionTrm?: number | null,
 ): number {
```

Conversión del costo del item padre:
```diff
-    const cost = Number(item.unitCost);
+    const rawCost = Number(item.unitCost);
+    const cost = convertCost(rawCost, item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
```

Conversión de costos de children:
```diff
-        const cCost = Number(child.item.unitCost);
+        const cRawCost = Number(child.item.unitCost);
+        const cCost = convertCost(cRawCost, child.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
```

Conversión de costos en dilución (items diluidos y normales):
```diff
-        totalDilutedCost += Number(di.item.unitCost) * di.quantity;
+        const diCost = convertCost(Number(di.item.unitCost), di.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
+        totalDilutedCost += diCost * di.quantity;

-        totalNormalSubtotal += Number(ni.item.unitCost) * ni.quantity;
+        const niCost = convertCost(Number(ni.item.unitCost), ni.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
+        totalNormalSubtotal += niCost * ni.quantity;
```

### 5. Llamada en `processScenario` — pasa currency y TRM
```diff
-        const unitSalePrice = calculateItemUnitPrice(si, allItems);
+        const unitSalePrice = calculateItemUnitPrice(si, allItems, scenario.currency, scenario.conversionTrm);
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/hooks/useProposalScenarios.ts` | Import `convertCost`, tipos actualizados, conversión de moneda en toda la función de cálculo |

## Verificación

```bash
pnpm exec tsc --noEmit --project apps/web/tsconfig.app.json
```

## Commit Sugerido

```bash
git add -A && git commit -m "fix: apply currency conversion in document builder price calculations"
```
