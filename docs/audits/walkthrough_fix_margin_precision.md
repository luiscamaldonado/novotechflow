# Fix: Expand Margin Precision to Decimal(10,4)

## Descripción del Bug

Al editar el **precio unitario** de un item en la ventana de cálculos y poner un precio por debajo del costo, el margen calculado inverso podía exceder el rango de la columna `Decimal(5,2)` (±999.99) en la base de datos. El frontend aplicaba un clamp a ±999.99, **corrompiendo** el valor guardado y haciendo que el precio mostrado no correspondiera al precio ingresado por el usuario.

**Ejemplo:** Un item con costo aterrizado de $1,000 al que se le pone precio de venta $50 produce un margen de -1900%. Con `Decimal(5,2)`, este valor se clampeaba a -999.99%, mostrando un precio completamente distinto al ingresado.

## Causa Raíz

1. **Schema demasiado restrictivo**: `marginPct` y `marginPctOverride` usaban `Decimal(5,2)`, que solo soporta valores de -999.99 a 999.99.
2. **Clamp en el frontend**: `useScenarios.ts` clampeaba el margen calculado al rango ±999.99 antes de guardarlo, produciendo un valor de margen incorrecto.

## Fix Aplicado

### 1. Schema Prisma — ampliar precisión

```diff
# ProposalItem (línea 177)
-  marginPct     Decimal? @map("margin_pct") @db.Decimal(5, 2)
+  marginPct     Decimal? @map("margin_pct") @db.Decimal(10, 4)

# ScenarioItem (línea 216)
-  marginPctOverride Decimal? @map("margin_pct_override") @db.Decimal(5, 2)
+  marginPctOverride Decimal? @map("margin_pct_override") @db.Decimal(10, 4)
```

### 2. useScenarios.ts — eliminar clamp, redondear a 4 decimales

```diff
 if (isNaN(newMargin) || !isFinite(newMargin)) {
     console.warn('Invalid margin calculated:', newMargin);
     return;
 }
-// Clamp to DB precision (Decimal 5,2 → max ±999.99)
-const clampedMargin = Math.max(-999.99, Math.min(999.99, Math.round(newMargin * 100) / 100));
+// Round to 4 decimal places to match DB precision Decimal(10,4)
+const roundedMargin = Math.round(newMargin * 10000) / 10000;

-await api.patch(..., { marginPct: clampedMargin });
-... marginPctOverride: clampedMargin ...
+await api.patch(..., { marginPct: roundedMargin });
+... marginPctOverride: roundedMargin ...
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/api/prisma/schema.prisma` | `marginPct` y `marginPctOverride` de `Decimal(5,2)` → `Decimal(10,4)` |
| `apps/web/src/hooks/useScenarios.ts` | Reemplazar clamp con redondeo a 4 decimales |

## Migración SQL Pendiente

Ejecutar manualmente:
```bash
cd apps/api
npx prisma migrate dev --name expand_margin_precision --create-only
```

SQL esperado:
```sql
ALTER TABLE "proposal_items" ALTER COLUMN "margin_pct" TYPE DECIMAL(10,4);
ALTER TABLE "scenario_items" ALTER COLUMN "margin_pct_override" TYPE DECIMAL(10,4);
```

**Revisar el SQL generado antes de aplicar la migración.**

## Verificación

```bash
pnpm exec tsc --noEmit --project apps/web/tsconfig.app.json
```

## Commit Sugerido

```bash
git add -A && git commit -m "fix: expand margin precision to Decimal(10,4) + remove clamp in updateUnitPrice"
```
