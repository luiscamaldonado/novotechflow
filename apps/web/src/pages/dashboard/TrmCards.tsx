import { Loader2 } from 'lucide-react';
import { formatCOP, MONTH_NAMES_ES } from '../../lib/constants';

interface TrmCardData {
    label: string;
    value: number | null;
    isLoading: boolean;
    accentBg: string;
    accentText: string;
    accentBorder: string;
    iconBg: string;
}

interface TrmCardsProps {
    trmRate: number | null;
    trmCurrentMonthAvg: number | null;
    trmPreviousMonthAvg: number | null;
    isLoadingTrmAverages: boolean;
}

/** Build the display label "Promedio Abril 2026" for a given month offset. */
function buildMonthLabel(monthOffset: number): string {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();
    return `Promedio ${MONTH_NAMES_ES[month]} ${year}`;
}

export default function TrmCards({ trmRate, trmCurrentMonthAvg, trmPreviousMonthAvg, isLoadingTrmAverages }: TrmCardsProps) {
    const cards: TrmCardData[] = [
        {
            label: 'TRM del Día',
            value: trmRate,
            isLoading: false,
            accentBg: 'bg-emerald-50',
            accentText: 'text-emerald-700',
            accentBorder: 'border-emerald-200',
            iconBg: 'bg-emerald-100',
        },
        {
            label: buildMonthLabel(0),
            value: trmCurrentMonthAvg,
            isLoading: isLoadingTrmAverages,
            accentBg: 'bg-sky-50',
            accentText: 'text-sky-700',
            accentBorder: 'border-sky-200',
            iconBg: 'bg-sky-100',
        },
        {
            label: buildMonthLabel(-1),
            value: trmPreviousMonthAvg,
            isLoading: isLoadingTrmAverages,
            accentBg: 'bg-amber-50',
            accentText: 'text-amber-700',
            accentBorder: 'border-amber-200',
            iconBg: 'bg-amber-100',
        },
    ];

    return (
        <div className="grid grid-cols-3 gap-4">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className={`rounded-2xl p-4 shadow-sm border ${card.accentBorder} bg-gradient-to-br from-white ${card.accentBg}/30`}
                >
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${card.accentText} mb-2`}>
                        {card.label}
                    </p>
                    {card.isLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className={`h-4 w-4 animate-spin ${card.accentText}`} />
                            <span className="text-xs text-gray-400">Cargando...</span>
                        </div>
                    ) : card.value !== null ? (
                        <p className={`text-lg font-black font-mono ${card.accentText}`}>
                            {formatCOP(Math.round(card.value))}
                        </p>
                    ) : (
                        <p className="text-sm text-gray-400">No disponible</p>
                    )}
                </div>
            ))}
        </div>
    );
}
