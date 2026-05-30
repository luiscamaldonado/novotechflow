import { ChevronRight, ChevronDown } from 'lucide-react';
import { getSubtotalUsd } from '../../../hooks/useDashboard';
import { STATUS_CONFIG, ACQUISITION_CONFIG, formatCOP, formatUSD } from '../../../lib/constants';
import { parseProposalCode } from '../../../lib/proposalGrouping';
import type { ProposalVersionGroup } from '../../../lib/proposalGrouping';
import type { UserRole } from '../../../lib/types';
import type { DashboardRow } from '../../../hooks/useDashboard';
import { formatDashboardDate, isValidityExpired } from '../../../lib/dashboardDates';

/** Format a subtotal with its currency label (COP or USD). */
function formatSubtotalWithCurrency(value: number, currency: 'COP' | 'USD' | null): string {
    if (currency === 'USD') return `USD ${formatUSD(value)}`;
    return `COP ${formatCOP(value)}`;
}

interface ProposalGroupHeaderRowProps {
    group: ProposalVersionGroup<DashboardRow>;
    isExpanded: boolean;
    onToggle: () => void;
    userRole: UserRole;
    trmRate: number | null;
}

export default function ProposalGroupHeaderRow({
    group,
    isExpanded,
    onToggle,
    userRole,
    trmRate,
}: ProposalGroupHeaderRowProps) {
    const av = group.activeVersion;
    const p = av.originalProposal!;
    const cfg = STATUS_CONFIG[av.status];
    const usdEst = getSubtotalUsd(av.minSubtotal, av.minSubtotalCurrency, trmRate);
    const activeVersionNumber = parseProposalCode(av.code).version;
    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

    return (
        <tr className="hover:bg-indigo-50/30 transition-colors cursor-pointer bg-indigo-50/10 border-l-2 border-indigo-300">
            <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-lg hover:bg-indigo-100 transition-colors text-indigo-500"
                        title={isExpanded ? 'Colapsar versiones' : 'Expandir versiones'}
                    >
                        <ChevronIcon className="h-4 w-4" />
                    </button>
                    <span className="font-mono font-black text-indigo-700 text-xs">{group.baseCode}</span>
                    <span className="text-[8px] font-bold uppercase bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-200">
                        v{activeVersionNumber}
                    </span>
                    <span className="text-[8px] font-semibold text-gray-400">
                        ({group.versions.length} ver.)
                    </span>
                </div>
            </td>
            <td className="px-4 py-4">
                <p className="font-bold text-gray-900 text-sm">{av.clientName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1" title={av.subject}>{av.subject}</p>
            </td>
            {userRole === 'ADMIN' && (
                <td className="px-4 py-4 text-center">
                    <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                        {p.user?.nomenclature || '??'} - {p.user?.name?.split(' ')[0]}
                    </span>
                </td>
            )}
            <td className="px-4 py-4 text-center">
                {p.closeDate ? (
                    <span className="text-[10px] text-gray-400 font-semibold">{formatDashboardDate(p.closeDate)}</span>
                ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                )}
            </td>
            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                {formatDashboardDate(p.issueDate)}
            </td>
            <td className="px-4 py-4 text-center text-[10px] font-semibold">
                {p.validityDate ? (
                    <span className={isValidityExpired(p.validityDate) ? 'text-red-600' : 'text-gray-400'}>
                        {formatDashboardDate(p.validityDate)}
                    </span>
                ) : (
                    <span className="text-gray-300">—</span>
                )}
            </td>
            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                {new Date(av.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
            </td>
            <td className="px-4 py-4 text-right">
                {av.minSubtotal !== null ? (
                    <span className="font-mono font-black text-xs text-emerald-700 inline-flex items-center gap-1">
                        {av.isManual && (
                            <span
                                className="text-gray-400 font-normal"
                                title="Monto estimado inicial. Sin ítems cargados aún."
                            >~</span>
                        )}
                        {formatSubtotalWithCurrency(av.minSubtotal, av.minSubtotalCurrency)}
                    </span>
                ) : (
                    <span className="text-[10px] text-gray-300">Sin escenario</span>
                )}
            </td>
            <td className="px-4 py-4 text-right">
                {usdEst !== null ? (
                    <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                )}
            </td>
            <td className="px-4 py-4 text-center">
                {av.acquisitionType && ACQUISITION_CONFIG[av.acquisitionType] ? (
                    <span className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${ACQUISITION_CONFIG[av.acquisitionType].bg} ${ACQUISITION_CONFIG[av.acquisitionType].text} ${ACQUISITION_CONFIG[av.acquisitionType].border}`}>
                        {ACQUISITION_CONFIG[av.acquisitionType].label}
                    </span>
                ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                )}
            </td>
            <td className="px-4 py-4 text-center">
                <span className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                </span>
            </td>
            <td className="px-4 py-4 text-center">
                <span className="text-[10px] text-gray-300">—</span>
            </td>
        </tr>
    );
}
