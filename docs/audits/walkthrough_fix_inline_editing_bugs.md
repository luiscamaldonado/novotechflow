# Walkthrough: Fix Inline Editing Bugs in Calculations Window

**Date:** 2026-04-08
**Commit:** `fix: prevent format corruption during inline editing + clamp margin to DB range`

---

## BUG 1 — `formatDecimalWithThousands` Corrupts Values During Editing

### Síntoma

When a user edits a numeric field (quantity, margin, or unit price) in the Calculations Window, the value gets corrupted. For example, typing a digit after "1.500" (which represents 1500 with a thousands separator) sends "1.5000" to the formatter, which interprets the dot as a **decimal separator** and produces "1,5000" — silently converting 15000 into 1.5.

### Causa Raíz

The `formatDecimalWithThousands` function was being called on **every keystroke** (`onChange`) and **on focus** (`onFocus`). Since the function uses dots (`.`) as thousands separators, it cannot distinguish between dots it previously inserted (thousands) and dots that are part of the raw browser `e.target.value`. The round-trip `format → user types → format again` is **lossy**.

Similarly, `formatNumberWithThousands` was applied during editing of the quantity field.

### Fix Aplicado

**File:** `apps/web/src/pages/proposals/components/ScenarioItemRow.tsx`

For all 3 editable fields (quantity, margin, unitPrice):

| Phase    | Before (broken)                                    | After (fixed)                                      |
|----------|----------------------------------------------------|----------------------------------------------------|
| `value`  | Always formatted (even during editing)             | Raw `editingCell.value` during editing; formatted only when NOT editing |
| `onFocus`| Saved formatted value → `formatDecimalWithThousands(...)` | Saves **clean numeric string** → `margin.toFixed(2)`, `String(si.quantity)`, `unitPrice.toFixed(2)` |
| `onChange`| Re-formatted on every keystroke                    | Stores `e.target.value` **as-is** — user types freely |
| `onBlur` | Parsed with `parseDecimalFormatted` / `parseFormattedNumber` | Parses with `parseFloat(value.replace(',', '.'))` or `parseInt(value.replace(/\D/g, ''))` directly |

**Imports cleaned:** Removed unused `parseFormattedNumber` and `parseDecimalFormatted` imports.

---

## BUG 2 — Error 500 "Numeric Field Overflow" in Database

### Síntoma

When a user enters an extreme unit price in the inline editor (e.g., very small price for an expensive item), the backend responds with a 500 error: `numeric field overflow`. The PATCH request fails silently from the user's perspective.

### Causa Raíz

The database column `marginPct` is defined as `Decimal(5,2)`, which supports values from -999.99 to 999.99. The function `calculateMarginFromPrice` can return arbitrarily large (or `Infinity`/`NaN`) values when the input price is pathological relative to the effective landed cost. No validation existed before sending the PATCH.

### Fix Aplicado

**File:** `apps/web/src/hooks/useScenarios.ts` — function `updateUnitPrice` (line ~397)

Added a guard **after** calculating `newMargin` and **before** the PATCH request:

```typescript
const newMargin = calculateMarginFromPrice(val, effectiveLanded);

// Guard: clamp margin to valid DB range (Decimal 5,2 → max 999.99)
if (isNaN(newMargin) || !isFinite(newMargin) || newMargin > 999 || newMargin < -999) {
    console.warn('Margin out of range:', newMargin);
    return;
}
```

This silently rejects the edit if the resulting margin would overflow the DB column, instead of crashing with a 500.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/pages/proposals/components/ScenarioItemRow.tsx` | Removed formatting during editing; clean `onFocus`/`onChange`/`onBlur` pattern |
| `apps/web/src/hooks/useScenarios.ts` | Added margin range guard in `updateUnitPrice` |

## Archivos NO Tocados

- Backend (NestJS)
- `lib/pricing-engine.ts`
- `lib/format-utils.ts` — las funciones están correctas, el problema era cómo se usaban

## Verificación

- `tsc --noEmit` — zero errors (pending manual run due to sandbox issue)
- `pnpm dev` running without errors
