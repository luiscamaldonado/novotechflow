import { formatDashboardDate, isValidityExpired } from '../../../lib/dashboardDates';
import ProposalCloseDateControl from './ProposalCloseDateControl';

interface ProposalDatesCellProps {
    closeDate?: string | null;
    issueDate?: string | null;
    validityDate?: string | null;
    updatedAt: string;
    /** When provided, close date renders as an editable <input>; when absent, read-only text. */
    onCloseDateChange?: (value: string) => void;
    /** Disables the close-date input (e.g. for non-active versions). */
    closeDateDisabled?: boolean;
}

export default function ProposalDatesCell({
    closeDate,
    issueDate,
    validityDate,
    updatedAt,
    onCloseDateChange,
    closeDateDisabled,
}: ProposalDatesCellProps) {
    return (
        <td className="px-4 py-4 align-top">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 min-w-[200px]">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Cierre</span>
                    {onCloseDateChange ? (
                        <ProposalCloseDateControl
                            value={closeDate ?? null}
                            onChange={onCloseDateChange}
                            disabled={closeDateDisabled}
                        />
                    ) : closeDate ? (
                        <span className="text-[10px] text-gray-400 font-semibold">{formatDashboardDate(closeDate)}</span>
                    ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Emisión</span>
                    {issueDate ? (
                        <span className="text-[10px] text-gray-400 font-semibold">{formatDashboardDate(issueDate)}</span>
                    ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Vigencia</span>
                    {validityDate ? (
                        <span className={isValidityExpired(validityDate) ? 'text-[10px] font-semibold text-red-600' : 'text-[10px] font-semibold text-gray-400'}>
                            {formatDashboardDate(validityDate)}
                        </span>
                    ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Actualización</span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                        {new Date(updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                </div>
            </div>
        </td>
    );
}
