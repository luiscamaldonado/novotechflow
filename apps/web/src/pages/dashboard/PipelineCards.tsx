import { TrendingUp } from 'lucide-react';
import { STATUS_CONFIG, formatUSD } from '../../lib/constants';
import type { PipelineByStatus } from '../../hooks/useDashboard';

// ── Types ────────────────────────────────────────────────────

interface PipelineCardsProps {
    pipelineCards: PipelineByStatus[];
    forecastCurrentQuarter: number;
    forecastNextQuarter: number;
}

// ── Constants ────────────────────────────────────────────────

/** Quarter labels for display (1-indexed). */
const QUARTER_LABELS: Record<number, string> = {
    1: 'Q1',
    2: 'Q2',
    3: 'Q3',
    4: 'Q4',
};

/** Resolve the current quarter label (1-indexed) for display. */
function getCurrentQuarterLabel(): { current: string; next: string } {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const year = now.getFullYear();
    const nextQuarter = quarter === 4 ? 1 : quarter + 1;
    const nextYear = quarter === 4 ? year + 1 : year;

    return {
        current: `${QUARTER_LABELS[quarter]} ${year}`,
        next: `${QUARTER_LABELS[nextQuarter]} ${nextYear}`,
    };
}

// ── Component ────────────────────────────────────────────────

export default function PipelineCards({
    pipelineCards,
    forecastCurrentQuarter,
    forecastNextQuarter,
}: PipelineCardsProps) {
    const { current, next } = getCurrentQuarterLabel();
    const hasPipelineData = pipelineCards.some(c => c.currentQuarter > 0 || c.nextQuarter > 0);
    const hasForecastData = forecastCurrentQuarter > 0 || forecastNextQuarter > 0;

    if (!hasPipelineData && !hasForecastData) return null;

    return (
        <div className="space-y-4">
            {/* Pipeline Cards by Status */}
            {hasPipelineData && (
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            Pipeline por Estado
                        </span>
                    </div>
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        {pipelineCards.map((card) => {
                            const cfg = STATUS_CONFIG[card.status];
                            return (
                                <div
                                    key={card.status}
                                    className={`rounded-2xl p-5 shadow-sm border ${cfg.border} bg-gradient-to-br from-white ${cfg.bg}/40`}
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`h-2.5 w-2.5 rounded-full ${cfg.bg} ring-2 ring-white ${cfg.border}`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.text}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                                {current}
                                            </p>
                                            <p className={`text-base font-black font-mono ${cfg.text}`}>
                                                USD {formatUSD(card.currentQuarter)}
                                            </p>
                                        </div>
                                        <div className="border-t border-gray-100 pt-2">
                                            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                                                {next}
                                            </p>
                                            <p className="text-sm font-bold font-mono text-gray-600">
                                                USD {formatUSD(card.nextQuarter)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Forecast Card */}
            {hasForecastData && (
                <div className="rounded-2xl p-6 shadow-md border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-indigo-700">
                                Forecast
                            </h3>
                            <p className="text-[10px] text-indigo-400 font-medium">
                                Elaboración + Propuesta (pipeline activo)
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white/70 rounded-xl p-4 border border-indigo-100">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                                {current}
                            </p>
                            <p className="text-xl font-black font-mono text-indigo-700">
                                USD {formatUSD(forecastCurrentQuarter)}
                            </p>
                        </div>
                        <div className="bg-white/70 rounded-xl p-4 border border-violet-100">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-violet-400 mb-1">
                                {next}
                            </p>
                            <p className="text-xl font-black font-mono text-violet-700">
                                USD {formatUSD(forecastNextQuarter)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
