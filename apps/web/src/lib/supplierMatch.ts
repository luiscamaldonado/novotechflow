import type { SupplierCompany } from './types';

/** Similitud minima para considerar dos nombres como posible duplicado. */
const SIMILARITY_THRESHOLD = 0.82;

/** Diferencia relativa de longitud (post-strip de sufijo) por encima de la cual se descarta sin correr levenshtein. */
const MAX_LENGTH_DIFF_RATIO = 0.4;

/** Sufijos societarios comunes en Colombia que no distinguen una empresa de otra. */
const LEGAL_SUFFIXES = [
    'SAS',
    'S A S',
    'LTDA',
    'S A',
    'SA',
    'E S P',
    'ESP',
    'S EN C',
    'Y CIA',
    'BIC',
];

/** Replica la normalizacion del backend (suppliers.service.ts): trim, puntos a espacio, colapsa espacios, MAYUSCULAS. */
export function normalizeSupplierName(raw: string): string {
    return raw
        .trim()
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

/** Quita del final del nombre normalizado los sufijos societarios, repitiendo mientras haya match. */
function stripLegalSuffix(normalized: string): string {
    let result = normalized;
    let changed = true;
    while (changed) {
        changed = false;
        for (const suffix of LEGAL_SUFFIXES) {
            if (result === suffix) {
                result = '';
                changed = true;
                break;
            }
            if (result.endsWith(` ${suffix}`)) {
                result = result.slice(0, result.length - suffix.length - 1).trim();
                changed = true;
                break;
            }
        }
    }
    return result.length > 0 ? result : normalized;
}

/** Distancia de edicion entre dos strings, con dos filas en vez de matriz completa. */
function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
    let currentRow = new Array<number>(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
        currentRow[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            currentRow[j] = Math.min(
                previousRow[j] + 1,
                currentRow[j - 1] + 1,
                previousRow[j - 1] + cost,
            );
        }
        [previousRow, currentRow] = [currentRow, previousRow];
    }

    return previousRow[b.length];
}

/** Similitud [0,1] entre dos nombres de empresa, ignorando sufijos societarios y mayus/minus. */
export function nameSimilarity(a: string, b: string): number {
    const strippedA = stripLegalSuffix(normalizeSupplierName(a));
    const strippedB = stripLegalSuffix(normalizeSupplierName(b));
    const maxLen = Math.max(strippedA.length, strippedB.length);
    if (maxLen === 0) return 0;
    if (strippedA === strippedB) return 1;
    const dist = levenshtein(strippedA, strippedB);
    return 1 - dist / maxLen;
}

/** Empresas mas parecidas a un nombre dado (para prevenir duplicados al crear una nueva). */
export function findSimilarCompanies(
    name: string,
    companies: SupplierCompany[],
    limit = 3,
): SupplierCompany[] {
    const strippedTarget = stripLegalSuffix(normalizeSupplierName(name));

    const scored: { company: SupplierCompany; score: number }[] = [];
    for (const company of companies) {
        const strippedCandidate = stripLegalSuffix(normalizeSupplierName(company.name));
        const longer = Math.max(strippedTarget.length, strippedCandidate.length);
        if (longer > 0) {
            const lengthDiffRatio = Math.abs(strippedTarget.length - strippedCandidate.length) / longer;
            if (lengthDiffRatio > MAX_LENGTH_DIFF_RATIO) continue;
        }
        const score = nameSimilarity(name, company.name);
        if (score >= SIMILARITY_THRESHOLD) {
            scored.push({ company, score });
        }
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(entry => entry.company);
}
