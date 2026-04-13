# Instrucciones para Luis — 3 acciones

---

## ACCIÓN 1: Copiar DECISIONS.md a la raíz del monorepo

Copia el archivo `DECISIONS.md` (que se descarga junto a este archivo) a la raíz de `D:\novotechflow\`.
Debe quedar al lado de `CONVENTIONS.md`:

```
novotechflow/
├── CONVENTIONS.md
├── DECISIONS.md       ← NUEVO
├── AGENTS.md
├── docker-compose.yml
└── ...
```

Después commitea:
```powershell
cd D:\novotechflow
git add DECISIONS.md
git commit -m "docs: add DECISIONS.md with architectural decisions (ADR-001 to ADR-010)"
```

---

## ACCIÓN 2: Actualizar la sección Referencias del skill en Antigravity

En tu workspace de Antigravity, abre el archivo del skill `novotechflow/SKILL.md`.
Busca la sección `## Referencias` (al final del archivo) y reemplázala por:

```markdown
## Referencias

- Convenciones completas: `CONVENTIONS.md` en la raíz del monorepo
- Decisiones de arquitectura: `DECISIONS.md` en la raíz del monorepo
  Leer cuando: se va a tocar pricing-engine, servicios de backend, schema de Prisma,
  formato numérico, lógica de moneda/TRM, encoding de archivos, o cualquier feature ya implementada.
- Plan de implementación: `docs/NovoTechFlow_Plan_Implementacion.txt`
- TRM histórica: https://www.datos.gov.co
- Swagger/OpenAPI: `http://localhost:3000/api/docs`
```

---

## ACCIÓN 3: Prompt de diagnóstico de encoding (para Antigravity)

Este es el prompt corregido. Ábrelo en un chat nuevo de Antigravity:

> **Lee `CONVENTIONS.md` y `DECISIONS.md` (especialmente ADR-005: Encoding UTF-8 obligatorio).**
>
> **Contexto:** En producción (Railway), los caracteres especiales se rompen en la ventana "Plantillas de Documento" (tanto admin como comercial). El carácter `µ` (usado como prefijo de marcadores de reemplazo: `µCiudad`, `µCLIENTE`, `µCOT`, `µAsunto`, `µValidez`, `µFechaEmision`) aparece como `??`. También las vocales con tilde (á é í ó ú Á É Í Ó Ú) y la ñ/Ñ aparecen como `??`. En desarrollo local (puerto 5173) todo funciona correctamente.
>
> **Causa raíz probable:** Antigravity en Windows guarda archivos como UTF-16 LE (ya documentado en ADR-005 con `prisma/seed.ts`). Docker/Node.js en producción no interpretan UTF-16 LE y reemplazan caracteres no-ASCII por `??`.
>
> **Diagnóstico — corre estos comandos en PowerShell y muéstrame TODOS los resultados:**
>
> **1. Listar todos los archivos del módulo de templates del backend:**
> ```powershell
> Get-ChildItem apps\api\src\templates\ -Recurse -Name
> ```
>
> **2. Buscar archivos que contengan los marcadores de reemplazo usando PowerShell:**
> ```powershell
> Get-ChildItem apps\api\src -Recurse -Include *.ts | Select-String "Ciudad|CLIENTE|COT|Asunto|Validez|FechaEmision" | Select-Object Path, LineNumber, Line -First 20
> ```
> ```powershell
> Get-ChildItem apps\web\src -Recurse -Include *.ts,*.tsx | Select-String "Ciudad|CLIENTE|COT|Asunto|Validez|FechaEmision" | Select-Object Path, LineNumber, Line -First 20
> ```
>
> **3. Para CADA archivo encontrado en el paso 2, verificar encoding con los primeros 4 bytes:**
> ```powershell
> Get-Content <RUTA> -Encoding Byte | Select-Object -First 4
> ```
> Referencia (ver ADR-005):
> - `255 254` = UTF-16 LE → ROTO en producción
> - `239 187 191` = UTF-8 con BOM → OK pero no ideal
> - Bytes ASCII normales (ej: `105 109 112`) = UTF-8 sin BOM → correcto
>
> **4. Mostrar el Dockerfile del API completo:**
> ```powershell
> Get-Content apps\api\Dockerfile
> ```
>
> **5. Verificar encoding de la conexión PostgreSQL:**
> ```powershell
> Get-Content docker-compose.yml
> ```
>
> **NO hagas cambios todavía. Solo muéstrame los resultados de los 5 pasos.**
