import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface ProposalNavBarProps {
    proposalId: string;
    currentStep: 1 | 2 | 3;
}

const STEP_CONFIG = {
    1: {
        back: { label: '← Dashboard', path: '/dashboard' },
        next: { label: 'Ventana de Cálculos →', path: (id: string) => `/proposals/${id}/calculations` },
    },
    2: {
        back: { label: '← Paso Anterior', path: (id: string) => `/proposals/${id}/builder` },
        next: { label: 'Construir Documento →', path: (id: string) => `/proposals/${id}/document` },
    },
    3: {
        back: { label: '← Paso Anterior', path: (id: string) => `/proposals/${id}/calculations` },
        next: null,
    },
} as const;

export default function ProposalNavBar({ proposalId, currentStep }: ProposalNavBarProps) {
    const navigate = useNavigate();

    const config = STEP_CONFIG[currentStep];

    const backPath = typeof config.back.path === 'function'
        ? config.back.path(proposalId)
        : config.back.path;

    const nextConfig = config.next;
    const nextPath = nextConfig && typeof nextConfig.path === 'function'
        ? nextConfig.path(proposalId)
        : null;

    return (
        <div className="sticky bottom-0 z-10 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] px-8 py-4 flex justify-between items-center">
            <button
                onClick={() => navigate(backPath)}
                className="border border-slate-300 text-slate-600 hover:bg-slate-50 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
            >
                <ArrowLeft className="h-4 w-4" />
                {config.back.label}
            </button>

            {nextConfig && nextPath && (
                <button
                    onClick={() => navigate(nextPath)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                    {nextConfig.label}
                    <ArrowRight className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
