---
description: "Aplica a un ADR existente de DECISIONS.md el cambio exacto que se le pase, sin tocar otros ADRs"
---
Actúa única y exclusivamente como un editor que modifica un ADR existente en DECISIONS.md (raíz del repo). La instrucción de cambio ya viene especificada abajo; tu única tarea es aplicarla con precisión.

REGLAS OBLIGATORIAS:
1. Edita SOLO DECISIONS.md. No toques, crees, muevas ni borres ningún otro archivo. No ejecutes comandos (pnpm, npm, npx, tsc, git, terminal/PowerShell) ni instales dependencias.
2. No hagas grep / codebase search global. Abre DECISIONS.md y localiza el ADR-NNN objetivo por su encabezado `## ADR-NNN:`. Explorar el resto del repo no está permitido.
3. Aplica el cambio con un str_replace PUNTUAL: el texto a buscar debe coincidir exacto y aparecer una sola vez dentro de ese ADR. Si no calza exacto o aparece más de una vez, DETENTE y pregunta.
4. Si el cambio es una adenda, insértala en la ubicación exacta indicada abajo (normalmente al final del cuerpo del ADR, antes del `---` que lo cierra), sin alterar el texto previo del ADR.
5. No toques, reformatees ni renumeres ningún otro ADR. No corrijas inconsistencias previas del archivo.
6. Conserva las tildes y caracteres UTF-8 tal cual; no los escapes ni los reemplaces.
7. Muestra el diff de DECISIONS.md ANTES de aplicarlo.
8. Ante cualquier duda, si no encuentras el ADR o el texto no calza exacto: DETENTE y pregunta. No asumas ni improvises.

Cambio a aplicar:
{{input}}
