import type { ProcessedScenario } from '../../hooks/useProposalScenarios';

/** Page height for letter size at 96dpi */
const PAGE_HEIGHT = 1056;

interface EconomicProposalTableProps {
    scenario: ProcessedScenario;
}

/** Formats a number as Colombian currency */
function formatCurrency(value: number, currency: string): string {
    if (currency === 'USD') {
        return `USD $${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Construye la descripción rápida a partir de los campos de specs según el tipo de ítem.
 * PCS: fabricante, modelo, procesador, memoria, disco, garantía
 * ACCESSORIES: tipo, fabricante, garantía
 * SOFTWARE: tipo, fabricante
 * PC_SERVICES: tipo de servicio, responsable
 * INFRASTRUCTURE: tipo de infraestructura, fabricante, garantía
 * INFRA_SERVICES: tipo de servicio, responsable, unidad de medida
 */
function buildQuickDescription(itemType: string, specs?: Record<string, string>): string {
    if (!specs) return '';
    const pick = (...keys: string[]) =>
        keys.map(k => specs[k]?.trim()).filter(Boolean).join(' | ');

    switch (itemType) {
        case 'PCS':
            return pick('fabricante', 'modelo', 'procesador', 'memoriaRam', 'almacenamiento', 'garantiaEquipo');
        case 'ACCESSORIES':
            return pick('tipo', 'fabricante', 'garantia');
        case 'SOFTWARE':
            return pick('tipo', 'fabricante');
        case 'PC_SERVICES':
            return pick('tipo', 'responsable');
        case 'INFRASTRUCTURE':
            return pick('tipo', 'fabricante', 'garantia');
        case 'INFRA_SERVICES':
            return pick('tipo', 'responsable', 'unidadMedida');
        default:
            return '';
    }
}

/**
 * Determina la unidad de medida según el tipo de ítem.
 * PCS, ACCESSORIES, INFRASTRUCTURE → "Unidad"
 * SOFTWARE, PC_SERVICES, INFRA_SERVICES → usa technicalSpecs.unidadMedida o fallback "Unidad"
 */
function getUnitOfMeasure(itemType: string, technicalSpecs?: Record<string, string>): string {
    switch (itemType) {
        case 'SOFTWARE':
        case 'PC_SERVICES':
        case 'INFRA_SERVICES':
            return technicalSpecs?.unidadMedida?.trim() || 'Unidad';
        default:
            return 'Unidad';
    }
}

/**
 * Renderiza la tabla de propuesta económica de un escenario.
 * Muestra todos los ítems visibles con sus valores y totales al pie.
 */
export default function EconomicProposalTable({ scenario }: EconomicProposalTableProps) {
    const { visibleItems, totals, currency } = scenario;

    return (
        <div className="px-16 py-16" style={{ minHeight: `${PAGE_HEIGHT}px` }}>
            {/* Header */}
            <div className="mb-8 pb-4 border-b-2 border-indigo-600">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    Propuesta Económica
                </h2>
                <p className="text-sm text-indigo-600 font-bold mt-1">
                    {scenario.name}
                </p>
            </div>

            {/* Items table */}
            <table className="w-full border-collapse mb-8">
                <thead>
                    <tr className="bg-slate-800 text-white">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-left border border-slate-700">
                            Nombre del Item
                        </th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-700 w-16">
                            Cant.
                        </th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-right border border-slate-700">
                            Valor Unitario
                        </th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-700 w-16">
                            IVA
                        </th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-right border border-slate-700">
                            Subtotal
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {visibleItems.map((vi, idx) => {
                        const item = vi.scenarioItem.item;
                        const unitOfMeasure = getUnitOfMeasure(item.itemType, item.technicalSpecs);
                        const quickDesc = buildQuickDescription(item.itemType, item.technicalSpecs);

                        return (
                            <tr
                                key={vi.scenarioItem.id}
                                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                            >
                                <td className="px-4 py-3 border border-slate-200">
                                    <span className="text-sm font-bold text-slate-800 block">
                                        {item.name}
                                    </span>
                                    {quickDesc && (
                                        <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                                            {quickDesc}
                                        </span>
                                    )}
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                                        U.M: {unitOfMeasure}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-sm font-black text-slate-700 text-center border border-slate-200">
                                    {vi.quantity}
                                </td>
                                <td className="px-3 py-3 text-xs font-mono font-bold text-slate-700 text-right border border-slate-200">
                                    {formatCurrency(vi.unitSalePrice, currency)}
                                </td>
                                <td className="px-3 py-3 text-xs font-bold text-center border border-slate-200">
                                    {item.isTaxable ? (
                                        <span className="text-emerald-600">19%</span>
                                    ) : (
                                        <span className="text-slate-400">0%</span>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs font-mono font-bold text-slate-800 text-right border border-slate-200">
                                    {formatCurrency(vi.subtotalBeforeVat, currency)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-80">
                    <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
                        <TotalRow
                            label="Subtotal Gravado"
                            value={formatCurrency(totals.subtotalGravado, currency)}
                        />
                        <TotalRow
                            label="Subtotal No Gravado"
                            value={formatCurrency(totals.subtotalNoGravado, currency)}
                            isAlternate
                        />
                        <TotalRow
                            label="Subtotal antes de IVA"
                            value={formatCurrency(totals.subtotalBeforeVat, currency)}
                        />
                        <TotalRow
                            label="IVA (19%)"
                            value={formatCurrency(totals.iva, currency)}
                            isAlternate
                        />
                        <div className="bg-slate-800 text-white px-4 py-4 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest">
                                Total
                            </span>
                            <span className="text-lg font-black tracking-tight">
                                {formatCurrency(totals.total, currency)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TotalRow({
    label,
    value,
    isAlternate = false,
}: {
    label: string;
    value: string;
    isAlternate?: boolean;
}) {
    return (
        <div
            className={`px-4 py-3 flex items-center justify-between border-b border-slate-200 ${
                isAlternate ? 'bg-slate-50' : 'bg-white'
            }`}
        >
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {label}
            </span>
            <span className="text-sm font-mono font-black text-slate-800">
                {value}
            </span>
        </div>
    );
}
