import { formatCOP, formatUSD } from '../../../lib/constants';

/** Format a subtotal with its currency label (COP or USD). */
function formatSubtotalWithCurrency(value: number, currency: 'COP' | 'USD' | null): string {
    if (currency === 'USD') return `USD ${formatUSD(value)}`;
    return `COP ${formatCOP(value)}`;
}

interface ProposalValueCellProps {
    subtotal: number | null;
    currency: 'COP' | 'USD' | null;
    /** Shows "~" prefix to indicate an estimated (manual) amount with no items loaded yet. */
    isManual?: boolean;
    /** Pre-calculated USD estimate; this cell does NOT compute it. */
    usdEstimate: number | null;
}

export default function ProposalValueCell({
    subtotal,
    currency,
    isManual,
    usdEstimate,
}: ProposalValueCellProps) {
    return (
        <td className="px-4 py-4 text-right">
            <div className="flex flex-col items-end gap-1">
                {subtotal !== null ? (
                    <span className="font-mono font-black text-xs text-emerald-700 inline-flex items-center gap-1">
                        {isManual && (
                            <span
                                className="text-gray-400 font-normal"
                                title="Monto estimado inicial. Sin ítems cargados aún."
                            >~</span>
                        )}
                        {formatSubtotalWithCurrency(subtotal, currency)}
                    </span>
                ) : (
                    <span className="text-[10px] text-gray-300">Sin escenario</span>
                )}
                {usdEstimate !== null ? (
                    <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEstimate)}</span>
                ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                )}
            </div>
        </td>
    );
}
