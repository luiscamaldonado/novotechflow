import {
    Clock, DollarSign, Calendar, TrendingUp, BarChart3, AlertCircle,
} from 'lucide-react';
import type { BillingCards as BillingCardsType } from '../../hooks/useDashboard';
import { formatCOP, ACQUISITION_CONFIG } from '../../lib/constants';
import type { AcquisitionType } from '../../lib/types';

interface BillingCardsProps {
    billingCardsVenta: BillingCardsType;
    billingCardsDaas: BillingCardsType;
}

/** Color themes per acquisition type for the billing card rows. */
const CARD_THEMES: Record<AcquisitionType, {
    headerBg: string;
    headerText: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
    gradientFrom: string;
}> = {
    VENTA: {
        headerBg: 'bg-sky-50',
        headerText: 'text-sky-700',
        accentBg: 'bg-sky-50',
        accentText: 'text-sky-600',
        accentBorder: 'border-sky-200',
        gradientFrom: 'from-white to-sky-50/30',
    },
    DAAS: {
        headerBg: 'bg-pink-50',
        headerText: 'text-pink-700',
        accentBg: 'bg-pink-50',
        accentText: 'text-pink-600',
        accentBorder: 'border-pink-200',
        gradientFrom: 'from-white to-pink-50/30',
    },
};

const CARD_DEFINITIONS = [
    { key: 'facturadoMesAnterior' as const, label: 'Fact. Mes Anterior', Icon: Clock,        iconBg: 'bg-slate-100', iconText: 'text-slate-500', labelText: 'text-slate-400', valueText: 'text-slate-800' },
    { key: 'facturadoMesActual' as const,   label: 'Fact. Mes Actual',   Icon: DollarSign,    iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', labelText: 'text-emerald-500', valueText: 'text-emerald-700' },
    { key: 'pendFactMesActual' as const,    label: 'Pend. Fact. Mes Actual', Icon: AlertCircle, iconBg: 'bg-orange-50', iconText: 'text-orange-500', labelText: 'text-orange-500', valueText: 'text-orange-700' },
    { key: 'pendFactMesSiguiente' as const, label: 'Pend. Fact. Mes Sig.', Icon: Calendar,    iconBg: 'bg-amber-50', iconText: 'text-amber-500', labelText: 'text-amber-500', valueText: 'text-amber-700' },
    { key: 'facturadoTrimestreActual' as const, label: 'Trimestre Actual', Icon: BarChart3,   iconBg: 'bg-blue-50', iconText: 'text-blue-500', labelText: 'text-blue-500', valueText: 'text-blue-700' },
    { key: 'proyeccionTrimestreSiguiente' as const, label: 'Proy. Trim. Sig.', Icon: TrendingUp, iconBg: 'bg-violet-50', iconText: 'text-violet-500', labelText: 'text-violet-500', valueText: 'text-violet-700' },
];

function isRowEmpty(cards: BillingCardsType): boolean {
    return Object.values(cards).every(v => v === 0);
}

function BillingCardRow({ cards, acquisitionType }: { cards: BillingCardsType; acquisitionType: AcquisitionType }) {
    const theme = CARD_THEMES[acquisitionType];
    const config = ACQUISITION_CONFIG[acquisitionType];

    return (
        <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${theme.headerBg}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.headerText}`}>
                    Proyección {config.label}
                </span>
            </div>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {CARD_DEFINITIONS.map(({ key, label, Icon, iconBg, iconText, labelText, valueText }) => (
                    <div
                        key={key}
                        className={`bg-white rounded-2xl p-5 shadow-sm border ${theme.accentBorder} bg-gradient-to-br ${theme.gradientFrom}`}
                    >
                        <div className="flex items-center space-x-3 mb-3">
                            <div className={`h-10 w-10 ${iconBg} rounded-xl flex items-center justify-center ${iconText}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelText}`}>{label}</span>
                        </div>
                        <p className={`text-lg font-black ${valueText}`}>{formatCOP(cards[key])}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BillingCards({ billingCardsVenta, billingCardsDaas }: BillingCardsProps) {
    const isVentaEmpty = isRowEmpty(billingCardsVenta);
    const isDaasEmpty = isRowEmpty(billingCardsDaas);

    if (isVentaEmpty && isDaasEmpty) return null;

    return (
        <div className="space-y-5">
            {!isVentaEmpty && <BillingCardRow cards={billingCardsVenta} acquisitionType="VENTA" />}
            {!isDaasEmpty && <BillingCardRow cards={billingCardsDaas} acquisitionType="DAAS" />}
        </div>
    );
}
