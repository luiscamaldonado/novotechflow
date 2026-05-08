import { SPEC_FIELDS_BY_ITEM_TYPE } from '../../lib/constants';
import type { VisibleItemCalc } from '../../hooks/useProposalScenarios';

/** Page height for letter size at 96dpi */
const PAGE_HEIGHT = 1056;

interface TechnicalSpecSheetProps {
    item: VisibleItemCalc;
    globalIndex: number;
    totalItems: number;
    variantLabel: string | null;
}



/**
 * Renderiza la ficha técnica de un solo item (sin precio).
 * Se usa dentro del PdfPreviewModal para generar una página por item consolidado.
 */
export default function TechnicalSpecSheet({ item, globalIndex, totalItems, variantLabel }: TechnicalSpecSheetProps) {
    const si = item.scenarioItem;
    const proposalItem = si.item;
    const itemType = proposalItem.itemType;
    const specs = proposalItem.technicalSpecs || {};
    const specFieldsDef = SPEC_FIELDS_BY_ITEM_TYPE[itemType] || {};

    // Build spec entries — only those that have a value
    const specEntries = Object.entries(specFieldsDef)
        .filter(([key]) => specs[key]?.trim())
        .map(([key, def]) => ({ label: def.label, value: specs[key] }));

    return (
        <div className="px-16 py-16 flex flex-col" style={{ minHeight: `${PAGE_HEIGHT}px`, height: `${PAGE_HEIGHT}px` }}>
            {/* Header */}
            <div className="mb-6 pb-4 border-b-2 border-indigo-600">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    Propuesta Técnica
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-indigo-600 font-bold">
                        Item {globalIndex} de {totalItems}
                    </p>
                    {variantLabel && (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                            {variantLabel}
                        </span>
                    )}
                </div>
            </div>

            {/* Item name + tax badge */}
            <div className="mb-6 flex items-center gap-3">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {proposalItem.name}
                </h3>
                <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest shrink-0 ${
                    proposalItem.isTaxable
                        ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                        : 'text-amber-600 bg-amber-50 border border-amber-200'
                }`}>
                    {proposalItem.isTaxable ? 'Gravado 19%' : 'No Gravado'}
                </span>
            </div>

            {/* Technical specifications table */}
            {specEntries.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                        Especificaciones Técnicas
                    </h4>
                    <table className="w-full border-collapse">
                        <tbody>
                            {specEntries.map((entry, idx) => (
                                <tr
                                    key={entry.label}
                                    className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}
                                >
                                    <td className="px-3 py-1.5 text-[11px] font-black text-slate-500 uppercase tracking-wider w-1/3 border border-slate-200">
                                        {entry.label}
                                    </td>
                                    <td className="px-3 py-1.5 text-xs font-medium text-slate-800 border border-slate-200">
                                        {entry.value}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tiempo de Entrega */}
            {proposalItem.deliveryDays != null && proposalItem.deliveryDays > 0 && (
                <div className="mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                        Tiempo de Entrega
                    </h4>
                    <p className="text-xs font-medium text-slate-800">
                        {proposalItem.deliveryDays} días
                    </p>
                </div>
            )}

            {/* Notas Complementarias (description) */}
            {proposalItem.description && (
                <div className="mb-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                        Notas Complementarias
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        {proposalItem.description}
                    </p>
                </div>
            )}


        </div>
    );
}
