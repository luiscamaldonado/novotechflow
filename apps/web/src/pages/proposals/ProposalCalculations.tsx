import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calculator, Plus, Trash2, ChevronRight,
    ArrowLeft, Loader2, Package,
    CheckCircle2, AlertCircle, TrendingUp,
    Percent
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface ProposalItem {
    id: string;
    name: string;
    itemType: string;
    unitCost: number;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    internalCosts?: {
        fletePct?: number;
    };
}

interface ScenarioItem {
    id?: string;
    itemId: string;
    quantity: number;
    marginPctOverride?: number;
    item: ProposalItem;
}

interface Scenario {
    id: string;
    name: string;
    currency: string;
    description?: string;
    scenarioItems: ScenarioItem[];
}

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [proposal, setProposal] = useState<any>(null);
    const [proposalItems, setProposalItems] = useState<ProposalItem[]>([]);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [trm, setTrm] = useState<{ valor: number, fechaActualizacion: string } | null>(null);
    const [extraTrm, setExtraTrm] = useState<{ setIcapAverage: number | null, wilkinsonSpot: number | null } | null>(null);

    // Form states
    const [isCreatingScenario, setIsCreatingScenario] = useState(false);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [isPickingItems, setIsPickingItems] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [propRes, scenariosRes] = await Promise.all([
                api.get(`/proposals/${id}`),
                api.get(`/proposals/${id}/scenarios`)
            ]);
            
            setProposal(propRes.data);
            setProposalItems(propRes.data.proposalItems || []);
            setScenarios(scenariosRes.data || []);
            
            if (scenariosRes.data?.length > 0 && !activeScenarioId) {
                setActiveScenarioId(scenariosRes.data[0].id);
            }
        } catch (error) {
            console.error("Error loading calculations data", error);
        } finally {
            setLoading(false);
        }

        // Fetch TRM
        try {
            const trmRes = await fetch('https://co.dolarapi.com/v1/trm');
            const trmData = await trmRes.json();
            setTrm({
                valor: trmData.valor,
                fechaActualizacion: trmData.fechaActualizacion
            });
        } catch (error) {
            console.error("Error fetching TRM", error);
        }

        // Fetch Extra TRM (SET-ICAP & Wilkinson)
        try {
            const extraRes = await api.get('/proposals/trm-extra');
            setExtraTrm(extraRes.data);
        } catch (error) {
            console.error("Error fetching extra TRM", error);
        }
    };

    const handleCreateScenario = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newScenarioName.trim()) return;

        try {
            setSaving(true);
            const res = await api.post(`/proposals/${id}/scenarios`, {
                name: newScenarioName,
                description: ''
            });
            setScenarios(prev => [...prev, { ...res.data, scenarioItems: [] }]);
            setActiveScenarioId(res.data.id);
            setNewScenarioName('');
            setIsCreatingScenario(false);
        } catch (error) {
            console.error(error);
            alert("No se pudo crear el escenario");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteScenario = async (sid: string) => {
        if (!confirm("¿Eliminar este escenario?")) return;
        try {
            await api.delete(`/proposals/scenarios/${sid}`);
            setScenarios(prev => prev.filter(s => s.id !== sid));
            if (activeScenarioId === sid) {
                setActiveScenarioId(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddItemToScenario = async (itemId: string) => {
        if (!activeScenarioId) return;
        
        const item = proposalItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId,
                quantity: item.quantity,
                marginPct: item.marginPct
            });
            
            setScenarios(prev => prev.map(s => {
                if (s.id === activeScenarioId) {
                    return {
                        ...s,
                        scenarioItems: [...s.scenarioItems, { ...res.data, item }]
                    };
                }
                return s;
            }));
        } catch (error) {
            console.error(error);
        }
    };

    const handleChangeCurrency = async (currency: string) => {
        if (!activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}`, { currency });
            setScenarios(prev => prev.map(s => s.id === activeScenarioId ? { ...s, currency } : s));
        } catch (error) {
            console.error(error);
        }
    };

    const handleRemoveItemFromScenario = async (siId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${siId}`);
            setScenarios(prev => prev.map(s => {
                if (s.id === activeScenarioId) {
                    return {
                        ...s,
                        scenarioItems: s.scenarioItems.filter(si => si.id !== siId)
                    };
                }
                return s;
            }));
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateMargin = async (siId: string, margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val)) return;

        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: val });
            setScenarios(prev => prev.map(s => ({
                ...s,
                scenarioItems: s.scenarioItems.map(si => 
                    si.id === siId ? { ...si, marginPctOverride: val } : si
                )
            })));
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateQuantity = async (siId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val)) return;

        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { quantity: val });
            setScenarios(prev => prev.map(s => ({
                ...s,
                scenarioItems: s.scenarioItems.map(si => 
                    si.id === siId ? { ...si, quantity: val } : si
                )
            })));
        } catch (error) {
            console.error(error);
        }
    };

    const calculateTotals = (scenario: Scenario) => {
        let beforeVat = 0;
        let nonTaxed = 0;

        scenario.scenarioItems.forEach(si => {
            const item = si.item;
            const cost = Number(item.unitCost);
            const flete = Number(item.internalCosts?.fletePct || 0);
            const landedCost = cost * (1 + flete / 100);
            const marginOverride = si.marginPctOverride;
            const margin = (marginOverride !== undefined && marginOverride !== null) ? marginOverride : Number(item.marginPct);
            
            let unitPrice = 0;
            if (margin < 100) {
                unitPrice = landedCost / (1 - margin / 100);
            }

            const totalItem = unitPrice * si.quantity;
            if (item.isTaxable) {
                beforeVat += totalItem;
            } else {
                nonTaxed += totalItem;
            }
        });

        const vat = beforeVat * 0.19;
        const total = (beforeVat + vat) + nonTaxed;

        return { beforeVat, nonTaxed, vat, total };
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const activeScenario = scenarios.find(s => s.id === activeScenarioId);
    const totals = activeScenario ? calculateTotals(activeScenario) : { beforeVat: 0, nonTaxed: 0, vat: 0, total: 0 };

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
                                                Vigencia: {trm.fechaActualizacion ? new Date(trm.fechaActualizacion).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                    
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
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteScenario(s.id); }}
                                            className={cn(
                                                "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                                activeScenarioId === s.id ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                                            )}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
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
                                            <h4 className="text-xl font-black text-slate-900 tracking-tight">{activeScenario.name}</h4>
                                            <p className="text-sm text-slate-500 font-medium">Modelando {activeScenario.scenarioItems.length} ítems en este escenario.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-6">
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                            <button 
                                                onClick={() => handleChangeCurrency('COP')}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                                                    activeScenario.currency === 'COP' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                COP
                                            </button>
                                            <button 
                                                onClick={() => handleChangeCurrency('USD')}
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
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Item</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant.</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Margen (%)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unitario ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total ($)</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {activeScenario.scenarioItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-8 py-24 text-center">
                                                        <div className="max-w-xs mx-auto space-y-4 opacity-30 grayscale">
                                                            <Package className="h-16 w-16 mx-auto text-slate-400" />
                                                            <p className="text-sm font-bold text-slate-500">No hay ítems en este escenario. Realice un picking para empezar.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                activeScenario.scenarioItems.map((si) => {
                                                    const item = si.item;
                                                    const cost = Number(item.unitCost);
                                                    const flete = Number(item.internalCosts?.fletePct || 0);
                                                    const landedCost = cost * (1 + flete / 100);
                                                    const margin = si.marginPctOverride !== undefined ? si.marginPctOverride : Number(item.marginPct);
                                                    let unitPrice = 0;
                                                    if (margin < 100) {
                                                        unitPrice = landedCost / (1 - margin / 100);
                                                    }

                                                    return (
                                                        <tr key={si.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-8 py-6">
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-slate-900 text-sm">{item.name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.itemType} {item.isTaxable ? '(Gravado 19%)' : '(No Gravado)'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-6">
                                                                <input 
                                                                    type="text" 
                                                                    value={si.quantity}
                                                                    onChange={(e) => handleUpdateQuantity(si.id!, e.target.value)}
                                                                    className="w-16 mx-auto bg-slate-100 border-none rounded-xl text-center font-black text-xs py-2"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-6">
                                                                <div className="relative w-24 mx-auto">
                                                                    <input 
                                                                        type="text" 
                                                                        value={(si.marginPctOverride !== undefined && si.marginPctOverride !== null) ? si.marginPctOverride : item.marginPct}
                                                                        onChange={(e) => handleUpdateMargin(si.id!, e.target.value)}
                                                                        className={cn(
                                                                            "w-full bg-indigo-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6",
                                                                            (si.marginPctOverride !== undefined && si.marginPctOverride !== null) ? "text-indigo-600" : "text-slate-400"
                                                                        )}
                                                                    />
                                                                    <Percent className="absolute left-2 top-2.5 h-3 w-3 text-indigo-300" />
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-6 text-right font-mono text-xs text-slate-500">
                                                                ${unitPrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-6 text-right font-mono font-black text-indigo-600">
                                                                ${(unitPrice * si.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-8 py-6 text-right">
                                                                <button 
                                                                    onClick={() => handleRemoveItemFromScenario(si.id!)}
                                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Resumen de Totales */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Antes de IVA (19%)</span>
                                    <p className="text-2xl font-black text-slate-900">
                                        <span className="text-sm font-bold text-slate-300 mr-2">{activeScenario.currency}</span>
                                        ${totals.beforeVat.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Gravados (0%)</span>
                                    <p className="text-2xl font-black text-slate-900">
                                        <span className="text-sm font-bold text-slate-300 mr-2">{activeScenario.currency}</span>
                                        ${totals.nonTaxed.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm space-y-1">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">IVA Estimado</span>
                                    <p className="text-2xl font-black text-indigo-600">
                                        <span className="text-sm font-bold text-indigo-200 mr-2">{activeScenario.currency}</span>
                                        ${totals.vat.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl shadow-slate-200 space-y-1">
                                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Total Escenario</span>
                                    <p className="text-2xl font-black text-white">
                                        <span className="text-sm font-bold text-slate-600 mr-2">{activeScenario.currency}</span>
                                        ${totals.total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                             <Calculator className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                             <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">Seleccione o cree un escenario para modelar costos.</h4>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Picking de Items */}
            <AnimatePresence>
                {isPickingItems && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                                        <Package className="h-6 w-6 mr-3 text-indigo-600" />
                                        Picking de Artículos
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium">Seleccione los artículos de la propuesta original para incluir en este escenario.</p>
                                </div>
                                <button 
                                    onClick={() => setIsPickingItems(false)}
                                    className="p-4 rounded-2xl hover:bg-white transition-colors text-slate-400"
                                >
                                    <ChevronRight className="h-6 w-6 rotate-90" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-4">
                                {proposalItems.map(item => {
                                    const isAlreadyIn = activeScenario?.scenarioItems.some(si => si.itemId === item.id);
                                    return (
                                        <div 
                                            key={item.id}
                                            className={cn(
                                                "flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all",
                                                isAlreadyIn 
                                                    ? "bg-emerald-50 border-emerald-100 opacity-60" 
                                                    : "bg-white border-slate-100 hover:border-indigo-200"
                                            )}
                                        >
                                            <div className="flex items-center space-x-6">
                                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50">
                                                    <Package className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-slate-900 leading-tight">{item.name}</p>
                                                    <div className="flex items-center space-x-3 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <span>{item.itemType}</span>
                                                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                        <span>Cost Landed: ${Number(item.unitCost).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                        <span>Cant. Orig: {item.quantity}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {isAlreadyIn ? (
                                                <div className="flex items-center space-x-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest px-6 py-3 bg-white rounded-xl shadow-sm">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span>Incluido</span>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => handleAddItemToScenario(item.id)}
                                                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-slate-200"
                                                >
                                                    Agregar
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}

                                {proposalItems.length === 0 && (
                                    <div className="text-center py-20 opacity-30">
                                        <Package className="h-20 w-20 mx-auto text-slate-400 mb-4" />
                                        <p className="text-lg font-bold text-slate-500">No hay ítems en la propuesta base.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button 
                                    onClick={() => setIsPickingItems(false)}
                                    className="px-12 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-600 hover:border-slate-300 transition-all"
                                >
                                    Cerrar Picking
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
