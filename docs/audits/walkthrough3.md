# ProposalDocBuilder.tsx — Decomposition Walkthrough

## Resumen

Se descompuso `ProposalDocBuilder.tsx` de **1,087 líneas** a **527 líneas** (reducción del **51.5%**), extrayendo 5 sub-componentes y 4 constantes.

> [!NOTE]
> El archivo principal queda en 527 líneas en vez de la meta de 400, porque el bloque del sidebar (la lista de páginas con los 2 botones virtuales inline en el `.map()`) está fuertemente acoplado al estado del componente padre (`setActivePageId`, `setSelectedVirtualSection`, `movePage`, etc.) y extraerlo requeriría pasar ~10 callbacks, lo cual degradaría la legibilidad sin beneficio real.

---

## Tabla de Componentes

| Componente | Líneas (antes, inline) | Nuevo archivo | Líneas (nuevo) |
|---|---|---|---|
| `CityCombobox` | 102 (L556–L657) | [CityCombobox.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/components/CityCombobox.tsx) | 111 |
| `LockedPageView` | 35 (L661–L695) | [LockedPageView.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/components/LockedPageView.tsx) | 43 |
| `VirtualSectionPreview` | 115 (L699–L813) | [VirtualSectionPreview.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/components/VirtualSectionPreview.tsx) | 122 |
| `PageEditor` | 152 (L817–L968) | [PageEditor.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/components/PageEditor.tsx) | 166 |
| `BlockEditor` | 118 (L970–L1087) | [BlockEditor.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/components/BlockEditor.tsx) | 125 |
| **Constantes** | 26 (L23–L48) | [constants.ts](file:///d:/novotechflow/apps/web/src/lib/constants.ts) | +36 líneas |
| **ProposalDocBuilder** | **1,087** | — | **527** |

---

## Constantes extraídas a `constants.ts`

| Constante | Tipo |
|---|---|
| `PAGE_TYPE_LABELS` | `Record<string, string>` — labels de tipos de página |
| `PAGE_TYPE_STYLES` | `Record<string, {bg, text, border, icon}>` — icono + colores por tipo |
| `VIRTUAL_TECH_SPEC_ID` | `string` — ID virtual para sección de propuesta técnica |
| `VIRTUAL_ECONOMIC_ID` | `string` — ID virtual para sección económica |

---

## Diff de ProposalDocBuilder.tsx

### Imports eliminados (ya no se necesitan directamente)
```diff
-import RichTextEditor from '../../components/proposals/RichTextEditor';
-import { Image as ImageIcon, ListOrdered, FileSignature, Building2 } from 'lucide-react';
-import { Type, ImagePlus, Pencil } from 'lucide-react';
-import { COLOMBIAN_CAPITAL_CITIES } from '../../lib/colombianCities';
```

### Imports agregados
```diff
+import { PAGE_TYPE_LABELS, PAGE_TYPE_STYLES, VIRTUAL_TECH_SPEC_ID, VIRTUAL_ECONOMIC_ID } from '../../lib/constants';
+import CityCombobox from './components/CityCombobox';
+import LockedPageView from './components/LockedPageView';
+import VirtualSectionPreview from './components/VirtualSectionPreview';
+import PageEditor from './components/PageEditor';
```

### Código eliminado (~560 líneas)
```diff
-/** Page type display labels */
-const PAGE_TYPE_LABELS: Record<string, string> = { ... };         // 10 líneas
-const PAGE_TYPE_STYLES: Record<string, ...> = { ... };            // 10 líneas
-const VIRTUAL_TECH_SPEC_ID = '__virtual_tech_spec__';             // 2 líneas
-const VIRTUAL_ECONOMIC_ID = '__virtual_economic__';
-
-function CityCombobox({ ... }) { ... }                            // ~102 líneas
-function LockedPageView({ ... }) { ... }                          // ~35 líneas
-interface VirtualSectionPreviewProps { ... }
-function VirtualSectionPreview({ ... }) { ... }                   // ~115 líneas
-interface PageEditorProps { ... }
-function PageEditor({ ... }) { ... }                              // ~152 líneas
-interface BlockEditorProps { ... }
-function BlockEditor({ ... }) { ... }                             // ~118 líneas
```

---

## Verificación

- ✅ Ninguna funcionalidad cambiada
- ✅ Props y signatures idénticos
- ✅ Todos los imports resueltos correctamente
- ✅ Constantes compartidas centralizadas en `constants.ts`
- ⚠️ No se ejecutó `tsc` ni `pnpm` por instrucción del usuario
