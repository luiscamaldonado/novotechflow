# INSTRUCTIVO PARA CLAUDE — PROYECTO NOVOTECHFLOW

> Manual operativo de Claude para este proyecto. Se lee **al iniciar cualquier feature** y **SIEMPRE antes de crear, appendear o modificar un ADR** en `DECISIONS.md`.
>
> Complementa —no reemplaza— `CONVENTIONS.md` (= `AGENTS.md`) y las instrucciones del proyecto en Claude. **Si algo aquí contradice `CONVENTIONS.md`, gana `CONVENTIONS.md`.**

---

## 1. Propósito y cuándo leerlo

Este archivo existe porque el riesgo más caro de Claude en este proyecto no es escribir mal código: es **dar por cierto algo que cambió** (el último número de ADR, el formato del archivo, el comportamiento actual de un método, una ruta). Una suposición silenciosa se cuela en un prompt de Antigravity o en un ADR y queda como deuda.

Leer este instructivo es obligatorio en dos momentos:

- **Al arrancar una feature** — antes de proponer el esbozo.
- **Antes de tocar `DECISIONS.md`** — crear un ADR nuevo o modificar uno existente.

No reemplaza el flujo de trabajo de las instrucciones del proyecto ni la plantilla de prompts de Antigravity (Sección 3 de las instrucciones). Es la capa de "no asumas, confirma".

---

## 2. Regla madre — la memoria puede estar desactualizada

La memoria de Claude y los resúmenes de chats previos **pueden estar atrasados respecto al repo real.** Nunca se usan como fuente de verdad para datos que cambian.

Claude **NO asume desde memoria** ninguno de estos:

- El **último número de ADR** (la memoria puede decir 033 cuando ya van 035).
- El **estado actual del schema** (campos, tipos, relaciones).
- El **comportamiento actual de un método** (qué valida, qué guard tiene, si hace soft o hard delete).
- **Rutas de archivos** o nombres de componentes/hooks.

Para cualquiera de estos, Claude **confirma contra el código o el archivo real**: pide a Luis el `grep` (que él corre en PowerShell) o el contenido del archivo, y recién entonces decide. Cuando hay duda entre lo que "recuerda" y lo que ve, **gana lo que ve**.

> Lección registrada: en una sesión Claude asumió que el último ADR era el 033; en realidad ya existían el 034 y el 035. El ADR nuevo y tres mensajes de commit quedaron mal numerados. El chequeo de "pídeme el último ADR antes de redactar" lo habría evitado.

---

## 3. Protocolo de ADR (el núcleo)

Todo ADR —nuevo o modificado— sigue estos pasos. Sin atajos.

### 3.1 Antes de redactar: confirmar número y formato

Claude **no infiere** el número ni el formato. Pide a Luis que corra:

```powershell
# Lista los encabezados de ADR existentes (numeración real)
Select-String -Path DECISIONS.md -Pattern "^## ADR-" -Encoding UTF8 | Select-Object -Last 8

# Muestra la última entrada completa, para copiar su molde exacto
Get-Content DECISIONS.md -Tail 60 -Encoding UTF8
```

- **Número = último ADR real + 1.** Nunca inferido de memoria.
- **Formato = el de la entrada MÁS RECIENTE**, no el de una vieja. Las entradas antiguas (p. ej. ADR-022–024) usan un molde distinto (`**Problema:**`, `**Decisión:**` en negrita). Las recientes usan encabezado `## ADR-0XX — <título>` con em-dash (—) y secciones `### Contexto`, `### Decisión`, `### Consecuencias`, `### Archivos`, `### Commits`, `### Pendientes`, con `**Fecha:** YYYY-MM-DD` y `**Estado:**`. Copiar el molde reciente al pie de la letra.
- **Separador entre ADR = una sola línea en blanco.** Los ADR recientes NO se separan con `---`; solo con un salto de línea. El `---` entre entradas es del formato viejo (ADR-001–020) y no se replica.

### 3.2 Encoding del ADR — EXCEPCIÓN a la regla de strings

`DECISIONS.md` usa **acentos UTF-8 reales** (tildes, eñes, `¿`, `→`), igual que `CONVENTIONS.md`. **Aquí NO se usan escapes Unicode.** La regla de `\u00XX` aplica a strings de JS/TS, no a este markdown. Tampoco se introduce **BOM**.

### 3.3 Cómo se escribe — vía Antigravity, append-only

- Los ADR se appendean **con Antigravity, no con PowerShell** (PowerShell ha roto el encoding del archivo en el pasado).
- El prompt a Antigravity debe ser **append-only**: agregar al final del archivo, **jamás tocar ni reformatear entradas existentes**.
- El prompt incluye instrucción explícita de **escribir acentos UTF-8 reales (sin escapes, sin BOM)**.

### 3.4 Verificación antes de commitear

Tras aplicar, Luis corre y pega:

```powershell
Get-Content DECISIONS.md -Tail 40 -Encoding UTF8
```

Claude revisa que **no haya mojibake** (`Ã³`, `Ã±`, `Â¿` y similares) y que el bloque haya quedado **completo**. Si hay mojibake, no se commitea: se corrige primero.

### 3.5 Commit propio

El ADR va en **commit separado**, con mensaje en **ASCII**:

```
docs: ADR-0XX <descripcion corta>
```

### 3.6 Modificar un ADR existente

- Se hace con `str_replace` **puntual** vía Antigravity. **Nunca se reescribe el archivo entero** ni se tocan otras entradas.
- Mismo cuidado de encoding (UTF-8 real) y misma verificación de mojibake (3.4) antes de commitear.

---

## 4. Flujo de una feature

Paso a paso, **sin afanes**. Una fase → Luis valida → siguiente fase.

1. **Diagnóstico.** Claude entiende el estado actual leyendo código real (no memoria).
2. **Esbozo.** Claude propone objetivo + archivos + reglas relevantes y **espera el visto bueno explícito** de Luis ("ok", "sigue", "confirmado"). No avanza sin él.
3. **Prompt(s) de Antigravity.** Redactados con la plantilla de la Sección 3 de las instrucciones del proyecto. Si la feature cruza capas, se parte (ver Sección 6).
4. **Diffs.** Luis pega los diffs que devuelve Antigravity; Claude los revisa.
5. **Validación.** Luis corre `tsc` / migraciones (los comandos los corre él) y pega resultados.
6. **Commit limpio.** Solo cuando el diff staged está limpio y `tsc` pasa.

Claude **pregunta antes de inventar.** Prefiere un "confírmame X" a una suposición disfrazada.

---

## 5. Cero suposiciones de paths ni de comportamiento

- Claude **no dice "busca"** ni inventa rutas. Si no tiene una ruta exacta, **se la pide a Luis** y él corre el `grep`:

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.prisma | Select-String "<termino>"
```

- Para entender **qué hace hoy** un método/endpoint, Claude **lee el código que Luis pega**, no su memoria.
- Antigravity tiene prohibido buscar en el filesystem (se cuelga en el monorepo en Windows). Las búsquedas las corre Luis y pega resultados.

---

## 6. Reglas de prompts a Antigravity

- La **estructura del prompt** es la de la **Sección 3 de las instrucciones del proyecto** (contrato de encabezado + cierre, `ARCHIVOS A MODIFICAR` con rutas exactas, reglas de entorno). Este instructivo no la duplica: la referencia.
- **Split obligatorio:** si el cambio toca **más de 3 archivos** o **cruza capas** (backend + frontend, o + PDF), se divide en **chats de Antigravity separados**. Claude **anuncia cómo lo va a partir antes de redactar** el primero.
- Los comandos de validación van **fuera del prompt**, anotados "esto lo corro yo".

---

## 7. Encoding por tipo de archivo (tabla de bolsillo)

| Contexto | Encoding correcto |
|---|---|
| **Strings de JS/TS** (literales) | Escapes Unicode: `\u00e9`, `\u00bf`, `\u2014` |
| **Text nodes de JSX** (texto visible) | Caracteres UTF-8 **reales** (los escapes se renderizan literales) |
| **Markdown del repo** (`DECISIONS.md`, `CONVENTIONS.md`, este archivo) | UTF-8 **real**, sin BOM |
| **Config generada por Antigravity** | ASCII puro |
| **Mensajes de commit** | ASCII |

Reglas operativas asociadas:
- `.gitattributes` con UTF-8 + LF; `ENV LANG=C.UTF-8` en ambos Dockerfiles.
- Crear archivos sin BOM en PowerShell: `[System.IO.File]::WriteAllText` con `UTF8Encoding::new($false)`.
- `Select-String` no matchea em-dashes ni acentos de archivos UTF-8 salvo con `-Encoding UTF8`; para patrones ASCII (p. ej. `^## ADR-`) no hay problema.

---

## 8. Commits y cierre

- **Atómicos por capa/concern.** No mezclar refactor con feature. Backend y frontend en commits distintos.
- **Conventional commits:** `feat(scope):`, `fix(scope):`, `refactor:`, `docs:`. Mensajes en ASCII.
- **ADR en commit aparte** (ver 3.5).
- **`git status` antes de `git add`.** Adds con **rutas explícitas**, nunca `git add .`.
- **Nunca `push` sin el visto bueno de Luis.** El push a `master` dispara `migrate deploy` automático en Railway (api y web son **servicios separados**); se revisa el log de ambos.
- Antes de cerrar una tarea grande, Claude recuerda: (1) `tsc --noEmit` en web y api, (2) commit atómico, (3) ADR si fue decisión arquitectónica, (4) confirmar el push.

---

## 9. Comandos PowerShell de referencia (paste-ready)

> Encadenar con `;` (nunca `&&`). Usar `pnpm exec` (nunca `npx`: resuelve a global y rompe versiones pinneadas como Prisma 5.10.2).

**Ubicar un archivo (desde la raíz):**
```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.prisma | Select-String "<termino>"
```

**TypeScript check (antes de cada commit):**
```powershell
pnpm exec tsc --noEmit --project apps/web/tsconfig.app.json
pnpm exec tsc --noEmit --project apps/api/tsconfig.build.json
```

**Migración de Prisma (desde `apps/api`, nunca desde la raíz):**
```powershell
cd apps/api
pnpm exec prisma migrate dev --name <nombre_migracion>
pnpm exec prisma generate
```
> El `EPERM` sobre `query_engine-windows.dll.node` en `migrate dev` es cosmético. Si `generate` se queja del lock, parar los procesos Node y repetir.

**ADR — número y formato:**
```powershell
Select-String -Path DECISIONS.md -Pattern "^## ADR-" -Encoding UTF8 | Select-Object -Last 8
Get-Content DECISIONS.md -Tail 60 -Encoding UTF8
```

**ADR — verificación de encoding tras appendear:**
```powershell
Get-Content DECISIONS.md -Tail 40 -Encoding UTF8
```

**Git (status → add explícito → commit):**
```powershell
git status
git add <ruta1> <ruta2>
git commit -m "docs: ADR-0XX <descripcion>"
```

**Postgres local (Docker):**
```powershell
docker compose exec db psql -U admin -d novotechflow
```

---

> **Regla de oro de este instructivo:** ante cualquier dato que pueda haber cambiado —número de ADR, formato, schema, comportamiento, ruta— Claude **confirma contra el repo real antes de actuar.** No asume, no improvisa, no rellena huecos.
