import type { ProcessedScenario } from '../hooks/useProposalScenarios';
import { ECONOMIC_PDF_HEIGHTS } from './constants';

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

const {
    USABLE_HEIGHT,
    FIRST_SLICE_HEADER_HEIGHT,
    CONTINUATION_HEADER_HEIGHT,
    TABLE_HEAD_HEIGHT,
    TOTALS_BLOCK_HEIGHT,
    FALLBACK_ROW_HEIGHT,
} = ECONOMIC_PDF_HEIGHTS;

/**
 * Pagina los visibleItems del escenario en slices usando alturas reales
 * medidas en el DOM. Cada slice cabe en una hoja Letter a 96dpi (928px útiles).
 *
 * Algoritmo:
 * 1. Primera pasada — empaqueta filas en chunks por altura acumulada:
 *    - Primera hoja: budget = USABLE - headerIndigo - thead.
 *    - Continuaciones: budget = USABLE - headerCompacto - thead.
 *    - Una fila sola siempre entra aunque exceda el budget (evita loop infinito).
 * 2. Segunda pasada — acomoda el bloque de totales en la última hoja:
 *    - Si la suma de alturas + TOTALS_BLOCK_HEIGHT excede el budget de la última
 *      hoja, mueve la última fila a una hoja nueva; repite hasta que quepa o la
 *      hoja tenga 1 sola fila (corte de seguridad).
 *
 * Función PURA: sin React, sin side effects. Apta para tests unitarios.
 */
export function paginateEconomicProposal(
    scenario: ProcessedScenario,
    rowHeights: Map<string, number>,
): EconomicPageSlice[] {
    const items = scenario.visibleItems;

    // Caso vacío: una hoja vacía con totales
    if (items.length === 0) {
        return [{
            items: [],
            isFirstSlice: true,
            showTotals: true,
            sliceIndex: 0,
            totalSlices: 1,
        }];
    }

    // Altura real o fallback por item
    const heights = items.map(
        (vi) => rowHeights.get(vi.scenarioItem.id) ?? FALLBACK_ROW_HEIGHT,
    );

    // ── Primera pasada: empaquetar filas por altura acumulada ──
    const chunks: { items: VisibleItem[]; heights: number[] }[] = [];

    const getBudget = (first: boolean): number => {
        const headerH = first ? FIRST_SLICE_HEADER_HEIGHT : CONTINUATION_HEADER_HEIGHT;
        return USABLE_HEIGHT - headerH - TABLE_HEAD_HEIGHT;
    };

    let currentItems: VisibleItem[] = [];
    let currentHeights: number[] = [];
    let currentSum = 0;
    let budget = getBudget(true);

    for (let i = 0; i < items.length; i++) {
        const rowH = heights[i];

        // Si agregar la fila excede el budget Y ya hay al menos 1 fila → flush
        if (currentSum + rowH > budget && currentItems.length > 0) {
            chunks.push({ items: currentItems, heights: currentHeights });
            currentItems = [];
            currentHeights = [];
            currentSum = 0;
            budget = getBudget(false);
        }

        currentItems.push(items[i]);
        currentHeights.push(rowH);
        currentSum += rowH;
    }

    // Flush remanente
    if (currentItems.length > 0) {
        chunks.push({ items: currentItems, heights: currentHeights });
    }

    // ── Segunda pasada: acomodar el bloque de totales ──
    // El bloque de totales va al pie de la última hoja.
    // Si no cabe, mover la última fila de esa hoja a una hoja nueva.
    let lastIdx = chunks.length - 1;

    while (chunks.length > 0) {
        const last = chunks[lastIdx];
        const sumH = last.heights.reduce((a, b) => a + b, 0);
        const pageBudget = lastIdx === 0 ? getBudget(true) : getBudget(false);

        if (sumH + TOTALS_BLOCK_HEIGHT <= pageBudget) {
            break; // cabe
        }

        // Solo 1 fila: no podemos mover más (corte de seguridad)
        if (last.items.length <= 1) {
            break;
        }

        // Mover la última fila a una hoja nueva
        const movedItem = last.items.pop()!;
        const movedH = last.heights.pop()!;

        chunks.push({ items: [movedItem], heights: [movedH] });
        lastIdx = chunks.length - 1;
    }

    // ── Construir slices ──
    const total = chunks.length;
    return chunks.map((chunk, idx) => ({
        items: chunk.items,
        isFirstSlice: idx === 0,
        showTotals: idx === total - 1,
        sliceIndex: idx,
        totalSlices: total,
    }));
}
