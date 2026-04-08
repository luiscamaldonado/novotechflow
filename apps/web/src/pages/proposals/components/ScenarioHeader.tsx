import { useState, useRef, useMemo } from 'react';
import {
    Plus, TrendingUp, Pencil, ShoppingCart, RefreshCw,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Scenario, ScenarioTotals } from '../../../hooks/useScenarios';
import { ACQUISITION_OPTIONS, type AcquisitionMode } from '../../../lib/constants';
import { formatTrmValue, parseTrmValue } from '../../../lib/format-utils';

interface TrmData {
    valor: number;
    fechaActualizacion: string;
}

interface ScenarioHeaderProps {
    activeScenario: Scenario;
    totals: ScenarioTotals;
    activeScenarioId: string | null;
    isDaasMode: boolean;
    acquisitionModes: Record<string, AcquisitionMode>;
    globalMarginBuffer: string | null;
    setGlobalMarginBuffer: (v: string | null) => void;
    updateGlobalMargin: (v: string) => void;
    handleAcquisitionChange: (mode: AcquisitionMode) => void;
    changeCurrency: (c: string) => void;
    renameScenario: (id: string, name: string) => void;
    setIsPickingItems: (v: boolean) => void;
    updateConversionTrm: (value: number) => Promise<void>;
    trm: TrmData | null;
    conversionTrm: number | null;
}

export default function ScenarioHeader({
    activeScenario,
    totals,
    activeScenarioId,
    isDaasMode,
    acquisitionModes,
    globalMarginBuffer,
    setGlobalMarginBuffer,
    updateGlobalMargin,
    handleAcquisitionChange,
    changeCurrency,
    renameScenario,
    setIsPickingItems,
    updateConversionTrm,
    trm,
    conversionTrm,
}: ScenarioHeaderProps) {
    const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
    const scenarioNameInputRef = useRef<HTMLInputElement>(null);
    const [trmBuffer, setTrmBuffer] = useState<string | null>(null);

    /** Whether all items in the scenario share the same currency as the scenario */
    const isConversionUnnecessary = useMemo(() => {
        const scenarioCurrency = activeScenario.currency || 'COP';
        const items = activeScenario.scenarioItems;
        if (items.length === 0) return false;
        return items.every(si => (si.item.costCurrency || 'COP') === scenarioCurrency);
    }, [activeScenario.currency, activeScenario.scenarioItems]);

    const effectiveTrm = conversionTrm ?? trm?.valor ?? null;

    const handleTrmBlur = () => {
        if (trmBuffer === null) return;
        const parsed = parseTrmValue(trmBuffer);
        if (parsed > 0) {
            updateConversionTrm(parsed);
        }
        setTrmBuffer(null);
    };

    const handleFillTodayTrm = () => {
        if (!trm) return;
        updateConversionTrm(trm.valor);
        setTrmBuffer(null);
    };

    const displayTrmValue = (): string => {
        if (trmBuffer !== null) return trmBuffer;
        if (effectiveTrm !== null) return formatTrmValue(effectiveTrm);
        return '';
    };

    return (
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                    <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                    {editingScenarioName !== null ? (
                        <input
                            ref={scenarioNameInputRef}
                            type="text"
                            value={editingScenarioName}
                            onChange={(e) => setEditingScenarioName(e.target.value)}
                            onBlur={() => {
                                if (editingScenarioName.trim() && editingScenarioName.trim() !== activeScenario.name) {
                                    renameScenario(activeScenario.id, editingScenarioName);
                                }
                                setEditingScenarioName(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                    setEditingScenarioName(null);
                                }
                            }}
                            autoFocus
                            className="text-xl font-black text-slate-900 tracking-tight bg-white border-2 border-indigo-200 rounded-xl px-3 py-1 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none w-full max-w-md"
                        />
                    ) : (
                        <button
                            onClick={() => setEditingScenarioName(activeScenario.name)}
                            className="group/name flex items-center space-x-2 hover:bg-indigo-50 rounded-xl px-3 py-1 -mx-3 -my-1 transition-colors"
                            title="Haga clic para editar el nombre del escenario"
                        >
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">{activeScenario.name}</h4>
                            <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover/name:text-indigo-500 transition-colors" />
                        </button>
                    )}
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Modelando {activeScenario.scenarioItems.length} ítems en este escenario.</p>
                </div>
            </div>
            <div className="flex items-center space-x-6">
                <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Margen Global</span>
                    <div className={cn(
                        "flex items-center px-4 py-2 rounded-xl border shadow-sm",
                        isDaasMode
                            ? "bg-slate-100 border-slate-200"
                            : "bg-emerald-50 border-emerald-100"
                    )}>
                        <input 
                            type="text"
                            value={globalMarginBuffer !== null ? globalMarginBuffer : totals.globalMarginPct.toFixed(2)}
                            onFocus={() => !isDaasMode && setGlobalMarginBuffer(totals.globalMarginPct.toFixed(2))}
                            onChange={(e) => !isDaasMode && setGlobalMarginBuffer(e.target.value)}
                            onBlur={(e) => {
                                if (!isDaasMode) {
                                    updateGlobalMargin(e.target.value);
                                    setGlobalMarginBuffer(null);
                                }
                            }}
                            disabled={isDaasMode}
                            className={cn(
                                "w-16 bg-transparent border-none text-right font-black p-0 focus:ring-0 text-sm",
                                isDaasMode
                                    ? "text-slate-400 cursor-not-allowed"
                                    : "text-emerald-700"
                            )}
                        />
                        <span className={cn(
                            "ml-1 text-xs font-black",
                            isDaasMode ? "text-slate-400" : "text-emerald-600"
                        )}>%</span>
                    </div>
                </div>

                {/* Acquisition Mode Selector */}
                <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-1">Adquisición</span>
                    <div className="flex items-center bg-sky-50 px-3 py-2 rounded-xl border border-sky-100 shadow-sm">
                        <ShoppingCart className="h-3.5 w-3.5 text-sky-400 mr-2" />
                        <select
                            value={acquisitionModes[activeScenarioId!] || 'VENTA'}
                            onChange={(e) => handleAcquisitionChange(e.target.value as AcquisitionMode)}
                            className={cn(
                                "bg-transparent border-none font-black text-xs focus:ring-0 cursor-pointer pr-6",
                                isDaasMode ? "text-pink-600" : "text-sky-700"
                            )}
                        >
                            {ACQUISITION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => changeCurrency('COP')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                            activeScenario.currency === 'COP' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        COP
                    </button>
                    <button 
                        onClick={() => changeCurrency('USD')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                            activeScenario.currency === 'USD' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        USD
                    </button>
                </div>

                {/* TRM Conversion Input */}
                <div className="flex flex-col items-end" title={isConversionUnnecessary ? 'Todos los items están en la misma moneda — no se requiere conversión' : undefined}>
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest mb-1",
                        isConversionUnnecessary ? "text-slate-400" : "text-amber-600"
                    )}>TRM Conversión</span>
                    <div className={cn(
                        "flex items-center px-4 py-2 rounded-xl border shadow-sm",
                        isConversionUnnecessary
                            ? "bg-slate-100 border-slate-200"
                            : "bg-amber-50 border-amber-100"
                    )}>
                        <span className={cn(
                            "text-xs font-black mr-1",
                            isConversionUnnecessary ? "text-slate-400" : "text-amber-500"
                        )}>$</span>
                        <input
                            type="text"
                            value={displayTrmValue()}
                            placeholder={trm ? formatTrmValue(trm.valor) : '—'}
                            onFocus={() => {
                                if (isConversionUnnecessary) return;
                                const current = effectiveTrm ?? trm?.valor ?? 0;
                                setTrmBuffer(current > 0 ? formatTrmValue(current) : '');
                            }}
                            onChange={(e) => {
                                if (isConversionUnnecessary) return;
                                setTrmBuffer(e.target.value);
                            }}
                            onBlur={handleTrmBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                    setTrmBuffer(null);
                                }
                            }}
                            disabled={isConversionUnnecessary}
                            className={cn(
                                "w-24 bg-transparent border-none text-right font-black p-0 focus:ring-0 text-sm",
                                isConversionUnnecessary
                                    ? "text-slate-400 cursor-not-allowed"
                                    : "text-amber-700"
                            )}
                        />
                        {!isConversionUnnecessary && trm && (
                            <button
                                onClick={handleFillTodayTrm}
                                className="ml-2 flex items-center space-x-1 px-2 py-1 text-[9px] font-black text-amber-600 bg-white hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors whitespace-nowrap"
                                title={`Usar TRM del día: $${trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`}
                            >
                                <RefreshCw className="h-3 w-3" />
                                <span>Hoy</span>
                            </button>
                        )}
                    </div>
                </div>

                <button 
                    onClick={() => setIsPickingItems(true)}
                    className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all font-black text-[11px] uppercase tracking-widest"
                >
                    <Plus className="h-4 w-4" />
                    <span>Pick de Items</span>
                </button>
            </div>
        </div>
    );
}
