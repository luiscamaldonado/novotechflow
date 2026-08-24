import type { ScenarioTotals } from '@repo/pricing-engine';
import { formatMoney } from '../../lib/constants';

interface ScenarioTotalsCardsProps {
    totals: ScenarioTotals;
    currency: string;
}

/** Los totales llegan ya redondeados del engine; el formato solo decide
 *  cuantos decimales imprime segun la moneda (ADR-113). */
const fmt = (value: number, currency: string) => formatMoney(value, currency);

/** Tarjetas de resumen financiero del escenario activo. */
export default function ScenarioTotalsCards({ totals, currency }: ScenarioTotalsCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-4xl border border-slate-100 shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GRAVADO (19%)</span>
                <p className="text-xl font-black text-slate-900">
                    <span className="text-xs font-bold text-slate-300 mr-2">{currency}</span>
                    {fmt(totals.beforeVat, currency)}
                </p>
            </div>
            <div className="bg-white p-6 rounded-4xl border border-slate-100 shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NO GRAVADO (0%)</span>
                <p className="text-xl font-black text-slate-900">
                    <span className="text-xs font-bold text-slate-300 mr-2">{currency}</span>
                    {fmt(totals.nonTaxed, currency)}
                </p>
            </div>
            <div className="bg-amber-50 p-6 rounded-4xl border-2 border-amber-200 shadow-xl shadow-amber-50/50 space-y-1">
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">SUBTOTAL ANTES DE IVA</span>
                <p className="text-xl font-black text-amber-900">
                    <span className="text-xs font-bold text-amber-400 mr-2">{currency}</span>
                    {fmt(totals.subtotal, currency)}
                </p>
            </div>
            <div className="bg-white p-6 rounded-4xl border border-slate-100 shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IVA ESTIMADO</span>
                <p className="text-xl font-black text-slate-900">
                    <span className="text-xs font-bold text-slate-300 mr-2">{currency}</span>
                    {fmt(totals.vat, currency)}
                </p>
            </div>
            <div className="bg-slate-900 p-6 rounded-4xl shadow-xl shadow-slate-200 space-y-1">
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">TOTAL ESCENARIO IVA INCLUIDO</span>
                <p className="text-xl font-black text-white">
                    <span className="text-xs font-bold text-slate-600 mr-2">{currency}</span>
                    {fmt(totals.total, currency)}
                </p>
            </div>
        </div>
    );
}
