// ──────────────────────────────────────────────────────────
// Agrupación de propuestas por versión — Parsing de código y grouping
// Funciones puras, sin dependencias de React/estado
// ──────────────────────────────────────────────────────────

/** Regex que separa el código base del sufijo numérico de versión */
const PROPOSAL_CODE_REGEX = /^(.+)-(\d+)$/;

// ── Interfaces exportadas ────────────────────────────────

/** Resultado del parsing de un proposalCode: segmento base + número de versión */
export interface ParsedProposalCode {
    baseCode: string;
    version: number;
}

/**
 * Grupo de versiones de una misma cotización.
 * `versions` está ordenado DESC por número de versión (mayor primero).
 * `activeVersion` es siempre `versions[0]` — la de mayor sufijo.
 */
export interface ProposalVersionGroup<T> {
    baseCode: string;
    versions: T[];
    activeVersion: T;
}

// ── Funciones ────────────────────────────────────────────

/**
 * Extrae el código base y el número de versión de un proposalCode.
 *
 * Formato esperado: `<base>-<versión>` (ej. `COT-LMA05003-2`).
 * - Si matchea: baseCode = todo antes del último guion, version = sufijo numérico.
 * - Guard defensivo: si NO matchea, baseCode = code completo, version = 1.
 */
export function parseProposalCode(code: string): ParsedProposalCode {
    const match = PROPOSAL_CODE_REGEX.exec(code);

    if (!match) {
        return { baseCode: code, version: 1 };
    }

    return { baseCode: match[1]!, version: Number(match[2]) };
}

/**
 * Agrupa filas de propuesta por su código base y expone la versión activa
 * (mayor sufijo numérico) de cada grupo.
 *
 * - Preserva el orden de PRIMERA APARICIÓN de cada baseCode en `rows`.
 * - Dentro de cada grupo: `versions` se ordena DESC por número de versión.
 * - `activeVersion` = `versions[0]` (la de mayor sufijo).
 * - No muta el array `rows` original.
 *
 * @param rows — filas con al menos un campo `code: string`.
 */
export function groupProposalRows<T extends { code: string }>(
    rows: T[],
): ProposalVersionGroup<T>[] {
    const groupMap = new Map<string, { items: Array<{ row: T; version: number }> }>();

    for (const row of rows) {
        const { baseCode, version } = parseProposalCode(row.code);
        let group = groupMap.get(baseCode);

        if (!group) {
            group = { items: [] };
            groupMap.set(baseCode, group);
        }

        group.items.push({ row, version });
    }

    const result: ProposalVersionGroup<T>[] = [];

    for (const [baseCode, group] of groupMap) {
        const sorted = [...group.items].sort((a, b) => b.version - a.version);
        const versions = sorted.map(entry => entry.row);

        result.push({
            baseCode,
            versions,
            activeVersion: versions[0]!,
        });
    }

    return result;
}
