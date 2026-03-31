import { SPEC_FIELDS_BY_ITEM_TYPE } from '../../lib/constants';
import type { VisibleItemCalc } from '../../hooks/useProposalScenarios';

/** Page height for letter size at 96dpi */
const PAGE_HEIGHT = 1056;

interface TechnicalSpecSheetProps {
    item: VisibleItemCalc;
    scenarioName: string;
    currency: string;
    itemIndex: number;
}

/** Formats a number as Colombian currency */
function formatCurrency(value: number, currency: string): string {
    if (currency === 'USD') {
        return `USD $${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renderiza la ficha técnica de un solo item con su precio unitario de venta.
 * Se usa dentro del PdfPreviewModal para generar una página por item visible.
 */
export default function TechnicalSpecSheet({ item, scenarioName, currency, itemIndex }: TechnicalSpecSheetProps) {
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
                <p className="text-sm text-indigo-600 font-bold mt-1">
                    Item {itemIndex} — {scenarioName}
                </p>
            </div>

            {/* Item name */}
            <div className="mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {proposalItem.name}
                </h3>
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

            {/* Spacer to push price box to bottom */}
            <div className="flex-1" />

            {/* Unit sale price box — anchored to bottom */}
            <div>
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-1">
                            Valor Unitario de Venta antes de IVA
                        </span>
                        <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            proposalItem.isTaxable
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-amber-600 bg-amber-50'
                        }`}>
                            {proposalItem.isTaxable ? 'Gravado 19%' : 'No Gravado'}
                        </span>
                    </div>
                    <span className="text-3xl font-black text-indigo-700 tracking-tight">
                        {formatCurrency(item.unitSalePrice, currency)}
                    </span>
                </div>
            </div>
        </div>
    );
}
