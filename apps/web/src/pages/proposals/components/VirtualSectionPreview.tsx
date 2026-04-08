import { cn } from '../../../lib/utils';
import { type ProcessedScenario } from '../../../hooks/useProposalScenarios';
import { PAGE_TYPE_STYLES, VIRTUAL_TECH_SPEC_ID } from '../../../lib/constants';

interface VirtualSectionPreviewProps {
    sectionId: string;
    processedScenarios: ProcessedScenario[];
}

function VirtualSectionPreview({ sectionId, processedScenarios }: VirtualSectionPreviewProps) {
    const isTechSpec = sectionId === VIRTUAL_TECH_SPEC_ID;
    const style = PAGE_TYPE_STYLES[isTechSpec ? 'TECH_SPEC' : 'ECONOMIC'];
    const IconComponent = style.icon;
    const totalItems = processedScenarios.reduce((acc, s) => acc + s.visibleItems.length, 0);

    return (
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
                                    ? `${totalItems} ficha${totalItems !== 1 ? 's' : ''} técnica${totalItems !== 1 ? 's' : ''}`
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
                    <div className="space-y-6">
                        {processedScenarios.map(scenario => (
                            <div key={scenario.id} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                        {scenario.name}
                                    </span>
                                </div>
                                {isTechSpec ? (
                                    <div className="divide-y divide-slate-100">
                                        {scenario.visibleItems.map((vi, idx) => (
                                            <div key={vi.scenarioItem.id}>
                                                <div className="px-6 py-3 flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded">
                                                            #{idx + 1}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-700">
                                                            {vi.scenarioItem.item.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-mono font-bold text-indigo-600">
                                                        ${vi.unitSalePrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                {vi.scenarioItem.item.deliveryDays != null && vi.scenarioItem.item.deliveryDays > 0 && (
                                                    <div className="px-6 py-1 text-xs text-slate-500">
                                                        <span className="font-bold">Tiempo de Entrega:</span> {vi.scenarioItem.item.deliveryDays} días
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subtotal</span>
                                                <span className="text-sm font-mono font-black text-slate-700">
                                                    ${scenario.totals.subtotalBeforeVat.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">IVA</span>
                                                <span className="text-sm font-mono font-black text-slate-700">
                                                    ${scenario.totals.iva.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Total</span>
                                                <span className="text-lg font-mono font-black text-emerald-600">
                                                    ${scenario.totals.total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ítems</span>
                                                <span className="text-lg font-mono font-black text-slate-700">
                                                    {scenario.visibleItems.length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        <p className="text-[10px] text-slate-400 font-bold text-center italic">
                            Esta sección se genera automáticamente desde los datos de la Ventana de Cálculos.
                            Visible en la Vista Previa PDF.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default VirtualSectionPreview;
