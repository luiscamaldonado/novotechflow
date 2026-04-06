import type { ScenarioTotals } from '../../lib/pricing-engine';

interface ScenarioTotalsCardsProps {
    totals: ScenarioTotals;
    currency: string;
}

const fmt = (value: number) =>
    `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Tarjetas de resumen financiero del escenario activo. */
export default function ScenarioTotalsCards({ totals, currency }: ScenarioTotalsCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GRAVADO (19%)</span>
                <p className="text-xl font-black text-slate-900">
                    <span className="text-xs font-bold text-slate-300 mr-2">{currency}</span>
                    {fmt(totals.beforeVat)}
                </p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NO GRAVADO (0%)</span>
                <p className="text-xl font-black text-slate-900">
                    <span className="text-xs font-bold text-slate-300 mr-2">{currency}</span>
                    {fmt(totals.nonTaxed)}
                </p>
            </div>
            <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-amber-200 shadow-xl shadow-amber-50/50 space-y-1">
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">SUBTOTAL ANTES DE IVA</span>
                <p className="text-xl font-black text-amber-900">
                    <span className="text-xs font-bold text-amber-400 mr-2">{currency}</span>
                    {fmt(totals.subtotal)}
                </p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IVA ESTIMADO</span>
                <p className="text-xl font-black text-slate-900">
                    <span className="text-xs font-bold text-slate-300 mr-2">{currency}</span>
                    {fmt(totals.vat)}
                </p>
            </div>
            <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl shadow-slate-200 space-y-1">
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">TOTAL ESCENARIO IVA INCLUIDO</span>
                <p className="text-xl font-black text-white">
                    <span className="text-xs font-bold text-slate-600 mr-2">{currency}</span>
                    {fmt(totals.total)}
                </p>
            </div>
        </div>
    );
}
