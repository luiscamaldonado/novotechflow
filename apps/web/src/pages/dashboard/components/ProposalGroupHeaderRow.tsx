import { ChevronRight, ChevronDown } from 'lucide-react';
import { getSubtotalUsd } from '../../../hooks/useDashboard';
import { STATUS_CONFIG, ACQUISITION_CONFIG } from '../../../lib/constants';
import { parseProposalCode } from '../../../lib/proposalGrouping';
import type { ProposalVersionGroup } from '../../../lib/proposalGrouping';
import type { UserRole } from '../../../lib/types';
import type { DashboardRow } from '../../../hooks/useDashboard';
import ProposalDatesCell from './ProposalDatesCell';
import ProposalValueCell from './ProposalValueCell';



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
            <td className="px-4 py-4 text-center">
                <span className="text-[10px] text-gray-300">—</span>
            </td>
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
            <ProposalDatesCell
                closeDate={p.closeDate}
                issueDate={p.issueDate}
                validityDate={p.validityDate}
                updatedAt={av.updatedAt}
            />
            <ProposalValueCell
                subtotal={av.minSubtotal}
                currency={av.minSubtotalCurrency}
                isManual={av.isManual}
                usdEstimate={usdEst}
            />
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
        </tr>
    );
}
