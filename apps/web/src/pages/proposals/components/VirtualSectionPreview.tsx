import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { type ProcessedScenario } from '../../../hooks/useProposalScenarios';
import { PAGE_TYPE_STYLES, VIRTUAL_TECH_SPEC_ID, PAGE_GEOMETRY } from '../../../lib/constants';
import { consolidateTechnicalItems } from '../../../lib/consolidateTechnicalItems';
import { paginateEconomicProposal } from '../../../lib/paginateEconomicProposal';
import { useEconomicRowHeights } from '../../../hooks/useEconomicRowHeights';
import EconomicMeasureContainer from '../../../components/proposals/EconomicMeasureContainer';
import PdfSheet from '../../../components/proposals/PdfSheet';
import TechnicalSpecSheet from '../../../components/proposals/TechnicalSpecSheet';
import EconomicProposalTable from '../../../components/proposals/EconomicProposalTable';

interface VirtualSectionPreviewProps {
    sectionId: string;
    processedScenarios: ProcessedScenario[];
}

/** Escala de la hoja en la vista previa de secciones virtuales */
const SHEET_SCALE = 0.6;

function VirtualSectionPreview({ sectionId, processedScenarios }: VirtualSectionPreviewProps) {
    const isTechSpec = sectionId === VIRTUAL_TECH_SPEC_ID;
    const style = PAGE_TYPE_STYLES[isTechSpec ? 'TECH_SPEC' : 'ECONOMIC'];
    const IconComponent = style.icon;

    const consolidation = useMemo(
        () => consolidateTechnicalItems(processedScenarios),
        [processedScenarios],
    );
    const totalTechItems = consolidation.items.length;

    const { measureRef, rowHeights } = useEconomicRowHeights(processedScenarios);

    const economicSheets = useMemo(
        () => processedScenarios.map(scenario => ({
            scenario,
            slices: paginateEconomicProposal(scenario, rowHeights),
        })),
        [processedScenarios, rowHeights],
    );

    const sheets = isTechSpec
        ? consolidation.items.map(consolidated => ({
            key: `tech-${consolidated.item.scenarioItem.id}`,
            content: (
                <TechnicalSpecSheet
                    item={consolidated.item}
                    globalIndex={consolidated.globalIndex}
                    totalItems={consolidation.items.length}
                    variantLabel={consolidated.variantLabel}
                />
            ),
        }))
        : economicSheets.flatMap(({ scenario, slices }) =>
            slices.map((slice, sliceIdx) => ({
                key: `econ-${scenario.id}-${sliceIdx}`,
                content: (
                    <EconomicProposalTable
                        scenario={scenario}
                        variantLabelByScenarioItemId={consolidation.variantLabelByScenarioItemId}
                        slice={slice}
                    />
                ),
            })),
        );

    return (
        <>
            {/* Contenedor oculto de medicion — SIEMPRE montado para no reiniciar la medicion al cambiar de seccion */}
            <EconomicMeasureContainer measureRef={measureRef} processedScenarios={processedScenarios} variantLabelByScenarioItemId={consolidation.variantLabelByScenarioItemId} />

            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100">
                <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center space-x-4">
                        <div className={cn("p-3 rounded-2xl shadow-lg", style.bg, style.border, "border")}>
                            <IconComponent className={cn("h-6 w-6", style.text)} />
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">
                                {isTechSpec ? 'Propuesta Técnica' : 'Propuesta Económica'}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", style.bg, style.text)}>
                                    Auto-generada
                                </span>
                                <span className="text-sm text-slate-400 font-medium">
                                    · {isTechSpec
                                        ? `${totalTechItems} ficha${totalTechItems !== 1 ? 's' : ''} técnica${totalTechItems !== 1 ? 's' : ''}`
                                        : `${processedScenarios.length} escenario${processedScenarios.length !== 1 ? 's' : ''}`
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {processedScenarios.length === 0 ? (
                        <div className="py-16 text-center">
                            <IconComponent className="h-16 w-16 mx-auto text-slate-100 mb-4" />
                            <p className="text-sm font-bold text-slate-400">
                                No hay escenarios configurados. Cree escenarios en la Ventana de Cálculos.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {sheets.map((sheet, idx) => (
                                <div
                                    key={sheet.key}
                                    style={{
                                        width: PAGE_GEOMETRY.WIDTH_PX * SHEET_SCALE,
                                        height: PAGE_GEOMETRY.HEIGHT_PX * SHEET_SCALE,
                                        position: 'relative',
                                    }}
                                >
                                    {/* Badge — fuera del transform, no se escala */}
                                    <div className="absolute -top-4 left-4 z-10 flex items-center space-x-2">
                                        <span className="px-4 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-600/30">
                                            Hoja {idx + 1}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            transform: `scale(${SHEET_SCALE})`,
                                            transformOrigin: 'top left',
                                            width: PAGE_GEOMETRY.WIDTH_PX,
                                            height: PAGE_GEOMETRY.HEIGHT_PX,
                                        }}
                                    >
                                        <PdfSheet>
                                            {sheet.content}
                                        </PdfSheet>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default VirtualSectionPreview;
