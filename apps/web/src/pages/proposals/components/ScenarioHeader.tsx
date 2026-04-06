import { useState, useRef } from 'react';
import {
    Plus, TrendingUp, Pencil, ShoppingCart,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Scenario, ScenarioTotals } from '../../../hooks/useScenarios';
import { ACQUISITION_OPTIONS, type AcquisitionMode } from '../../../lib/constants';

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
}: ScenarioHeaderProps) {
    const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
    const scenarioNameInputRef = useRef<HTMLInputElement>(null);

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
