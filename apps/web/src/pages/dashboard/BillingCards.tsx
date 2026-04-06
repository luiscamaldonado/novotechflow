import {
    Clock, DollarSign, Calendar, TrendingUp, BarChart3, AlertCircle,
} from 'lucide-react';
import type { BillingCards as BillingCardsType } from '../../hooks/useDashboard';
import { formatCOP } from '../../lib/constants';

interface BillingCardsProps {
    billingCards: BillingCardsType;
}

export default function BillingCards({ billingCards }: BillingCardsProps) {
    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                        <Clock className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fact. Mes Anterior</span>
                </div>
                <p className="text-lg font-black text-slate-800">{formatCOP(billingCards.facturadoMesAnterior)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                        <DollarSign className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Fact. Mes Actual</span>
                </div>
                <p className="text-lg font-black text-emerald-700">{formatCOP(billingCards.facturadoMesActual)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100 bg-gradient-to-br from-white to-orange-50/40">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Pend. Fact. Mes Actual</span>
                </div>
                <p className="text-lg font-black text-orange-700">{formatCOP(billingCards.pendFactMesActual)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 bg-gradient-to-br from-white to-amber-50/40">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pend. Fact. Mes Sig.</span>
                </div>
                <p className="text-lg font-black text-amber-700">{formatCOP(billingCards.pendFactMesSiguiente)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                        <BarChart3 className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Trimestre Actual</span>
                </div>
                <p className="text-lg font-black text-blue-700">{formatCOP(billingCards.facturadoTrimestreActual)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="h-10 w-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-500">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Proy. Trim. Sig.</span>
                </div>
                <p className="text-lg font-black text-violet-700">{formatCOP(billingCards.proyeccionTrimestreSiguiente)}</p>
            </div>
        </div>
    );
}
