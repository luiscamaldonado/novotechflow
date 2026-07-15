import { useState, useEffect, useRef, type RefObject } from 'react';
import { type ProcessedScenario } from './useProposalScenarios';

/**
 * Fuente unica de las alturas reales de fila de la tabla economica.
 *
 * Este hook y su contenedor de medicion (EconomicMeasureContainer) miden las
 * filas <tr> en el DOM. Cualquier consumidor que pagine la propuesta economica
 * sin estas alturas cae al FALLBACK_ROW_HEIGHT y pagina distinto que el PDF.
 */
export function useEconomicRowHeights(
    processedScenarios: ProcessedScenario[],
): { measureRef: RefObject<HTMLDivElement | null>; rowHeights: Map<string, number> } {
    const measureRef = useRef<HTMLDivElement>(null);
    const [rowHeights, setRowHeights] = useState<Map<string, number>>(new Map());

    // Measure economic table row heights in a hidden container
    useEffect(() => {
        if (processedScenarios.length === 0) return;

        const timer = setTimeout(() => {
            const container = measureRef.current;
            if (!container) return;

            const measured = new Map<string, number>();
            const rows = container.querySelectorAll<HTMLElement>('[data-measure-row]');
            rows.forEach((el) => {
                const id = el.getAttribute('data-measure-row');
                if (id) {
                    measured.set(id, el.getBoundingClientRect().height);
                }
            });

            setRowHeights(measured);
        }, 200);

        return () => clearTimeout(timer);
    }, [processedScenarios]);

    return { measureRef, rowHeights };
}
