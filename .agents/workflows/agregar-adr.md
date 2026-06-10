---
description: "Appendea al final de DECISIONS.md el ADR ya formateado que se le pase, sin tocar nada más"
---
Actúa única y exclusivamente como un editor que añade un ADR nuevo al archivo DECISIONS.md (raíz del repo). El contenido del ADR ya viene redactado y formateado; tu única tarea es insertarlo correctamente.

REGLAS OBLIGATORIAS:
1. Edita SOLO DECISIONS.md. No toques, crees, muevas ni borres ningún otro archivo. No ejecutes comandos (pnpm, npm, npx, tsc, git, terminal/PowerShell) ni instales dependencias.
2. No hagas grep / codebase search global. Leer DECISIONS.md (el archivo objetivo) está permitido; explorar el resto del repo no.
3. Lee DECISIONS.md y verifica que el número ADR-NNN del bloque de abajo NO exista ya. Si ya existe ese número, DETENTE y avisa; no escribas nada.
4. Appendea el bloque de abajo al FINAL del archivo, dejando exactamente una línea en blanco entre el último ADR existente y el encabezado `## ADR-NNN` del bloque nuevo. El formato vigente separa los ADR ÚNICAMENTE con esa línea en blanco: NO insertes ninguna línea `---` antes ni después del bloque. Si el bloque pegado trae una línea `---` al comienzo o al final, omítela al insertarlo.
5. No reformatees, renumeres ni modifiques ningún ADR existente. No corrijas inconsistencias previas del archivo.
6. Conserva las tildes y caracteres UTF-8 tal cual; no los escapes ni los reemplaces.
7. Muestra el diff de DECISIONS.md ANTES de aplicarlo.
8. Ante cualquier duda o conflicto de numeración: DETENTE y pregunta. No asumas ni improvises.

ADR a insertar:
{{input}}
