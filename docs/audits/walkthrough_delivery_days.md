# Walkthrough — `deliveryDays` Feature (3 chats)

> **Fecha:** 2026-04-08
> **Commit:** `feat: add deliveryDays field to proposal items + display in constructor and PDF`

---

## Resumen

Se añadió el campo **Tiempo de Entrega** (`deliveryDays`) al modelo de `ProposalItem` a lo largo de todo el stack (DB → API → Frontend Builder → Constructor de Documento / PDF).

---

## Chat 1 — Prisma + Backend (API)

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/prisma/schema.prisma` | Añadir campo `deliveryDays Int?` al modelo `ProposalItem` |
| `apps/api/prisma/migrations/20260408224725_add_delivery_days/migration.sql` | Migración: `ALTER TABLE "proposal_items" ADD COLUMN "delivery_days" INTEGER;` |
| `apps/api/src/proposals/dto/create-proposal-item.dto.ts` | Añadir `@IsOptional() @IsInt() deliveryDays?: number` |
| `apps/api/src/proposals/dto/update-proposal-item.dto.ts` | Hereda campo vía `PartialType` |
| `apps/api/src/proposals/proposals.service.ts` | Incluir `deliveryDays` en los `select` de queries |

### Decisión de diseño

- Campo nullable (`Int?`) porque no todos los ítems tienen tiempo de entrega definido.
- Se usa `@IsInt()` en el DTO — el valor siempre se maneja como número entero de días.

---

## Chat 2 — Frontend Builder (ProposalItemsBuilder)

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/web/src/lib/types.ts` | Añadir `deliveryDays?: number \| null` a la interface `ProposalItem` |
| `apps/web/src/hooks/useProposalBuilder.ts` | Incluir `deliveryDays` en la firma de `addItem` y `updateItem` |
| `apps/web/src/pages/proposals/ProposalItemsBuilder.tsx` | Añadir input numérico "Días de Entrega" al formulario de ítems |

### Decisión de diseño

- Input de tipo `number` con `min=0` y step=1 para evitar decimales.
- Se coerciona con `Number()` antes de enviar al API (regla del proyecto).
- Valor `null` si el campo queda vacío → no se muestra en el documento.

---

## Chat 3 — Constructor de Documento / Vista Previa PDF (este chat)

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/web/src/hooks/useProposalScenarios.ts` | Añadir `deliveryDays?: number \| null` a `ProposalItemData` |
| `apps/web/src/pages/proposals/components/VirtualSectionPreview.tsx` | Mostrar "Tiempo de Entrega: X días" debajo de cada ítem en la sección de Propuesta Técnica |

### Decisión de diseño

- Solo se muestra cuando `deliveryDays != null && deliveryDays > 0` → ítems sin dato no muestran nada.
- Se renderiza como sub-línea sutil (`text-xs text-slate-500`) para no romper el layout existente.
- El wrapper `<div>` del ítem se reestructuró para acomodar la línea extra sin afectar la vista económica.

---

## Archivos modificados (todos los chats, consolidado)

```
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/20260408224725_add_delivery_days/migration.sql
apps/api/src/proposals/dto/create-proposal-item.dto.ts
apps/api/src/proposals/dto/update-proposal-item.dto.ts
apps/api/src/proposals/proposals.service.ts
apps/web/src/lib/types.ts
apps/web/src/hooks/useProposalBuilder.ts
apps/web/src/pages/proposals/ProposalItemsBuilder.tsx
apps/web/src/hooks/useProposalScenarios.ts
apps/web/src/pages/proposals/components/VirtualSectionPreview.tsx
```

---

## Comandos para verificar y commitear

```powershell
pnpm exec tsc --noEmit --project apps/web/tsconfig.app.json
git add -A
git commit -m "feat: add deliveryDays field to proposal items + display in constructor and PDF"
```
