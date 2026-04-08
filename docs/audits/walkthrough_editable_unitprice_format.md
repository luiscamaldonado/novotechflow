# Walkthrough: Editable Unit Price Cell + Thousands Separator Formatting

**Fecha:** 2026-04-08
**Tipo:** feat (nueva funcionalidad + mejora UX)

---

## Resumen del Cambio

Se restauró y mejoró la funcionalidad de edición inline del precio unitario en la Ventana de Cálculos (`ScenarioItemRow`) y se agregó formato de miles colombiano (punto como separador de miles, coma como separador decimal) a todos los inputs numéricos editables.

### Comportamiento resultante

1. **Precio unitario editable:** El comercial hace click en la celda de precio unitario → aparece un input editable → escribe un precio nuevo (ej: `1.500.000,00`) → al salir, el margen se recalcula automáticamente vía `calculateMarginFromPrice` del pricing-engine.
2. **Formato de miles:** Todos los inputs numéricos (cantidad, margen, precio unitario) muestran separadores de miles mientras el usuario escribe.
3. **Items diluidos:** NO permiten editar el precio unitario (muestran "—").
4. **Modo DaaS:** Muestra el precio como read-only con estilo pink.
5. **TRM:** Ya tenía formato de miles implementado previamente con `formatTrmValue`/`parseTrmValue`.

---

## Archivos Modificados

### `apps/web/src/lib/format-utils.ts` (MODIFICADO)

Se agregaron 2 funciones nuevas para manejo de números con decimales en formato colombiano:

- **`formatDecimalWithThousands(value: string): string`** — Formatea un string numérico con separadores de miles (punto) y decimales (coma). Ideal para inputs de edición inline donde el usuario escribe libremente.
  - `"1234567.89"` → `"1.234.567,89"`
  - `"50"` → `"50"`

- **`parseDecimalFormatted(value: string): string`** — Remueve el formato de miles y devuelve un string numérico limpio para `parseFloat()`.
  - `"1.234.567,89"` → `"1234567.89"`

> **¿Por qué no reutilizar `formatTrmValue`/`parseTrmValue`?**
> Esas funciones aceptan `number` y siempre fuerzan 2 decimales. Las nuevas funciones aceptan `string` y preservan lo que el usuario escribe (sin forzar decimales), lo cual es necesario para edición inline fluida.

### `apps/web/src/pages/proposals/components/ScenarioItemRow.tsx` (MODIFICADO)

Cambios aplicados a las 3 celdas editables:

| Celda | Campo `editingCell.field` | Formatter | Parser |
|-------|--------------------------|-----------|--------|
| Cantidad | `'quantity'` | `formatNumberWithThousands` (enteros) | `parseFormattedNumber` → `String()` |
| Margen | `'margin'` | `formatDecimalWithThousands` | `parseDecimalFormatted` |
| Precio Unitario | `'unitPrice'` | `formatDecimalWithThousands` | `parseDecimalFormatted` |

#### Patrón de edición inline (aplicado a las 3 celdas):

```tsx
<input 
    type="text"
    value={editingCell?.id === si.id && editingCell?.field === '<field>'
        ? editingCell.value                          // ← valor formateado del buffer
        : formatDecimalWithThousands(value.toFixed(2))} // ← valor calculado formateado
    onFocus={() => setEditingCell({
        id: si.id!, field: '<field>',
        value: formatDecimalWithThousands(value.toFixed(2))
    })}
    onChange={(e) => setEditingCell({
        id: si.id!, field: '<field>',
        value: formatDecimalWithThousands(e.target.value)  // ← re-formatea al escribir
    })}
    onBlur={(e) => {
        updateFn(si.id!, parseDecimalFormatted(e.target.value)); // ← envía valor limpio
        setEditingCell(null);
    }}
    onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditingCell(null);  // ← cancela sin guardar
    }}
/>
```

#### Flujo precio unitario → margen inverso:

```
Usuario escribe "1.500.000,00"
  → parseDecimalFormatted → "1500000.00"
  → updateUnitPrice(siId, "1500000.00")
    → useScenarios.ts: parseFloat("1500000.00") = 1500000
    → calculateMarginFromPrice(1500000, effectiveLandedCost)
    → PATCH /api/scenarios/items/:id { marginPct: newMargin }
    → State update → re-render con nuevo margen
    → calculateScenarioTotals recalcula margen global
```

---

## Archivos NO Tocados (según requerimiento)

- ❌ Backend — Sin cambios
- ❌ `lib/pricing-engine.ts` — Sin cambios
- ❌ `hooks/useScenarios.ts` — Sin cambios (`updateUnitPrice` ya funcionaba correctamente)
- ✅ `ScenarioHeader.tsx` — Ya tenía formato TRM implementado, no requirió cambios

---

## Verificación

```powershell
pnpm exec tsc --noEmit --project apps/web/tsconfig.app.json
```

---

## Commit Sugerido

```bash
git add -A; git commit -m "feat: editable unit price cell with auto-margin recalc + thousand separator formatting"
```
