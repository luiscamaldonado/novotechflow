# Walkthrough: Export Excel — Moneda Costo, TRM Conversión, Moneda Venta

## Resumen del cambio

Se modificó `exportExcel.ts` con 3 ajustes en las columnas de la exportación Excel de la Ventana de Cálculos:

1. **Rename**: "MONEDA" → **"Moneda Costo"** (ancho: 10 → 14)
2. **Nueva columna**: **"TRM Conversión"** (col N, ancho 16) — muestra `scenario.conversionTrm` o `'N/A'` si es null/undefined. Formato numérico con separador de miles (`#,##0.00`), alineación derecha.
3. **Nueva columna**: **"Moneda Venta"** (col O, ancho 14) — muestra `scenario.currency || 'COP'`. Alineación centrada.

Ambas columnas nuevas se insertaron **después de MARGEN UNIT.** y **antes de VENTA UNIT.**, desplazando las columnas de venta de N–P a P–R.

## Mapeo de columnas antes → después

| Col | Antes (16 cols)      | Col | Después (18 cols)       |
|-----|----------------------|-----|-------------------------|
| A   | ITEM                 | A   | ITEM                    |
| B   | CATEGORÍA            | B   | CATEGORÍA               |
| C   | NOMBRE               | C   | NOMBRE                  |
| D   | TIPO                 | D   | TIPO                    |
| E   | FABRICANTE           | E   | FABRICANTE              |
| F   | DESCRIPCIÓN          | F   | DESCRIPCIÓN             |
| G   | MONEDA               | G   | **Moneda Costo** *(renamed, width 14)* |
| H   | CANTIDAD             | H   | CANTIDAD                |
| I   | COSTO UNIT.          | I   | COSTO UNIT.             |
| J   | IVA                  | J   | IVA                     |
| K   | SUBTOTAL COSTO       | K   | SUBTOTAL COSTO          |
| L   | TOTAL COSTO + IVA    | L   | TOTAL COSTO + IVA       |
| M   | MARGEN UNIT.         | M   | MARGEN UNIT.            |
| N   | VENTA UNIT.          | N   | **TRM Conversión** *(nueva)* |
| O   | SUBTOTAL VENTA       | O   | **Moneda Venta** *(nueva)*   |
| P   | TOTAL VENTA + IVA    | P   | VENTA UNIT.             |
|     |                      | Q   | SUBTOTAL VENTA          |
|     |                      | R   | TOTAL VENTA + IVA       |

## Estilos actualizados

| Propiedad              | Columnas afectadas (nuevas)              |
|------------------------|------------------------------------------|
| Numéricas ($)          | 9, 11, 12, **16**, **17**, **18** (antes: 14, 15, 16) |
| Centradas              | 1, 7, 8, 10, 13, **15** (Moneda Venta)  |
| TRM (derecha, `#,##0.00`) | **14** (solo si es number)            |
| Amber (costo)          | 9, 11, 12 (sin cambio)                  |
| Emerald (venta)        | **16**, **17**, **18** (antes: 14, 15, 16) |
| Indigo (margen)        | 13 (sin cambio)                          |
| SUM formulas           | K, L, **Q**, **R** (antes: K, L, O, P)  |
| Merge cells header     | 1–**18** (antes: 1–16)                   |
| Sum row loop           | 1–**18** (antes: 1–16)                   |

## Archivos modificados

- `apps/web/src/lib/exportExcel.ts` — único archivo modificado

## Datos de origen

| Columna         | Dato                                | Tipo por fila     |
|-----------------|-------------------------------------|-------------------|
| Moneda Costo    | `item.costCurrency \|\| 'COP'`      | Per-item           |
| TRM Conversión  | `scenario.conversionTrm ?? 'N/A'`  | Mismo por escenario|
| Moneda Venta    | `scenario.currency \|\| 'COP'`      | Mismo por escenario|

## Verificación

```bash
pnpm exec tsc --noEmit --project apps/web/tsconfig.app.json
```

## Comando de commit sugerido

```bash
git add -A; git commit -m "feat: rename Moneda to Moneda Costo, add TRM Conversión and Moneda Venta columns to Excel export"
```
