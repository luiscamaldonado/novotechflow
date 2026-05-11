import type { ProcessedScenario } from '../hooks/useProposalScenarios';
import { ECONOMIC_PDF_PAGINATION } from './constants';

/** Tipo de un item visible del escenario (alias para legibilidad) */
type VisibleItem = ProcessedScenario['visibleItems'][number];

/** Una hoja de la propuesta económica en el PDF */
export interface EconomicPageSlice {
    /** Items que se renderizan en esta hoja */
    items: VisibleItem[];
    /** True solo en la primera hoja del escenario (header grande indigo) */
    isFirstSlice: boolean;
    /** True solo en la última hoja (renderiza el bloque de totales) */
    showTotals: boolean;
    /** Índice de la hoja dentro del escenario (0-based) */
    sliceIndex: number;
    /** Total de hojas del escenario */
    totalSlices: number;
}

/**
 * Parte los visibleItems del escenario en slices según ECONOMIC_PDF_PAGINATION.
 *
 * Reglas:
 * - Si caben en SINGLE_PAGE_MAX_ITEMS o menos → 1 slice con totales.
 * - Si no:
 *   - Slice 0: FIRST_PAGE_ITEMS items, sin totales.
 *   - Slices intermedios: MIDDLE_PAGE_ITEMS items, sin totales.
 *   - Último slice: hasta LAST_PAGE_ITEMS items + totales.
 *   - Si tras la primera y las intermedias el remanente excede LAST_PAGE_ITEMS,
 *     se promueve una intermedia adicional para no sobrecargar el último.
 *
 * Función PURA: sin side effects, sin React. Apta para tests unitarios.
 */
export function paginateEconomicProposal(scenario: ProcessedScenario): EconomicPageSlice[] {
    const items = scenario.visibleItems;
    const { SINGLE_PAGE_MAX_ITEMS, FIRST_PAGE_ITEMS, MIDDLE_PAGE_ITEMS, LAST_PAGE_ITEMS } = ECONOMIC_PDF_PAGINATION;

    // Caso simple: todo cabe en una hoja
    if (items.length <= SINGLE_PAGE_MAX_ITEMS) {
        return [{
            items,
            isFirstSlice: true,
            showTotals: true,
            sliceIndex: 0,
            totalSlices: 1,
        }];
    }

    // Estrategia: tomar FIRST, luego MIDDLEs, dejar el remanente para el último.
    // Si el remanente queda > LAST, agregamos otra MIDDLE.
    const chunks: VisibleItem[][] = [];
    chunks.push(items.slice(0, FIRST_PAGE_ITEMS));
    let cursor = FIRST_PAGE_ITEMS;

    // Llenar intermedias mientras el remanente no quepa en la última hoja
    while (items.length - cursor > LAST_PAGE_ITEMS) {
        chunks.push(items.slice(cursor, cursor + MIDDLE_PAGE_ITEMS));
        cursor += MIDDLE_PAGE_ITEMS;
    }

    // Última hoja: el remanente (puede tener entre 1 y LAST_PAGE_ITEMS items)
    chunks.push(items.slice(cursor));

    const total = chunks.length;
    return chunks.map((chunk, idx) => ({
        items: chunk,
        isFirstSlice: idx === 0,
        showTotals: idx === total - 1,
        sliceIndex: idx,
        totalSlices: total,
    }));
}
