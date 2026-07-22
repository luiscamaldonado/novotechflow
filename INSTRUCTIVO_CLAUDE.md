# INSTRUCTIVO PARA CLAUDE — PROYECTO NOVOTECHFLOW

> Manual operativo de Claude para este proyecto. Se lee **al iniciar cualquier feature** y **SIEMPRE antes de crear, appendear o modificar un ADR** en `DECISIONS.md`.
>
> Complementa —no reemplaza— `CONVENTIONS.md` (= `AGENTS.md`) y las instrucciones del proyecto en Claude. **Si algo aquí contradice `CONVENTIONS.md`, gana `CONVENTIONS.md`.**

---

## 1. Propósito y cuándo leerlo

Este archivo existe porque el riesgo más caro de Claude en este proyecto no es escribir mal código: es **dar por cierto algo que cambió** (el último número de ADR, el formato del archivo, el comportamiento actual de un método, una ruta). Una suposición silenciosa se cuela en un prompt de Claude Code o en un ADR y queda como deuda.

Leer este instructivo es obligatorio en dos momentos:

- **Al arrancar una feature** — antes de proponer la solución o el esbozo.
- **Antes de tocar `DECISIONS.md`** — crear un ADR nuevo o modificar uno existente.

No reemplaza el flujo de trabajo de las instrucciones del proyecto. Es la capa de "no asumas, confirma".

---

## 2. Modelo de trabajo — dos roles

Desde la eliminación de Antigravity, el proyecto opera con dos roles más Luis:

- **Claude (este chat):** planea, decide, diseña la solución, redacta los prompts de ejecución para Claude Code, y redacta el contenido de los ADR. **No ejecuta nada en el entorno**; entrega instrucciones.
- **Claude Code:** ejecuta **TODO** en el entorno de Luis (Windows + PowerShell): busca, lee, crea, modifica y borra archivos (incluido código fuente `.ts`/`.tsx`/`.prisma`, `DECISIONS.md` y demás markdown del repo), instala dependencias, corre builds/tests/`tsc`/migraciones, y opera git **hasta el commit**. **Ejecuta y reporta** (salida, diffs, hallazgos); **no decide el siguiente paso**.
- **Luis:** ejecuta los prompts en Claude Code, pega los resultados en el chat, valida cada paso, y es el **ÚNICO que hace el `push` a `master`**.

El flujo es siempre **un paso a la vez**: Claude (chat) redacta el prompt → Luis lo pega en Claude Code → Claude Code ejecuta y reporta, sin decidir el siguiente paso → Luis pega el resultado en el chat → Claude evalúa y decide el siguiente paso. Nunca se encadenan varios pasos esperando que se corran de corrido.

> **El push a producción es el único límite absoluto.** Claude Code deja el trabajo commiteado pero **sin pushear**. El `push` a `master` dispara deploy automático a Railway (producción) — lo hace **Luis a mano**, solo tras verificar la funcionalidad en local. Antes de cualquier push, Claude **pregunta a Luis si es el momento**: puede haber usuarios trabajando en producción.

**Railway vía CLI.** Claude Code opera Railway con el Railway CLI (instalado, autenticado como Luis, linkeado a novotechflow/production). El MCP local de Railway se intentó cablear pero no quedó operativo (el binario del CLI quedó en conflicto con el entorno tras un auto-update); queda como pendiente opcional. Las **lecturas** (deployments, logs, builds, variables, estado) las ejecuta libremente por CLI, sin pedir aprobación: `railway deployment list --json`, `railway logs --build`/`--deployment -n N` (el `-n` evita el hang de streaming), `railway status`, `railway variable list --json`. La **escritura y creación de variables** también la ejecuta Claude Code, pero **solo con aprobación previa de Luis, por operación**: Claude (chat) muestra la variable y el valor exactos, Luis da el visto bueno, y recién entonces va al prompt de ejecución. Ten en cuenta que cambiar una variable en Railway redeploya el servicio automáticamente. `railway up`/`redeploy` manuales y el push a `master` siguen siendo exclusivamente de Luis.

---

## 3. Regla madre — la memoria puede estar desactualizada

La memoria de Claude y los resúmenes de chats previos **pueden estar atrasados respecto al repo real.** Nunca se usan como fuente de verdad para datos que cambian.

Claude **NO asume desde memoria** ninguno de estos:

- El **último número de ADR** (la memoria puede decir 033 cuando ya van 035).
- El **estado actual del schema** (campos, tipos, relaciones).
- El **comportamiento actual de un método** (qué valida, qué guard tiene, si hace soft o hard delete).
- **Rutas de archivos** o nombres de componentes/hooks.

Para cualquiera de estos, Claude **confirma contra el código o el archivo real**: redacta un prompt de lectura para Claude Code (que lo corre y pega el resultado) o pide el contenido del archivo, y recién entonces decide. Cuando hay duda entre lo que "recuerda" y lo que ve, **gana lo que ve**.

> Lección registrada: en una sesión Claude asumió que el último ADR era el 033; en realidad ya existían el 034 y el 035. El ADR nuevo y tres mensajes de commit quedaron mal numerados. El chequeo de "confirma el último ADR contra el disco antes de redactar" lo habría evitado.

---

## 4. Protocolo de ADR (el núcleo)

Todo ADR —nuevo o modificado— sigue estos pasos. Sin atajos. La **escritura del ADR la hace Claude Code** (es markdown del repo); el cuidado de encoding es el mismo de siempre.

### 4.1 Antes de redactar: confirmar número y formato

Claude **no infiere** el número ni el formato. Redacta un prompt de lectura para Claude Code que corra:

```powershell
# Lista los encabezados de ADR existentes (numeración real)
Select-String -Path DECISIONS.md -Pattern "^## ADR-" -Encoding UTF8 | Select-Object -Last 8

# Muestra la última entrada completa, para copiar su molde exacto
Get-Content DECISIONS.md -Tail 60 -Encoding UTF8
```

- **Número = último ADR real + 1.** Nunca inferido de memoria.
- **Formato = el de la entrada MÁS RECIENTE**, no el de una vieja. Las entradas antiguas (p. ej. ADR-022–024) usan un molde distinto (`**Problema:**`, `**Decisión:**` en negrita). Las recientes usan encabezado `## ADR-0XX — <título>` con em-dash (—) y secciones `### Contexto`, `### Decisión`, `### Consecuencias`, `### Archivos`, `### Commits`, `### Pendientes`, con `**Fecha:** YYYY-MM-DD` y `**Estado:**`. Copiar el molde reciente al pie de la letra.
- **Separador entre ADR = una sola línea en blanco.** Los ADR recientes NO se separan con `---`; solo con un salto de línea. El `---` entre entradas es del formato viejo (ADR-001–020) y no se replica.

### 4.2 Encoding del ADR — EXCEPCIÓN a la regla de strings

`DECISIONS.md` usa **acentos UTF-8 reales** (tildes, eñes, `¿`, `→`), igual que `CONVENTIONS.md`. **Aquí NO se usan escapes Unicode.** La regla de `\u00XX` aplica a strings de JS/TS, no a este markdown. Tampoco se introduce **BOM**.

### 4.3 Cómo se escribe — vía Claude Code, append-only

- El ADR se appendea con **Claude Code**, escribiendo el archivo con el método sin-BOM de §7 (`[System.IO.File]::WriteAllText` + `UTF8Encoding::new($false)`) — no con un `Set-Content`/`Out-File` crudo, que ha roto el encoding del archivo en el pasado.
- La escritura es **append-only**: agregar al final del archivo, **jamás tocar ni reformatear entradas existentes**.
- El contenido del ADR lo redacta Claude (este chat) y se entrega como texto listo; Claude Code solo lo appendea con acentos UTF-8 reales (sin escapes, sin BOM).

### 4.4 Verificación antes de commitear

Tras appendear, Claude Code corre y pega:

```powershell
Get-Content DECISIONS.md -Tail 40 -Encoding UTF8
```

Claude revisa que **no haya mojibake** (`Ã³`, `Ã±`, `Â¿` y similares) y que el bloque haya quedado **completo**. Si hay mojibake, no se commitea: se corrige primero.

### 4.5 Commit propio

El ADR va en **commit separado**, con mensaje en **ASCII**:

```
docs: ADR-0XX <descripcion corta>
```

### 4.6 Modificar un ADR existente

- Se hace con `str_replace` **puntual** vía Claude Code. **Nunca se reescribe el archivo entero** ni se tocan otras entradas.
- Mismo cuidado de encoding (UTF-8 real, sin BOM) y misma verificación de mojibake (4.4) antes de commitear.

---

## 5. Flujo de una feature

Paso a paso, **sin afanes**. La fase de decisión es a fondo; la ejecución, sin ceremonia.

1. **Diagnóstico.** Claude entiende el estado actual leyendo código real (vía Claude Code), no memoria.
2. **Decisión.** Luis plantea; Claude analiza impacto, coherencia de lo pedido y alternativas, y recomienda; Luis decide. El **esbozo explícito** (objetivo + archivos + reglas) se usa **solo cuando hay una decisión real que tomar**, no para mecánica obvia (un grep, correr `tsc`); para esa mecánica el prompt va directo. Excepción: reescrituras grandes de documentos se muestran completas para aprobar antes de escribir. Claude **espera el visto bueno explícito** de Luis ("ok", "sigue", "confirmado") para pasar de la decisión a la ejecución. El plan aprobado queda vigente.
3. **Prompt(s) de Claude Code.** Claude redacta el/los prompt(s) de ejecución, **finales y listos para pegar** (sin borrador del prompt). Si la feature cruza capas o toca muchos archivos, se parte (ver §6).
4. **Ejecución y reporte.** Luis corre el prompt en Claude Code; Claude Code muestra los diffs antes de aplicar y reporta la salida; **no decide el siguiente paso**. Luis pega el resultado en el chat.
5. **Evaluación.** Claude (chat) evalúa lo reportado y, **en el mismo mensaje**, da veredicto + el siguiente prompt. Sin "¿avanzo?" entre pasos previstos. La validación de cada comando (`tsc`, migraciones, lint) es de Luis + Claude, no de Claude Code. Si algo se sale del plan, Claude se para y se re-decide.
6. **Commit limpio.** Claude Code commitea (atómico, mensaje ASCII) solo cuando el diff staged está limpio y `tsc` pasa. **Sin pushear.**
7. **Push.** Lo hace Luis, tras verificar en local, cuando Claude confirma que es el momento.

Claude **pregunta antes de inventar.** Prefiere un "confírmame X" a una suposición disfrazada.

---

## 6. Cómo se redacta un prompt para Claude Code

Claude Code corre en el entorno de Luis (Windows + PowerShell) y **sí puede buscar, leer, escribir y ejecutar**. El prompt va **acotado y explícito**:

- **Objetivo en una frase.** Verbo concreto: "ubica…", "léeme…", "corre `tsc` en…", "crea un script temporal que…", "edita X con str_replace…".
- **Rutas exactas si las tengo.** Si no, describir el término a buscar y dejar que Claude Code lo localice (ya no se le prohíbe buscar).
- **Qué reportar de vuelta:** el contenido, las rutas encontradas, la salida del comando, el conteo de ocurrencias — lo que el siguiente paso necesite.
- **Diffs antes de aplicar:** en cualquier edición, pedir que muestre el diff antes de escribir.
- **Recordatorios de entorno cuando apliquen:** sin BOM, `pnpm exec` nunca `npx`, `;` en vez de `&&`.
- **Alcance acotado:** si es solo lectura/búsqueda, decirlo ("solo lee y reporta, no modifiques nada"). Si no debe commitear ni pushear, decirlo.
- **Indicar siempre si el prompt es para una sesión NUEVA o la MISMA** de Claude Code (y por qué).
- **Indicar siempre la rama, en TODO prompt**, sea sesión nueva o la misma. La rama va **dentro del prompt** como paso 0: verificar `git branch --show-current`, hacer checkout si no coincide, y detenerse y reportar si el working tree tiene cambios sin commitear ajenos a la tarea.
- **Modelo y esfuerzo: se fijan al abrir la sesión, nunca dentro del prompt.** Claude Code no arranca si el pegado empieza con slash commands, así que el modelo y el esfuerzo no van en el texto del prompt. Se fijan con el flag de arranque o con slashes en su propio Enter (ver subsección). El prompt se pega limpio. El chat anuncia los cuatro datos **encima del bloque**: `Modelo: <x> · Effort: <y> · Sesión: NUEVA|MISMA · Rama: <rama>` (effort omitido si es el default del modelo).

### Selección de modelo y esfuerzo (por prompt)

Claude Code tiene dos perillas: **modelo** (qué tan capaz) y **esfuerzo** (cuánto razona antes de actuar). El esfuerzo es una escala **propia de cada modelo** — se elige el peldaño según la tarea, no hay acoplamiento fijo entre modelo y esfuerzo. Criterio: cuánto se le delega decidir y cuánto cuesta rehacer si falla. Heurística cuando algo sale mal: si Claude Code tenía el contexto, lo intentó y aun así falló, se sube de **modelo**; si falló por saltarse un archivo, no verificar o abandonar a medias, se sube el **esfuerzo**.

**Cómo se aplican** (Claude Code no arranca si el pegado empieza con `/`):
- **Sesión NUEVA:** abrir con `claude --model <x> --effort <y>` y pegar el prompt limpio. Haiku no tiene esfuerzo: `claude --model haiku` (sin `--effort`).
- **Sesión MISMA, solo si cambia modelo o esfuerzo:** enviar `/model <x>` y `/effort <y>` (cada uno en su propio Enter) y luego el prompt. Si no cambia nada, el prompt va limpio — el esfuerzo persiste en la sesión (`max` se resetea al cambiar de modelo, ahí se re-pone). OJO: `/model` guarda la elección como default de sesiones futuras; por eso la sesión NUEVA se abre siempre con el flag `--model`, que aplica solo a esa sesión y no arrastra.
- **Patrón normal:** si toda la tarea corre en el mismo modelo+esfuerzo, abrir la sesión una vez con el flag y pegar limpio cada prompt. El chat indica encima del bloque la sesión (NUEVA|MISMA) y, si cambió, qué arrancar o qué slashes mandar.

| Modelo | Cuándo | Escala | Peldaño típico |
|---|---|---|---|
| **Haiku** | Mecánico puro y bajo riesgo: `grep`/`Select-String`, correr `tsc`/build, `str_replace` verbatim **sobre código**. | — (sin esfuerzo) | — |
| **Sonnet** (default) | Buscar-y-reportar con juicio, ediciones que Claude Code arma desde la descripción, leer código para confirmar estado, migraciones rutinarias. **Piso obligatorio para todo markdown del repo** (`DECISIONS.md`, `CONVENTIONS.md`, `INSTRUCTIVO_CLAUDE.md`), aunque sea un `str_replace` verbatim. | low · medium · high · max (Sonnet 5 añade `xhigh`) | `high`; sube para juicio pesado, baja para lo mecánico |
| **Opus** | Ejecución compleja o irreversible: migración delicada, cambio multi-archivo que cruza capas, donde puedan surgir estados inesperados y haya que razonar. | low · medium · high · xhigh · max · **ultracode** | `xhigh`; `max` para lo más difícil; `ultracode` solo en refactor grande aprobado |
| **Fable** | El especialista: diagnóstico de causa raíz ambigua, incidentes donde no se sabe ni la capa, auditorías de invariantes (§10.6), tareas largas multi-paso que Opus no cierra. Incluido en el plan de Luis. Se abre con `claude --model fable`. | low · medium · high · xhigh · max | `high`; `xhigh` para lo más denso |

**`ultracode` (solo Opus):** manda `xhigh` al modelo **y además** deja que Claude Code orqueste workflows multi-agente por su cuenta. Eso afloja el gate del proyecto (un paso a la vez, diff antes de aplicar, Claude Code no decide), por lo que **no es default**: se usa solo cuando Luis aprueba explícitamente un refactor grande aceptando ese trade-off. Es session-only y no es valor de `--effort` — se prende con `/effort ultracode` (en su Enter) tras abrir `claude --model opus`.

**`opusplan`:** disponible pero de nicho. Solo hace algo en **Plan Mode** (Opus planea → Sonnet ejecuta), que el flujo normalmente evita porque el plan se arma en el chat. Aplica únicamente si se decide meter a Claude Code en Plan Mode para una tarea multi-archivo espinosa ya aprobada, con el plan de vuelta al chat para el OK de Luis.

**Split:** si el cambio toca **muchos archivos** o **cruza capas** (backend + frontend, o + PDF), Claude lo divide en prompts/pasos separados, y **anuncia cómo lo va a partir antes de redactar** el primero. Los comandos de validación van junto a su paso, no batcheados.

**Ejemplo — búsqueda + lectura:**
```
Estoy en el repo novotechflow (monorepo pnpm). Ubica dónde se define y dónde se usa `manualAmount`: busca en apps/web/src y apps/api/src los archivos .ts/.tsx/.prisma que lo mencionen y pégame las líneas con su ruta. Solo lee y reporta, no modifiques nada.
```

**Ejemplo — script temporal para verificar la DB (Prisma Client, porque `prisma db execute` no muestra `SELECT`):**
```
En apps/api, crea un script temporal en scripts/dev/ que use Prisma Client para contar cuántas Proposal tienen manualAmount no nulo e imprima el resultado por consola. Córrelo con el runner de TS que ya use el repo (pnpm exec, nunca npx; encadena con ; nunca &&), pégame la salida y luego borra el script. Si el archivo lleva acentos en strings, usa escapes Unicode.
```

---

## 7. Encoding por tipo de archivo (tabla de bolsillo)

| Contexto | Encoding correcto |
|---|---|
| **Strings de JS/TS** (literales) | Escapes Unicode: `\u00e9`, `\u00bf`, `\u2014` |
| **Text nodes de JSX** (texto visible) | Caracteres UTF-8 **reales** (los escapes se renderizan literales) |
| **Markdown del repo** (`DECISIONS.md`, `CONVENTIONS.md`, este archivo) | UTF-8 **real**, sin BOM |
| **Mensajes de commit** | ASCII |

Reglas operativas asociadas:
- `.gitattributes` con UTF-8 + LF; `ENV LANG=C.UTF-8` en ambos Dockerfiles.
- Claude Code crea/escribe archivos sin BOM con `[System.IO.File]::WriteAllText` + `UTF8Encoding::new($false)`.
- `Select-String` no matchea em-dashes ni acentos de archivos UTF-8 salvo con `-Encoding UTF8`; para patrones ASCII (p. ej. `^## ADR-`) no hay problema.

---

## 8. Commits y cierre

- **Atómicos por capa/concern.** No mezclar refactor con feature. Backend y frontend en commits distintos.
- **Conventional commits:** `feat(scope):`, `fix(scope):`, `refactor:`, `docs:`. Mensajes en ASCII.
- **ADR en commit aparte** (ver 4.5).
- **`git status` antes de `git add`.** Adds con **rutas explícitas**, nunca `git add .`.
- **El `push` a `master` lo hace Luis, no Claude Code.** Solo después de que Luis **verificó la funcionalidad en local**, y Claude debe **preguntarle si es el momento** (puede haber usuarios trabajando en producción). El push dispara `migrate deploy` automático en Railway (api y web son **servicios separados**); se revisa el log de ambos.
- Antes de cerrar una tarea grande, Claude recuerda: (1) `tsc --noEmit` en web y api, (2) commit atómico, (3) ADR si fue decisión arquitectónica, (4) confirmar el push.

---

## 9. Comandos PowerShell de referencia (paste-ready)

> Encadenar con `;` (nunca `&&`). Usar `pnpm exec` (nunca `npx`: resuelve a global y rompe versiones pinneadas como Prisma 5.10.2).
> Estos comandos los corre **Claude Code**: Claude redacta el prompt, Luis lo pega y devuelve el resultado.

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

## 10. Protocolo de depuración

Aplica a todo bug, regresión o incidente. Complementa el flujo de feature (§5); cuando el trabajo es depurar, mandan las reglas de esta sección. El método general vive en el skill `depuracion-web` (Claude.ai); esta sección es el protocolo operativo del proyecto y lo que los prompts de Claude Code necesitan llevar.

### 10.1 Regla madre — diagnóstico ≠ cambio

Ante un bug reportado, la primera entrega es el **diagnóstico**: causa raíz + evidencia que la respalda + fix mínimo propuesto. **Ningún fix se aplica sin aprobación explícita de Luis.** Una señal que se parece a una falla conocida puede tener otra causa: antes de cualquier acción que cambie estado (ediciones, migraciones, reinicios), la evidencia debe respaldar **esa** acción específica.

### 10.2 Fases

0. **Reproducir y capturar evidencia.** Stack trace, código HTTP, request/response, logs, observado vs esperado. Alcance: ¿un usuario o todos?, ¿qué entorno?, ¿desde cuándo?, ¿qué cambió antes (deploy, dependencia, config, migración)? Sin evidencia, la fase 1 es conseguir evidencia, no proponer fixes.
1. **Explorar (solo lectura).** Código + historial del repo (`git log`, `git blame`, diffs de deploys recientes). Sin hipótesis todavía.
2. **Aislar la capa** antes de tocar código:

| Capa | Síntoma típico | Confirmación |
|---|---|---|
| Código de aplicación | excepción, lógica incorrecta, estado mal manejado | logs/tests dirigidos |
| Transporte / red | timeouts intermitentes, latencia sin patrón | logs de infraestructura |
| Config / entorno | falla solo en un entorno | comparar config entre entornos |
| Datos / estado | falla con ciertos registros | inspeccionar el dato exacto |
| Dependencias / build | rompe tras bump de versión o build | changelog y lockfile |

3. **Planear el fix mínimo.** Criterio de verificación definido **antes** de tocar código (qué test, qué flujo de navegador, qué log confirma). El bug fix es solo el fix: sin refactor ni limpieza de paso; `pricing-engine.ts` no se toca salvo que el bug esté ahí. Deuda detectada al paso se registra, no se arregla.
4. **Ejecutar.** Flujo de dos roles de siempre (§2): diff antes de aplicar, commit atómico, sin pushear.
5. **Verificar** con el checklist de 10.4.
6. **Registrar.** ADR si el fix fue arquitectónico o cambió un patrón (§4). Los falsos positivos ("parecía X, era Y") también se registran.

### 10.3 Modelos en depuración

- **Prompts de diagnóstico/causa raíz (solo lectura):** Fable, en sesión NUEVA abierta con `claude --model fable`, cuando el problema es ambiguo o no se sabe la capa (incidentes de producción, regresiones sin pista, auditorías de invariantes §10.6). Fable está incluido en el plan. Diagnóstico acotado con hipótesis clara: Opus. Lecturas dirigidas simples: Sonnet.
- **Prompts de fix:** tabla normal de §6. Lo mecánico no necesita Fable.
- **Reruteo del clasificador (Fable):** los clasificadores de Fable (ciber/bio) pueden marcar un request; Claude Code lo re-corre en Opus 4.8 con aviso, la pasada continúa y vale, y se vuelve con `/model fable`. Puede dispararse en el **primer request** de la sesión, porque ese request lleva el CLAUDE.md y el git status del workspace. Mitigación: enmarcar verificaciones de seguridad en modo defensivo ("verifica que el guard niega X en todas las rutas"), nunca como caza de vulnerabilidades; `/clear` entre tareas no relacionadas; `claude --safe-mode` para descartar que lo disparen las customizaciones (desactiva CLAUDE.md, skills, MCP y hooks); con `/config` se puede apagar el cambio automático de modelo y elegir entre pasar a Opus o editar el prompt y reintentar en Fable. Es enrutamiento esperado del dominio, no una marca en la cuenta.

### 10.4 Checklist post-cambio (gate)

Sin esto, nada se declara resuelto:

- [ ] Diff de los archivos cambiados mostrado.
- [ ] Tests dirigidos del flujo tocado (si existen) antes que la suite completa.
- [ ] `tsc --noEmit` en web y api.
- [ ] Si algo falla: parar y reportar con la salida real. No continuar.
- [ ] Nada se declara resuelto sin evidencia de esta sesión.
- [ ] Flujos con estado (login, timers, polling, exportaciones): verificación del flujo completo en navegador — la hace Luis (CONVENTIONS §H).

### 10.5 Bloque obligatorio en prompts de diagnóstico

Va tal cual en todo prompt de Claude Code cuya tarea sea diagnosticar:

```
Solo diagnostica y reporta: no apliques ningún fix ni modifiques archivos.
No declares nada resuelto o confirmado sin evidencia de esta sesión (salida de comando, log, test); si algo falla, repórtalo con la salida real.
Reporta: causa probable + evidencia + archivo:línea + escenario concreto que lo reproduce.
```

### 10.6 Pasadas de auditoría (bugs ocultos)

Para buscar bugs que nadie reportó:

- **Una pasada = un invariante.** Sesión NUEVA, solo lectura. Ejemplos: "ningún consumidor del pricing-engine calcula por fuera", "un REPORTER no puede mutar nada por ninguna ruta", "todo timer/polling se limpia al desmontar".
- **Hallazgo = archivo:línea + escenario que lo dispara + severidad.** Sin escenario reproducible es hipótesis y se marca como tal.
- Hallazgos a `docs/audits/`. **Demostrar antes de arreglar** (test o script que lo reproduce). Fixes después, por cohortes, con gate por commit (lint + `tsc` + navegador + push de Luis).

---

> **Regla de oro de este instructivo:** ante cualquier dato que pueda haber cambiado —número de ADR, formato, schema, comportamiento, ruta— Claude **confirma contra el repo real antes de actuar.** No asume, no improvisa, no rellena huecos.
