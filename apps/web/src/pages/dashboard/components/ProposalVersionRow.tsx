import {
    Trash2, Edit2, Copy, PlusCircle,
} from 'lucide-react';
import { getSubtotalUsd } from '../../../hooks/useDashboard';
import {
    STATUS_CONFIG, ALL_STATUSES, ACQUISITION_CONFIG, formatCOP, formatUSD,
} from '../../../lib/constants';
import type { ProposalStatus, AcquisitionType, UserRole } from '../../../lib/types';
import type { DashboardRow } from '../../../hooks/useDashboard';

/** Format a subtotal with its currency label (COP or USD). */
function formatSubtotalWithCurrency(value: number, currency: 'COP' | 'USD' | null): string {
    if (currency === 'USD') return `USD ${formatUSD(value)}`;
    return `COP ${formatCOP(value)}`;
}

interface ProposalVersionRowProps {
    row: DashboardRow;
    userRole: UserRole;
    trmRate: number | null;
    cloning: string | null;
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
    cloning,
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
    const cfg = STATUS_CONFIG[p.status];
    const needsBillingDate = p.status === 'PENDIENTE_FACTURAR' || p.status === 'FACTURADA';
    const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);

    return (
        <tr className={`hover:bg-gray-50/50 transition-colors group ${isChild ? 'bg-indigo-50/20' : ''}`}>
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
            <td className="px-4 py-4 text-center">
                <input
                    type="date"
                    value={p.closeDate ? new Date(p.closeDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => onDateChange(p.id, 'closeDate', e.target.value)}
                    disabled={!isActiveVersion}
                    className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </td>
            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                {new Date(p.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
            </td>
            <td className="px-4 py-4 text-right">
                {row.minSubtotal !== null ? (
                    <span className="font-mono font-black text-xs text-emerald-700 inline-flex items-center gap-1">
                        {row.isManual && (
                            <span
                                className="text-gray-400 font-normal"
                                title="Monto estimado inicial. Sin ítems cargados aún."
                            >~</span>
                        )}
                        {formatSubtotalWithCurrency(row.minSubtotal, row.minSubtotalCurrency)}
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
                <select
                    value={p.acquisitionType || ''}
                    onChange={(e) => onAcquisitionChange(p.id, e.target.value as AcquisitionType)}
                    disabled={!isActiveVersion}
                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed ${
                        p.acquisitionType && ACQUISITION_CONFIG[p.acquisitionType]
                            ? `${ACQUISITION_CONFIG[p.acquisitionType].bg} ${ACQUISITION_CONFIG[p.acquisitionType].text} ${ACQUISITION_CONFIG[p.acquisitionType].border}`
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                >
                    <option value="">— Seleccionar —</option>
                    <option value="VENTA">Venta</option>
                    <option value="DAAS">DaaS</option>
                </select>
            </td>
            <td className="px-4 py-4 text-center">
                <select
                    value={p.status}
                    onChange={(e) => onStatusChange(p.id, e.target.value as ProposalStatus)}
                    disabled={!isActiveVersion}
                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                </select>
                {needsBillingDate && (
                    <div className="mt-2">
                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                        <input
                            type="date"
                            value={p.billingDate ? new Date(p.billingDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => onDateChange(p.id, 'billingDate', e.target.value)}
                            disabled={!isActiveVersion}
                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                )}
            </td>
            <td className="px-4 py-4 text-center">
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
                        disabled={cloning === p.id}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Clonar versión"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => onClone(p.id, 'NEW_PROPOSAL')}
                        disabled={cloning === p.id}
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
            </td>
        </tr>
    );
}
