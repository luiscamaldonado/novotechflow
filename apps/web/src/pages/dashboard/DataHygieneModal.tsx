import type { HygieneIssue } from '../../lib/dashboardValidation';

interface DataHygieneModalProps {
    isOpen: boolean;
    proposalCode: string | null;
    issues: HygieneIssue[];
    remainingCount: number;
    onClose: () => void;
    onGoToFix: () => void;
}

export default function DataHygieneModal({
    isOpen,
    proposalCode,
    issues,
    remainingCount,
    onClose,
    onGoToFix,
}: DataHygieneModalProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between rounded-t-2xl bg-red-600 px-5 py-4">
                    <h2 className="text-base font-semibold text-white">Datos incompletos</h2>
                    <button onClick={onClose} className="text-white/70 transition-colors hover:text-white">
                        {'\u2715'}
                    </button>
                </div>

                <div className="px-5 py-5">
                    <p className="mb-3 text-sm text-gray-600">
                        Antes de continuar, completa la siguiente propuesta:
                    </p>

                    <p className="mb-2 text-sm font-semibold text-gray-900">
                        {proposalCode ?? 'Sin c\u00f3digo'}
                    </p>

                    <ul className="mb-4 list-disc space-y-1 pl-5">
                        {issues.map((issue) => (
                            <li key={issue.ruleId} className="text-sm text-gray-700">
                                {issue.message}
                            </li>
                        ))}
                    </ul>

                    {remainingCount > 1 && (
                        <p className="mb-4 text-xs text-gray-500">
                            {remainingCount} propuestas requieren atenci{'\u00f3'}n.
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={onGoToFix}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                        >
                            Ir a corregir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
