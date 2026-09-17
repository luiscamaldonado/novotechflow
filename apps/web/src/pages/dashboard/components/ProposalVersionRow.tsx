import {
    Trash2, Edit2, Copy, PlusCircle,
} from 'lucide-react';
import { getSubtotalUsd } from '../../../hooks/useDashboard';
import { PROJECTION_STATUSES } from '../../../lib/constants';
import type { ProposalStatus, AcquisitionType, UserRole } from '../../../lib/types';
import type { DashboardRow } from '../../../hooks/useDashboard';
import ProposalAcquisitionControl from './ProposalAcquisitionControl';
import ProposalBillingDateControl from './ProposalBillingDateControl';
import ProposalDatesCell from './ProposalDatesCell';
import ProposalStatusControl from './ProposalStatusControl';
import ProposalValueCell from './ProposalValueCell';



interface ProposalVersionRowProps {
    row: DashboardRow;
    userRole: UserRole;
    trmRate: number | null;
    /** When true, indents the code cell to signal a child version inside an expanded group. */
    isChild?: boolean;
    /** When false, disables editable data controls (dates, status, acquisition) for previous versions. */
    isActiveVersion?: boolean;
    onStatusChange: (id: string, status: ProposalStatus) => void;
    onDateChange: (id: string, field: 'closeDate' | 'billingDate', value: string) => void;
    onAcquisitionChange: (id: string, value: AcquisitionType) => void;
    onClone: (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => void;
    onDelete: (id: string, code: string) => void;
    onEdit: (id: string) => void;
}

export default function ProposalVersionRow({
    row,
    userRole,
    trmRate,
    isChild = false,
    isActiveVersion = true,
    onStatusChange,
    onDateChange,
    onAcquisitionChange,
    onClone,
    onDelete,
    onEdit,
}: ProposalVersionRowProps) {
    const p = row.originalProposal!;
    const needsBillingDate = PROJECTION_STATUSES.includes(p.status);
    const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);

    return (
        <tr className={`hover:bg-gray-50/50 transition-colors group ${isChild ? 'bg-indigo-50/20' : ''}`}>
            <td className="px-4 py-4 text-center">
                {userRole !== 'REPORTER' && (
                    <div className="flex items-center justify-center space-x-1">
                        <button
                            onClick={() => onEdit(p.id)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Editar"
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => onClone(p.id, 'NEW_VERSION')}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Clonar versión"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => onClone(p.id, 'NEW_PROPOSAL')}
                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                            title="Clonar como nueva propuesta"
                        >
                            <PlusCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => onDelete(p.id, p.proposalCode || '')}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </td>
            <td className="px-5 py-4" style={isChild ? { paddingLeft: '2.5rem' } : undefined}>
                <div className="flex items-center gap-1.5">
                    {isChild && <span className="text-gray-300 text-xs select-none">┗</span>}
                    <span className="font-mono font-black text-indigo-600 text-xs">{p.proposalCode}</span>
                </div>
            </td>
            <td className="px-4 py-4">
                <p className="font-bold text-gray-900 text-sm">{p.clientName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1" title={p.subject}>{p.subject}</p>
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
                updatedAt={p.updatedAt}
                onCloseDateChange={(value) => onDateChange(p.id, 'closeDate', value)}
                closeDateDisabled={!isActiveVersion}
            />
            <ProposalValueCell
                subtotal={row.minSubtotal}
                currency={row.minSubtotalCurrency}
                isManual={row.isManual}
                usdEstimate={usdEst}
            />
            <td className="px-4 py-4 text-center">
                <ProposalAcquisitionControl
                    value={p.acquisitionType ?? null}
                    onChange={(value) => onAcquisitionChange(p.id, value)}
                    disabled={!isActiveVersion}
                    readOnly={userRole === 'REPORTER'}
                />
            </td>
            <td className="px-4 py-4 text-center">
                <ProposalStatusControl
                    value={p.status}
                    onChange={(status) => onStatusChange(p.id, status)}
                    disabled={!isActiveVersion}
                    readOnly={userRole === 'REPORTER'}
                />
                {userRole !== 'REPORTER' && needsBillingDate && (
                    <div className="mt-2">
                        <ProposalBillingDateControl
                            value={p.billingDate ?? null}
                            onChange={(value) => onDateChange(p.id, 'billingDate', value)}
                            disabled={!isActiveVersion}
                        />
                    </div>
                )}
            </td>
        </tr>
    );
}
