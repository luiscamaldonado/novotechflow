import { type RefObject } from 'react';
import { type ProcessedScenario } from '../../hooks/useProposalScenarios';
import { PAGE_GEOMETRY } from '../../lib/constants';
import EconomicProposalTable from './EconomicProposalTable';

interface EconomicMeasureContainerProps {
    measureRef: RefObject<HTMLDivElement | null>;
    processedScenarios: ProcessedScenario[];
    variantLabelByScenarioItemId: Map<string, string | null>;
}

/**
 * Contenedor oculto que renderiza las tablas economicas solo para medir las
 * alturas reales de sus filas. Lo consume useEconomicRowHeights via measureRef.
 */
export default function EconomicMeasureContainer({
    measureRef,
    processedScenarios,
    variantLabelByScenarioItemId,
}: EconomicMeasureContainerProps) {
    return (
        <div ref={measureRef} style={{ position: 'fixed', top: -9999, left: -9999, width: PAGE_GEOMETRY.WIDTH_PX, pointerEvents: 'none' }}>
            {processedScenarios.map((scenario) => (
                <EconomicProposalTable
                    key={`measure-${scenario.id}`}
                    scenario={scenario}
                    variantLabelByScenarioItemId={variantLabelByScenarioItemId}
                    slice={{
                        items: scenario.visibleItems,
                        isFirstSlice: false,
                        showTotals: false,
                        sliceIndex: 0,
                        totalSlices: 1,
                    }}
                />
            ))}
        </div>
    );
}
