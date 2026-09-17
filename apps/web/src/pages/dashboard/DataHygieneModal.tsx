import { PROJECTION_STATUSES } from '../../lib/constants';
import type { HygieneIssue, ProposalHygieneInput } from '../../lib/dashboardValidation';
import type { ProposalStatus, AcquisitionType } from '../../lib/types';
import ProposalAcquisitionControl from './components/ProposalAcquisitionControl';
import ProposalBillingDateControl from './components/ProposalBillingDateControl';
import ProposalCloseDateControl from './components/ProposalCloseDateControl';
import ProposalStatusControl from './components/ProposalStatusControl';

export interface DataHygieneModalProps {
    isOpen: boolean;
    view: 'editing' | 'resolved' | 'done';
    proposalCode: string | null;
    input: ProposalHygieneInput | null;
    issues: HygieneIssue[];
    remainingCount: number;
    nextProposalCode: string | null;
    saving: boolean;
    error: string | null;
    onStatusChange: (status: ProposalStatus) => void;
    onCloseDateChange: (value: string) => void;
    onBillingDateChange: (value: string) => void;
    onAcquisitionChange: (value: AcquisitionType) => void;
    onNext: () => void;
    onContinue: () => void;
    onClose: () => void;
}

const HEADING_ID = 'data-hygiene-modal-title';

const HEADER_BY_VIEW = {
    editing: { bg: 'bg-red-600', title: 'Datos incompletos' },
    resolved: { bg: 'bg-emerald-600', title: 'Propuesta al día' },
    done: { bg: 'bg-emerald-600', title: 'Tablero al día' },
} as const;

const NO_CODE = 'Sin código';
const LABEL_CLASS = 'mb-1 block text-xs font-semibold text-gray-600';
const SECONDARY_BUTTON = 'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50';
const PRIMARY_BUTTON = 'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700';

export default function DataHygieneModal(props: DataHygieneModalProps) {
    const { isOpen, view, onClose } = props;
    if (!isOpen) return null;

    const header = HEADER_BY_VIEW[view];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={HEADING_ID}
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`flex items-center justify-between rounded-t-2xl ${header.bg} px-5 py-4`}>
                    <h2 id={HEADING_ID} className="text-base font-semibold text-white">{header.title}</h2>
                    <button onClick={onClose} aria-label="Cerrar" className="text-white/70 transition-colors hover:text-white">
                        {'✕'}
                    </button>
                </div>
                <div className="px-5 py-5">
                    {view === 'editing' && <EditingView {...props} />}
                    {view === 'resolved' && <ResolvedView {...props} />}
                    {view === 'done' && <DoneView {...props} />}
                </div>
            </div>
        </div>
    );
}

function EditingView({
    proposalCode, input, issues, remainingCount, saving, error,
    onStatusChange, onCloseDateChange, onBillingDateChange, onAcquisitionChange, onClose,
}: DataHygieneModalProps) {
    if (!input) return null;

    return (
        <>
            <p className="mb-3 text-sm text-gray-600">Antes de continuar, completa la siguiente propuesta:</p>
            <p className="mb-2 text-sm font-semibold text-gray-900">{proposalCode ?? NO_CODE}</p>
            <ul className="mb-4 list-disc space-y-1 pl-5">
                {issues.map((issue) => (
                    <li key={issue.ruleId} className="text-sm text-gray-700">{issue.message}</li>
                ))}
            </ul>

            <div className="mb-4 space-y-3">
                <label className="block">
                    <span className={LABEL_CLASS}>Fecha de cierre</span>
                    <ProposalCloseDateControl
                        value={input.closeDate}
                        onChange={onCloseDateChange}
                        disabled={saving}
                        variant="comfortable"
                    />
                </label>
                <label className="block">
                    <span className={LABEL_CLASS}>Estado</span>
                    <ProposalStatusControl
                        value={input.status}
                        onChange={onStatusChange}
                        disabled={saving}
                        variant="comfortable"
                    />
                </label>
                <label className="block">
                    <span className={LABEL_CLASS}>Tipo de adquisición</span>
                    <ProposalAcquisitionControl
                        value={input.acquisitionType}
                        onChange={onAcquisitionChange}
                        disabled={saving}
                        variant="comfortable"
                    />
                </label>
                {PROJECTION_STATUSES.includes(input.status) && (
                    <label className="block">
                        <span className={LABEL_CLASS}>Fecha de facturación</span>
                        <ProposalBillingDateControl
                            value={input.billingDate}
                            onChange={onBillingDateChange}
                            disabled={saving}
                            showLabel={false}
                            variant="comfortable"
                        />
                    </label>
                )}
            </div>

            {error && (
                <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}
            {remainingCount > 1 && (
                <p className="mb-4 text-xs text-gray-500">{remainingCount} propuestas requieren atención.</p>
            )}

            <div className="flex justify-end gap-2">
                <button onClick={onClose} className={SECONDARY_BUTTON}>Cerrar</button>
            </div>
        </>
    );
}

function ResolvedView({ proposalCode, remainingCount, nextProposalCode, onNext, onClose }: DataHygieneModalProps) {
    return (
        <>
            <p className="mb-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{proposalCode ?? NO_CODE}</span> quedó completa.
            </p>
            <p className="mb-4 text-sm text-gray-600">
                {remainingCount === 1 ? 'Queda 1 propuesta por revisar.' : `Quedan ${remainingCount} propuestas por revisar.`}
            </p>
            {nextProposalCode && (
                <p className="mb-4 text-sm text-gray-700">
                    Siguiente: <span className="font-semibold text-gray-900">{nextProposalCode}</span>
                </p>
            )}
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className={SECONDARY_BUTTON}>Cerrar</button>
                <button onClick={onNext} className={PRIMARY_BUTTON}>Siguiente</button>
            </div>
        </>
    );
}

function DoneView({ onContinue, onClose }: DataHygieneModalProps) {
    return (
        <>
            <p className="mb-4 text-sm text-gray-600">
                No quedan propuestas con datos incompletos. Puedes continuar con lo que ibas a hacer.
            </p>
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className={SECONDARY_BUTTON}>Cerrar</button>
                <button onClick={onContinue} className={PRIMARY_BUTTON}>Continuar</button>
            </div>
        </>
    );
}
