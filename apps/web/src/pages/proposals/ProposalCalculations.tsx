import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calculator, Plus, Trash2,
    ArrowLeft, Loader2, Package,
    AlertCircle, TrendingUp,
    Percent, RotateCcw, ChevronDown, Layers, Pencil, Copy, BookOpen, ShoppingCart
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScenarios, type ProposalCalcItem } from '../../hooks/useScenarios';
import ItemPickerModal from '../../components/proposals/ItemPickerModal';
import ScenarioTotalsCards from '../../components/proposals/ScenarioTotalsCards';

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, proposal, proposalItems, scenarios,
        activeScenarioId, setActiveScenarioId, activeScenario, totals,
        trm, extraTrm, loadData,
        createScenario, deleteScenario,
        addItemToScenario, removeItemFromScenario,
        addChildItem, removeChildItem, updateChildQuantity,
        changeCurrency, updateMargin, updateQuantity,
        updateUnitPrice, updateGlobalMargin, toggleDilpidate,
        renameScenario,
        cloneScenario,
    } = useScenarios(id);

    // UI-only state
    const [isCreatingScenario, setIsCreatingScenario] = useState(false);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [isPickingItems, setIsPickingItems] = useState(false);
    const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);
    const [globalMarginBuffer, setGlobalMarginBuffer] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [pickingChildrenFor, setPickingChildrenFor] = useState<string | null>(null);
    const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
    const scenarioNameInputRef = useRef<HTMLInputElement>(null);

    // ── Acquisition mode per scenario (VENTA / DAAS) ──
    type AcquisitionMode = 'VENTA' | 'DAAS_12' | 'DAAS_24' | 'DAAS_36' | 'DAAS_48' | 'DAAS_60';
    const ACQUISITION_OPTIONS: { value: AcquisitionMode; label: string }[] = [
        { value: 'VENTA', label: 'Venta' },
        { value: 'DAAS_12', label: 'DaaS 12 Meses' },
        { value: 'DAAS_24', label: 'DaaS 24 Meses' },
        { value: 'DAAS_36', label: 'DaaS 36 Meses' },
        { value: 'DAAS_48', label: 'DaaS 48 Meses' },
        { value: 'DAAS_60', label: 'DaaS 60 Meses' },
    ];
    // Per-scenario acquisition mode
    const [acquisitionModes, setAcquisitionModes] = useState<Record<string, AcquisitionMode>>({});
    // Saved margins snapshot: { scenarioId → { global: number, items: { siId: margin } } }
    const savedMarginsRef = useRef<Record<string, { global: number; items: Record<string, number> }>>({});

    const isDaasMode = (scenarioId: string | null) => {
        if (!scenarioId) return false;
        return (acquisitionModes[scenarioId] || 'VENTA') !== 'VENTA';
    };

    const handleAcquisitionChange = async (newMode: AcquisitionMode) => {
        if (!activeScenarioId || !activeScenario) return;
        const currentMode = acquisitionModes[activeScenarioId] || 'VENTA';
        if (newMode === currentMode) return;

        if (newMode !== 'VENTA' && currentMode === 'VENTA') {
            // Switching TO DaaS → save current margins, then set all to 0
            const marginSnapshot: Record<string, number> = {};
            activeScenario.scenarioItems.forEach(si => {
                const margin = si.marginPctOverride !== undefined && si.marginPctOverride !== null
                    ? si.marginPctOverride
                    : Number(si.item.marginPct);
                marginSnapshot[si.id!] = margin;
            });
            savedMarginsRef.current[activeScenarioId] = {
                global: totals.globalMarginPct,
                items: marginSnapshot,
            };
            // Apply 0 margin globally
            await updateGlobalMargin('0');
        } else if (newMode === 'VENTA' && currentMode !== 'VENTA') {
            // Switching BACK to VENTA → restore saved margins
            const saved = savedMarginsRef.current[activeScenarioId];
            if (saved) {
                // Restore each item's margin
                for (const [siId, margin] of Object.entries(saved.items)) {
                    await updateMargin(siId, margin.toString());
                }
                delete savedMarginsRef.current[activeScenarioId];
            }
        } else if (newMode !== 'VENTA' && currentMode !== 'VENTA') {
            // Switching between DaaS modes — margins stay at 0, just update the mode
        }

        setAcquisitionModes(prev => ({ ...prev, [activeScenarioId]: newMode }));
    };

    const handleCreateScenario = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await createScenario(newScenarioName);
        if (ok) {
            setNewScenarioName('');
            setIsCreatingScenario(false);
        }
    };

    const toggleExpandItem = (siId: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(siId)) next.delete(siId);
            else next.add(siId);
            return next;
        });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate(`/proposals/${id}/builder`)}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                            <Calculator className="h-8 w-8 mr-3 text-indigo-600" />
                            Ventana de Cálculos
                        </h2>
                        <div className="flex items-center space-x-4 mt-1">
                            <p className="text-slate-500 text-sm font-medium">Modelación de Escenarios y Proyecciones Financieras</p>
                            {trm && (
                                <div className="flex items-center space-x-4 bg-emerald-50 px-6 py-4 rounded-[2rem] border-2 border-emerald-200 shadow-xl ml-6">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <div className="flex flex-col justify-center">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-2xl font-black text-emerald-900 leading-none">
                                                ${trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-tighter">TRM USD/COP</span>
                                        </div>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em]">
                                                Vigencia Oficial:
                                            </span>
                                            <span className="text-[11px] font-bold text-indigo-600">
                                                {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={loadData}
                                        disabled={loading}
                                        className="p-3 bg-white hover:bg-emerald-100 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                        title="Actualizar TRM"
                                    >
                                        <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                                    </button>
                                    
                                    {(extraTrm?.setIcapAverage || extraTrm?.wilkinsonSpot) && (
                                        <>
                                            <div className="w-px h-10 bg-emerald-200 mx-2 hidden md:block"></div>
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">Dólar Mañana (Est.)</span>
                                                <div className="flex items-baseline space-x-3">
                                                    {extraTrm.setIcapAverage && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.setIcapAverage.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SET-ICAP</span>
                                                        </div>
                                                    )}
                                                    {extraTrm.wilkinsonSpot && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.wilkinsonSpot.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SPOT</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Propuesta No.</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* Navigation to Document Builder */}
            <div className="flex justify-end">
                <button 
                    onClick={() => navigate(`/proposals/${id}/document`)}
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                    <BookOpen className="h-4 w-4" />
                    <span>Construir Documento</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar de Escenarios */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Escenarios</h3>
                            <button 
                                onClick={() => setIsCreatingScenario(true)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all scale-90"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {scenarios.map(s => (
                                    <motion.div 
                                        key={s.id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        onClick={() => setActiveScenarioId(s.id)}
                                        className={cn(
                                            "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                            activeScenarioId === s.id 
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                                : "bg-slate-50 border-transparent hover:bg-white hover:border-indigo-100 text-slate-600"
                                        )}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <TrendingUp className={cn("h-4 w-4", activeScenarioId === s.id ? "text-indigo-200" : "text-slate-400")} />
                                            <span className="text-sm font-black tracking-tight">{s.name}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); cloneScenario(s.id); }}
                                                className={cn(
                                                    "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                                    activeScenarioId === s.id ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-indigo-50 text-slate-400 hover:text-indigo-500"
                                                )}
                                                title="Clonar escenario"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteScenario(s.id); }}
                                                className={cn(
                                                    "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                                    activeScenarioId === s.id ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                )}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {isCreatingScenario && (
                                <motion.form 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onSubmit={handleCreateScenario}
                                    className="p-2 space-y-3"
                                >
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Nombre del escenario..."
                                        value={newScenarioName}
                                        onChange={(e) => setNewScenarioName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white border-2 border-indigo-100 text-sm font-bold focus:ring-0"
                                    />
                                    <div className="flex space-x-2">
                                        <button 
                                            type="submit" 
                                            disabled={saving}
                                            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center"
                                        >
                                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear"}
                                        </button>
                                        <button type="button" onClick={() => setIsCreatingScenario(false)} className="px-4 py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
                                    </div>
                                </motion.form>
                            )}

                            {scenarios.length === 0 && !isCreatingScenario && (
                                <div className="py-8 text-center px-4">
                                    <AlertCircle className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No hay escenarios activos.<br/>Cree uno para comenzar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Contenido Principal */}
                <div className="lg:col-span-9 space-y-6">
                    {activeScenario ? (
                        <>
                            {/* Editor de Escenario */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
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
                                                isDaasMode(activeScenarioId)
                                                    ? "bg-slate-100 border-slate-200"
                                                    : "bg-emerald-50 border-emerald-100"
                                            )}>
                                                <input 
                                                    type="text"
                                                    value={globalMarginBuffer !== null ? globalMarginBuffer : totals.globalMarginPct.toFixed(2)}
                                                    onFocus={() => !isDaasMode(activeScenarioId) && setGlobalMarginBuffer(totals.globalMarginPct.toFixed(2))}
                                                    onChange={(e) => !isDaasMode(activeScenarioId) && setGlobalMarginBuffer(e.target.value)}
                                                    onBlur={(e) => {
                                                        if (!isDaasMode(activeScenarioId)) {
                                                            updateGlobalMargin(e.target.value);
                                                            setGlobalMarginBuffer(null);
                                                        }
                                                    }}
                                                    disabled={isDaasMode(activeScenarioId)}
                                                    className={cn(
                                                        "w-16 bg-transparent border-none text-right font-black p-0 focus:ring-0 text-sm",
                                                        isDaasMode(activeScenarioId)
                                                            ? "text-slate-400 cursor-not-allowed"
                                                            : "text-emerald-700"
                                                    )}
                                                />
                                                <span className={cn(
                                                    "ml-1 text-xs font-black",
                                                    isDaasMode(activeScenarioId) ? "text-slate-400" : "text-emerald-600"
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
                                                        isDaasMode(activeScenarioId) ? "text-pink-600" : "text-sky-700"
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

                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-y border-slate-100">
                                            <tr>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant.</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Margen (%)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unitario ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] text-center" title="Diluir el costo de este ítem entre los demás">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <Layers className="h-3 w-3" />
                                                        <span>Diluir</span>
                                                    </div>
                                                </th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {activeScenario.scenarioItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-8 py-24 text-center">
                                                        <div className="max-w-xs mx-auto space-y-4 opacity-30 grayscale">
                                                            <Package className="h-16 w-16 mx-auto text-slate-400" />
                                                            <p className="text-sm font-bold text-slate-500">No hay ítems en este escenario. Realice un picking para empezar.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                [...activeScenario.scenarioItems]
                                                    .sort((a, b) => {
                                                        // Diluted items go first
                                                        if (a.isDilpidate && !b.isDilpidate) return -1;
                                                        if (!a.isDilpidate && b.isDilpidate) return 1;
                                                        return 0;
                                                    })
                                                    .map((si, idx) => {
                                                    // Precompute dilution distribution for the display
                                                    const allItems = activeScenario.scenarioItems;
                                                    const dilutedItems = allItems.filter(i => i.isDilpidate);
                                                    const normalItems = allItems.filter(i => !i.isDilpidate);

                                                    // Total diluted cost: unitCost × quantity
                                                    let totalDilutedCost = 0;
                                                    dilutedItems.forEach(di => {
                                                        totalDilutedCost += Number(di.item.unitCost) * di.quantity;
                                                    });

                                                    // Total normal subtotal: Σ(unitCost × quantity) for weights
                                                    let totalNormalSubtotal = 0;
                                                    normalItems.forEach(ni => {
                                                        totalNormalSubtotal += Number(ni.item.unitCost) * ni.quantity;
                                                    });

                                                    const item = si.item;
                                                    const globalItemIdx = proposal?.proposalItems.findIndex((pi: ProposalCalcItem) => pi.id === si.itemId) ?? -1;
                                                    const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;
                                                    
                                                    const cost = Number(item.unitCost);
                                                    const flete = Number(item.internalCosts?.fletePct || 0);
                                                    const parentLandedCost = cost * (1 + flete / 100);

                                                    // Calculate children costs
                                                    let childrenCostPerUnit = 0;
                                                    const children = si.children || [];
                                                    children.forEach(child => {
                                                        const cCost = Number(child.item.unitCost);
                                                        const cFlete = Number(child.item.internalCosts?.fletePct || 0);
                                                        childrenCostPerUnit += cCost * (1 + cFlete / 100) * child.quantity;
                                                    });
                                                    const baseLandedCost = parentLandedCost + (childrenCostPerUnit / si.quantity);

                                                    // For non-diluted items: weight-based proportional share of diluted cost
                                                    let effectiveLandedCost = baseLandedCost;
                                                    if (!si.isDilpidate && totalNormalSubtotal > 0 && totalDilutedCost > 0) {
                                                        const cost = Number(item.unitCost);
                                                        const itemWeight = (cost * si.quantity) / totalNormalSubtotal;
                                                        const dilutionPerUnit = (itemWeight * totalDilutedCost) / si.quantity;
                                                        effectiveLandedCost = baseLandedCost + dilutionPerUnit;
                                                    }

                                                    const margin = si.marginPctOverride !== undefined ? si.marginPctOverride : Number(item.marginPct);
                                                    let unitPrice = 0;
                                                    if (!si.isDilpidate && margin < 100) {
                                                        unitPrice = effectiveLandedCost / (1 - margin / 100);
                                                    }

                                                    const isExpanded = expandedItems.has(si.id!);
                                                    const childCount = children.length;

                                                    return (
                                                        <>
                                                        <tr key={si.id} className={cn(
                                                            "group transition-colors",
                                                            si.isDilpidate
                                                                ? "bg-amber-50/70 hover:bg-amber-50"
                                                                : "hover:bg-slate-50"
                                                        )}>
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center space-x-2">
                                                                    <button
                                                                        onClick={() => toggleExpandItem(si.id!)}
                                                                        className={cn(
                                                                            "p-1 rounded-lg transition-all",
                                                                            isExpanded ? "bg-indigo-100 text-indigo-600" : "text-slate-300 hover:text-indigo-400 hover:bg-indigo-50"
                                                                        )}
                                                                    >
                                                                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                                                                    </button>
                                                                    <span className="text-[11px] font-black text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg">#{displayIdx}</span>
                                                                    {childCount > 0 && (
                                                                        <span className="text-[9px] font-black bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md">
                                                                            +{childCount}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-6">
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-slate-900 text-sm">{item.name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.itemType} {item.isTaxable ? '(Gravado 19%)' : '(No Gravado)'}</span>
                                                                    {childCount > 0 && (
                                                                        <span className="text-[9px] text-violet-500 font-bold mt-0.5">
                                                                            Incluye {childCount} sub-ítem{childCount > 1 ? 's' : ''} oculto{childCount > 1 ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-6">
                                                                <input 
                                                                    type="text" 
                                                                    value={si.quantity}
                                                                    onChange={(e) => updateQuantity(si.id!, e.target.value)}
                                                                    className="w-16 mx-auto bg-slate-100 border-none rounded-xl text-center font-black text-xs py-2"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-6">
                                                                {si.isDilpidate ? (
                                                                    <div className="relative w-24 mx-auto">
                                                                        <input 
                                                                            type="text" 
                                                                            value="0.00"
                                                                            disabled
                                                                            className="w-full bg-amber-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6 text-amber-400 cursor-not-allowed"
                                                                        />
                                                                        <Percent className="absolute left-2 top-2.5 h-3 w-3 text-amber-300" />
                                                                    </div>
                                                                ) : isDaasMode(activeScenarioId) ? (
                                                                    <div className="relative w-24 mx-auto">
                                                                        <input 
                                                                            type="text" 
                                                                            value="0.00"
                                                                            disabled
                                                                            className="w-full bg-pink-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6 text-pink-400 cursor-not-allowed"
                                                                        />
                                                                        <Percent className="absolute left-2 top-2.5 h-3 w-3 text-pink-300" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative w-24 mx-auto">
                                                                        <input 
                                                                            type="text" 
                                                                            value={editingCell?.id === si.id && editingCell?.field === 'margin' 
                                                                                ? editingCell.value 
                                                                                : Number((si.marginPctOverride !== undefined && si.marginPctOverride !== null) ? si.marginPctOverride : item.marginPct).toFixed(2)}
                                                                            onFocus={() => {
                                                                                const val = Number((si.marginPctOverride !== undefined && si.marginPctOverride !== null) ? si.marginPctOverride : item.marginPct);
                                                                                setEditingCell({ id: si.id!, field: 'margin', value: val.toFixed(2) });
                                                                            }}
                                                                            onChange={(e) => setEditingCell({ id: si.id!, field: 'margin', value: e.target.value })}
                                                                            onBlur={(e) => {
                                                                                updateMargin(si.id!, e.target.value);
                                                                                setEditingCell(null);
                                                                            }}
                                                                            className={cn(
                                                                                "w-full bg-indigo-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6",
                                                                                (si.marginPctOverride !== undefined && si.marginPctOverride !== null) ? "text-indigo-600" : "text-slate-400"
                                                                            )}
                                                                        />
                                                                        <Percent className="absolute left-2 top-2.5 h-3 w-3 text-indigo-300" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-6 text-right font-mono text-xs text-slate-500">
                                                                {si.isDilpidate ? (
                                                                    <span className="text-xs font-black text-amber-400">—</span>
                                                                ) : isDaasMode(activeScenarioId) ? (
                                                                    <span className="text-xs font-black text-pink-400 bg-pink-50 px-3 py-2 rounded-xl">{unitPrice.toFixed(2)}</span>
                                                                ) : (
                                                                    <input 
                                                                        type="text"
                                                                        value={editingCell?.id === si.id && editingCell?.field === 'price' 
                                                                            ? editingCell.value 
                                                                            : unitPrice.toFixed(2)}
                                                                        onFocus={() => setEditingCell({ id: si.id!, field: 'price', value: unitPrice.toFixed(2) })}
                                                                        onChange={(e) => setEditingCell({ id: si.id!, field: 'price', value: e.target.value })}
                                                                        onBlur={(e) => {
                                                                            updateUnitPrice(si.id!, e.target.value);
                                                                            setEditingCell(null);
                                                                        }}
                                                                        className="w-24 bg-slate-100 border-none rounded-xl text-right font-black text-xs py-2 px-3 focus:ring-2 focus:ring-indigo-600/20"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-6 text-right font-mono font-black text-indigo-600">
                                                                {si.isDilpidate ? (
                                                                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                                                                        Diluido
                                                                    </span>
                                                                ) : (
                                                                    <>${ (unitPrice * si.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-6 text-center">
                                                                <button
                                                                    onClick={() => toggleDilpidate(si.id!)}
                                                                    className={cn(
                                                                        "p-2 rounded-xl transition-all border-2",
                                                                        si.isDilpidate
                                                                            ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200 scale-110"
                                                                            : "bg-white border-slate-200 text-slate-300 hover:border-amber-300 hover:text-amber-500"
                                                                    )}
                                                                    title={si.isDilpidate ? 'Quitar dilución de costo' : 'Diluir costo entre los demás ítems'}
                                                                >
                                                                    <Layers className="h-3.5 w-3.5" />
                                                                </button>
                                                            </td>
                                                            <td className="px-8 py-6 text-right">
                                                                <button 
                                                                    onClick={() => removeItemFromScenario(si.id!)}
                                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {/* Expanded children section */}
                                                        {isExpanded && (
                                                            <tr key={`${si.id}-children`}>
                                                                <td colSpan={8} className="px-0 py-0">
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="bg-violet-50/50 border-y border-violet-100"
                                                                    >
                                                                        <div className="px-12 py-4 space-y-2">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Sub-ítems ocultos de #{displayIdx}</span>
                                                                                <button
                                                                                    onClick={() => setPickingChildrenFor(si.id!)}
                                                                                    className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-lg transition-colors"
                                                                                >
                                                                                    <Plus className="h-3 w-3" />
                                                                                    <span>Agregar Oculto</span>
                                                                                </button>
                                                                            </div>
                                                                            {children.length === 0 ? (
                                                                                <p className="text-[10px] text-violet-400 font-bold py-3 text-center">No hay sub-ítems ocultos. Agregue artículos cuyo costo se absorba dentro del ítem #{displayIdx}.</p>
                                                                            ) : (
                                                                                children.map(child => {
                                                                                    const childGlobalIdx = proposal?.proposalItems.findIndex((pi: ProposalCalcItem) => pi.id === child.itemId) ?? -1;
                                                                                    const childDisplayIdx = childGlobalIdx !== -1 ? childGlobalIdx + 1 : '?';
                                                                                    const cCost = Number(child.item.unitCost);
                                                                                    const cFlete = Number(child.item.internalCosts?.fletePct || 0);
                                                                                    const cLanded = cCost * (1 + cFlete / 100);
                                                                                    return (
                                                                                        <div key={child.id} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-violet-100 shadow-sm">
                                                                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                                                                <span className="text-[10px] font-black text-violet-400 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">#{childDisplayIdx}</span>
                                                                                                <div className="min-w-0">
                                                                                                    <p className="text-xs font-black text-slate-800 truncate">{child.item.name}</p>
                                                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{child.item.itemType}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex items-center space-x-5 shrink-0">
                                                                                                <div className="flex flex-col items-center">
                                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cant.</span>
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        inputMode="numeric"
                                                                                                        value={child.quantity}
                                                                                                        onChange={(e) => updateChildQuantity(si.id!, child.id!, e.target.value)}
                                                                                                        className="w-14 text-[11px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-violet-300 border-none px-2 py-1 rounded-lg text-center transition-all"
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="flex flex-col items-end">
                                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Costo Unit.</span>
                                                                                                    <span className="text-[11px] font-mono font-black text-emerald-600">${cLanded.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                                                </div>
                                                                                                <div className="flex flex-col items-end">
                                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total</span>
                                                                                                    <span className="text-[11px] font-mono font-black text-violet-600">${(cLanded * child.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                                                </div>
                                                                                                <button
                                                                                                    onClick={() => removeChildItem(si.id!, child.id!)}
                                                                                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                                                >
                                                                                                    <Trash2 className="h-3 w-3" />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })
                                                                            )}
                                                                            {children.length > 0 && (
                                                                                <div className="flex justify-end pt-1">
                                                                                    <span className="text-[9px] font-black text-violet-600 bg-violet-100 px-3 py-1 rounded-lg">
                                                                                        Costo oculto total: ${childrenCostPerUnit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </motion.div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                        </>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <ScenarioTotalsCards totals={totals} currency={activeScenario.currency} />
                        </>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                             <Calculator className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                             <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">Seleccione o cree un escenario para modelar costos.</h4>
                        </div>
                    )}
                </div>
            </div>

            <ItemPickerModal
                isOpen={isPickingItems}
                onClose={() => setIsPickingItems(false)}
                proposalItems={proposalItems}
                scenarioItems={activeScenario?.scenarioItems}
                onAddItem={addItemToScenario}
            />

            {/* Child item picker — filters out the parent itself and items already added as children */}
            <ItemPickerModal
                isOpen={pickingChildrenFor !== null}
                onClose={() => setPickingChildrenFor(null)}
                proposalItems={proposalItems.filter(pi => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    if (!parentSi) return true;
                    if (pi.id === parentSi.itemId) return false;
                    return true;
                })}
                scenarioItems={(() => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    return parentSi?.children?.map(c => ({ ...c, itemId: c.itemId })) || [];
                })()}
                onAddItem={(itemId) => {
                    if (pickingChildrenFor) {
                        addChildItem(pickingChildrenFor, itemId);
                    }
                }}
            />
        </div>
    );
}
