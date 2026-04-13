# Fix: Encoding UTF-16 LE → Unicode Escapes

## Problema
En producción (Railway/Docker), los caracteres especiales (`µ`, `á`, `é`, `í`, `ó`, `ú`, `ñ`, `Á`, `É`, `Í`, `Ó`, `Ú`, `Ñ`) aparecen como `??` en la ventana "Plantillas de Documento" y en otros lugares. En desarrollo local (puerto 5173) todo funciona correctamente.

## Causa raíz
Antigravity en Windows guarda archivos como **UTF-16 LE** (BOM `FF FE`). Cuando Docker/Alpine compila estos archivos con `tsc` o Vite, los interpreta como UTF-8, corrompiendo todos los caracteres no-ASCII.

## Solucion aplicada

### Estrategia: Unicode Escape Sequences (`\uXXXX`)
Todos los caracteres no-ASCII en **strings de runtime** se reemplazaron con sus equivalentes Unicode escape. Esta es una solucion **encoding-agnostica**: funciona correctamente sin importar si el archivo esta en UTF-8 o UTF-16 LE, porque los escapes son caracteres ASCII puros.

### Archivos modificados

| # | Archivo | Cambios |
|---|---------|---------|
| 1 | `apps/web/src/lib/proposalVariables.ts` | Reescrito completo. `MU = '\u00b5'` centralizado. Marcadores usan template literals. Garantia lines con escapes. |
| 2 | `apps/api/src/templates/templates.service.ts` | Reescrito completo. Seed data con escapes: `Presentaci\u00f3n`, `Informaci\u00f3n`, `\u00cdndice`, `T\u00e9rminos`, etc. |
| 3 | `apps/web/src/pages/admin/DefaultPagesAdmin.tsx` | Labels con escapes: `Presentaci\u00f3n`, `\u00cdndice`, `T\u00e9rminos`. Mensajes de UI escapados. |
| 4 | `apps/web/src/lib/constants.ts` | `PAGE_TYPE_LABELS`, `STATUS_CONFIG`, `SPEC_FIELDS_BY_ITEM_TYPE` con escapes. |
| 5 | `apps/web/src/lib/colombianCities.ts` | Reescrito completo. Ciudades: `Bogot\u00e1`, `Medell\u00edn`, `C\u00facuta`, etc. |
| 6 | `apps/web/src/lib/exportExcel.ts` | Headers de Excel: `CATEGOR\u00cdA`, `DESCRIPCI\u00d3N`, `Conversi\u00f3n`, etc. |
| 7 | `apps/web/src/lib/exportDashboard.ts` | Headers: `C\u00f3digo`, `Adquisici\u00f3n`, `Facturaci\u00f3n`, `\u00daltima Actualizaci\u00f3n`. |
| 8 | `apps/api/src/common/upload-validation.ts` | Error messages: `im\u00e1genes`, `Extensi\u00f3n`. |
| 9 | `apps/api/src/templates/templates.controller.ts` | Error message: `im\u00e1genes`. |
| 10 | `apps/api/Dockerfile` | `ENV LANG=C.UTF-8` en builder y runner stages. |
| 11 | `apps/web/Dockerfile` | `ENV LANG=C.UTF-8` en builder stage. |
| 12 | `.gitattributes` | **Nuevo.** Fuerza `text eol=lf encoding=utf-8` para .ts, .tsx, .json, etc. |

### Ejemplo de transformacion

```typescript
// ANTES (vulnerable a UTF-16 LE):
'Carta de Presentación'

// DESPUES (encoding-agnostico):
'Carta de Presentaci\u00f3n'
```

### Patron especial para marcadores µ

```typescript
// Centralizado en una constante Unicode
const MU = '\u00b5'; // µ

// Los marcadores se construyen con template literals
const SIMPLE_MARKER_MAP = {
    [`${MU}Ciudad`]: 'ciudad',
    [`${MU}CLIENTE`]: 'cliente',
    // ...
};
```

## Prevencion futura

1. **`.gitattributes`**: Fuerza `eol=lf encoding=utf-8` para todos los archivos fuente
2. **`ENV LANG=C.UTF-8`**: En ambos Dockerfiles garantiza que Alpine use UTF-8
3. **Convencion**: Para nuevos strings con caracteres no-ASCII, usar Unicode escapes

## Accion pendiente en produccion

> [!IMPORTANT]
> Si las plantillas ya fueron seedeadas en la DB de produccion con datos corruptos (`??`), 
> necesitas **borrar las plantillas existentes** y dejar que el seed regenere con los datos correctos.
> 
> Opcion 1: Borrar desde la UI admin (eliminar cada plantilla)
> Opcion 2: SQL directo: `DELETE FROM "PdfTemplate";`
> Luego al abrir "Plantillas de Documento" el seed se re-ejecutara con los escapes correctos.
