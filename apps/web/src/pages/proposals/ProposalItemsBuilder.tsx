import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, Save, Loader2,
    Plus, Trash2, Lock,
    Calendar, Clock, FileText, ChevronRight, Edit2, Copy,
    Cpu
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProposalItem, ProposalDetail } from '../../lib/types';
import { ITEM_TYPE_LABELS, MAYORISTA_FLETE_PCT, PROVEEDOR_MAYORISTA } from '../../lib/constants';
import SpecFieldsSection from '../../components/proposals/SpecFieldsSection';
import { useProposalBuilder } from '../../hooks/useProposalBuilder';
import ProposalStepper from '../../components/proposals/ProposalStepper';
import ProposalNavBar from '../../components/proposals/ProposalNavBar';

export default function ProposalItemsBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, catalogs, proposal, setProposal, items,
        initialItemForm, saveItem, deleteItem, updateProposal,
    } = useProposalBuilder(id);

    // UI state
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [itemForm, setItemForm] = useState<ProposalItem>(initialItemForm);

    const handleUpdateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proposal) return;
        await updateProposal({
            subject: proposal.subject,
            issueDate: proposal.issueDate,
            validityDays: proposal.validityDays,
            validityDate: proposal.validityDate,
        });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProposal((prev) => {
            if (!prev) return prev;
            const next = { ...prev, [name]: value } as ProposalDetail & Record<string, unknown>;
            if (name === 'validityDays') {
                const days = parseInt(value, 10) || 0;
                const d = new Date(String(next.issueDate));
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
                next.validityDays = days;
            } else if (name === 'validityDate') {
                const start = new Date(String(next.issueDate));
                const end = new Date(value);
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                next.validityDays = diffDays > 0 ? diffDays : 0;
            } else if (name === 'issueDate') {
                const days = next.validityDays || 0;
                const d = new Date(value);
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
            }
            return next;
        });
    };


    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target;

        // Convertir coma a punto y dejar solo números y un punto
        if (['unitCost', 'marginPct', 'unitPrice', 'internal.fletePct', 'quantity'].includes(name)) {
            value = value.replace(/,/g, '.');
            value = value.replace(/[^\d.]/g, '');
            const parts = value.split('.');
            // Asegurar 1 solo punto
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            // Limitar a 2 decimales (Excepto cantidad que puede ser un entero o ignorar)
            if (name !== 'quantity') {
                const decParts = value.split('.');
                if (decParts.length === 2 && decParts[1].length > 2) {
                    value = decParts[0] + '.' + decParts[1].substring(0, 2);
                }
            }
        }

        setItemForm(prev => {
            let next = { ...prev };
            
            if (name.startsWith('spec.')) {
                const specField = name.split('.')[1];
                next.technicalSpecs = { ...prev.technicalSpecs, [specField]: value };
            } else if (name.startsWith('internal.')) {
                const internalField = name.split('.')[1];


                // Dependencia directa de proveedor a flete
                if (internalField === 'proveedor') {
                    next.internalCosts = { 
                        ...prev.internalCosts, 
                        proveedor: value,
                        fletePct: value === PROVEEDOR_MAYORISTA ? MAYORISTA_FLETE_PCT : 0 
                    };
                } else {
                    next.internalCosts = {
                        ...prev.internalCosts,
                        [internalField]: value
                    };
                }
            } else {
                (next as Record<string, unknown>)[name] = value;
            }

            // Lógica de cálculo automático con Costo Landed (Márgen sobre costo + flete)
            const cost = ['unitCost'].includes(name) ? Number(value) : Number(next.unitCost || 0);
            const margin = ['marginPct'].includes(name) ? Number(value) : Number(next.marginPct || 0);
            
            let fleteValue = Number(next.internalCosts?.fletePct || 0);
            if (name === 'internal.proveedor') {
                fleteValue = value === PROVEEDOR_MAYORISTA ? MAYORISTA_FLETE_PCT : 0;
            } else if (name === 'internal.fletePct') {
                fleteValue = Number(value);
            }
            const flete = fleteValue;
            
            const landedCost = cost * (1 + (flete / 100));

            // Disparar cálculos bidireccionales de manera robusta
            if (name === 'unitCost' || name === 'marginPct' || name === 'internal.fletePct' || name === 'internal.proveedor') {
                if (margin < 100 && landedCost > 0) {
                    const priceVal = landedCost / (1 - (margin / 100));
                    next.unitPrice = priceVal.toFixed(2);
                } else if (landedCost === 0) {
                    next.unitPrice = ''; // En caso de que no haya costo, limpiamos
                }
            } else if (name === 'unitPrice') {
                const price = Number(value);
                if (price > 0 && landedCost > 0) {
                    // Calculamos margen en base a qué tan grande es el precio vs landed cost
                    const marginVal = ((price - landedCost) / price) * 100;
                    next.marginPct = marginVal.toFixed(2);
                } else if (price > 0 && landedCost === 0) {
                    // Si ya le puso precio de venta y no hay costo, el margen teóricamente es 100%
                    next.marginPct = '100.00';
                }
            }

            return next;
        });
    };

    const selectSuggestion = (field: string, value: string) => {
        setItemForm(prev => ({
            ...prev,
            technicalSpecs: {
                ...prev.technicalSpecs,
                [field]: value
            }
        }));
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await saveItem(itemForm, editingItemId);
        if (success) {
            setIsAddingItem(false);
            setEditingItemId(null);
            setItemForm(initialItemForm);
        }
    };

    const editItem = (item: ProposalItem) => {
        setItemForm(item);
        setEditingItemId(item.id || null);
        setIsAddingItem(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const duplicateItem = (item: ProposalItem) => {
        const newItem = { ...item };
        delete newItem.id;
        setItemForm(newItem);
        setEditingItemId(null);
        setIsAddingItem(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    // Se ha removido la totalización por petición del usuario

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            <ProposalStepper proposalId={id!} currentStep={1} />

            {/* Header del Asistente */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                        <Package className="h-8 w-8 mr-3 text-indigo-600" />
                        Constructor de Propuesta
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Arquitectura de Oferta y Estructura de Costos</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Referencia Única</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* SECCIÓN SUPERIOR: Ajustes y Datos del Cliente (Horizontal) */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
                {/* Info Cliente */}
                <div className="lg:col-span-3 bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Lock className="h-12 w-12" />
                    </div>
                    <div className="space-y-1 relative z-10">
                        <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Cliente / Empresa</p>
                        <p className="text-xl font-black leading-tight tracking-tight">{proposal.clientName}</p>
                        <div className="flex items-center space-x-2 mt-2">
                             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Sesión Activa</span>
                        </div>
                    </div>
                </div>

                {/* Ajustes Horizontales */}
                <div className="lg:col-span-9 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6">
                    <form onSubmit={handleUpdateProposal} className="flex flex-col gap-6">
                        <div className="w-full space-y-2">
                            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                <FileText className="h-3 w-3 mr-1.5" /> Asunto
                            </label>
                            <textarea 
                                name="subject" 
                                value={proposal.subject} 
                                onChange={handleDateChange} 
                                className="block w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 font-bold text-slate-700 min-h-[96px] resize-none leading-relaxed" 
                                placeholder="Especifique el asunto del requerimiento..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3 mr-1.5" /> Emisión
                                </label>
                                <input type="date" name="issueDate" value={proposal.issueDate} onChange={handleDateChange} className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 text-slate-700 font-black min-w-[150px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Clock className="h-3 w-3 mr-1.5" /> Días Validez
                                </label>
                                <input type="number" name="validityDays" value={proposal.validityDays} onChange={handleDateChange} className="block w-full px-4 py-3 bg-indigo-50 border-none rounded-2xl text-sm text-center focus:ring-2 focus:ring-indigo-600/20 font-black text-indigo-600" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3 mr-1.5" /> Fecha Validez
                                </label>
                                <input type="date" name="validityDate" value={proposal.validityDate} onChange={handleDateChange} className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 text-slate-700 font-black min-w-[150px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-500">
                                    <Save className="h-3 w-3 mr-1.5" /> Acción
                                </label>
                                <button type="submit" disabled={saving} className="w-full flex justify-center items-center h-[46px] px-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACTUALIZAR"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </motion.div>

            {/* ÁREA PRINCIPAL: CONSTRUCTOR */}
            <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
                    
                    {/* Status bar & Add Trigger */}
                    <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                                <Cpu className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
                                    ITEMS_ARCHITECT
                                    <span className="ml-3 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-md font-black">v2.0</span>
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">Configuración técnica de componentes y servicios.</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {isAddingItem ? (
                                <button onClick={() => setIsAddingItem(false)} className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 transition-colors px-5 py-3.5 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-sm">
                                     <ChevronRight className="h-4 w-4 -rotate-90" />
                                     <span>CONTRAER</span>
                                </button>
                            ) : (
                                <>
                                    {(itemForm.name !== '' || editingItemId) && (
                                        <button onClick={() => setIsAddingItem(true)} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors px-6 py-4 font-black text-xs uppercase tracking-widest border-2 border-indigo-200 rounded-2xl bg-indigo-50 hover:bg-indigo-100 shadow-sm">
                                             <ChevronRight className="h-5 w-5 rotate-90" />
                                             <span>EXPANDIR</span>
                                        </button>
                                    )}
                                    <button onClick={() => { setItemForm(initialItemForm); setEditingItemId(null); setIsAddingItem(true); }} className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-95 text-xs font-black uppercase tracking-widest">
                                        <Plus className="h-5 w-5" />
                                        <span>NUEVO ITEM</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Formulario de Configuración Dinámica */}
                    <AnimatePresence>
                        {isAddingItem && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-indigo-50/20 overflow-hidden border-b border-indigo-100">
                                <form onSubmit={handleSaveItem} className="p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        {/* ITEM # (Solo lectura) */}
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">ITEM #</label>
                                            <div className="w-full px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 text-sm font-black text-slate-400 flex items-center justify-center">
                                                {editingItemId 
                                                    ? items.findIndex(i => i.id === editingItemId) + 1 
                                                    : items.length + 1}
                                            </div>
                                        </div>

                                        {/* Selector de Tipo */}
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Elegible Categoría</label>
                                            <select name="itemType" value={itemForm.itemType} onChange={handleItemChange} className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 appearance-none shadow-sm cursor-pointer hover:border-indigo-200 transition-colors">
                                                {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Nombre del Item */}
                                        <div className="md:col-span-7 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre de Item</label>
                                            <input type="text" name="name" value={itemForm.name} onChange={handleItemChange} required placeholder="Ej. Laptops Dell Vostro 3400..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 shadow-sm placeholder:text-slate-300 transition-all" />
                                        </div>

                                        {/* SECCIÓN DE ESPECIFICACIONES TÉCNICAS (data-driven) */}
                                        <SpecFieldsSection
                                            itemType={itemForm.itemType}
                                            technicalSpecs={itemForm.technicalSpecs || {}}
                                            catalogs={catalogs}
                                            onChange={handleItemChange}
                                            onSelectSuggestion={selectSuggestion}
                                        />

                                        {/* Tiempo de Entrega */}
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tiempo de Entrega (días)</label>
                                            <input
                                                type="number"
                                                name="deliveryDays"
                                                value={itemForm.deliveryDays ?? ''}
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    setItemForm(prev => ({
                                                        ...prev,
                                                        deliveryDays: raw === '' ? null : parseInt(raw, 10),
                                                    }));
                                                }}
                                                min={0}
                                                step={1}
                                                placeholder="Ej: 30"
                                                className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 shadow-sm placeholder:text-slate-300 transition-all"
                                            />
                                        </div>

                                        {/* Descripción General */}
                                        <div className="md:col-span-12 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notas Técnicas Complementarias</label>
                                            <textarea name="description" value={itemForm.description} onChange={handleItemChange} rows={3} placeholder="Ingrese detalles específicos no contemplados en la ficha técnica..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-medium text-slate-700 resize-none shadow-sm transition-all" />
                                        </div>

                                        {/* Estructura Comercial */}
                                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl">
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen (Prov)</label>
                                                <select name="internal.proveedor" value={itemForm.internalCosts?.proveedor || 'MAYORISTA'} onChange={handleItemChange} className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 focus:ring-2 focus:ring-slate-700 appearance-none">
                                                    <option value="MAYORISTA">MAYORISTA</option>
                                                    <option value="FABRICANTE">FABRICANTE</option>
                                                    <option value="NOVOTECHNO">NOVOTECHNO</option>
                                                    <option value="OTROS">OTROS</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flete (%)</label>
                                                <input type="text" inputMode="decimal" name="internal.fletePct" value={itemForm.internalCosts?.fletePct !== undefined ? itemForm.internalCosts.fletePct : 1.5} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 text-center focus:ring-2 focus:ring-slate-700" />
                                            </div>
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                                                <div className="flex items-stretch gap-0">
                                                    <input type="text" inputMode="decimal" name="unitCost" value={itemForm.unitCost !== undefined ? itemForm.unitCost : ''} onChange={handleItemChange} required className="flex-1 min-w-0 px-5 py-4 rounded-l-2xl bg-slate-800 border-none text-sm font-black text-emerald-400 text-right focus:ring-2 focus:ring-emerald-500/20" />
                                                    <div className="flex flex-col">
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemForm(prev => ({ ...prev, costCurrency: 'COP' }))}
                                                            className={`flex-1 px-3 text-[9px] font-black tracking-wider rounded-tr-2xl transition-all ${
                                                                (itemForm.costCurrency || 'COP') === 'COP'
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                                            }`}
                                                        >COP</button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemForm(prev => ({ ...prev, costCurrency: 'USD' }))}
                                                            className={`flex-1 px-3 text-[9px] font-black tracking-wider rounded-br-2xl transition-all ${
                                                                itemForm.costCurrency === 'USD'
                                                                    ? 'bg-indigo-500 text-white'
                                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                                            }`}
                                                        >USD</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-amber-300 uppercase tracking-widest ml-1">Nuevo Costo Unitario ($)</label>
                                                <div className="w-full px-5 py-4 rounded-2xl bg-amber-600/20 border-2 border-amber-500/30 text-sm font-black text-amber-300 text-right">
                                                    {(() => {
                                                        const cost = Number(itemForm.unitCost || 0);
                                                        const flete = Number(itemForm.internalCosts?.fletePct || 0);
                                                        const nuevoCosto = cost * (1 + (flete / 100));
                                                        return nuevoCosto > 0 ? `$${nuevoCosto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">IVA (%)</label>
                                                <select 
                                                    name="isTaxable" 
                                                    value={itemForm.isTaxable ? "true" : "false"} 
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, isTaxable: e.target.value === "true" }))}
                                                    className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 focus:ring-2 focus:ring-slate-700 appearance-none shadow-xl"
                                                >
                                                    <option value="true">19%</option>
                                                    <option value="false">0%</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-4 pt-4">
                                        <button type="button" onClick={() => { setIsAddingItem(false); setEditingItemId(null); setItemForm(initialItemForm); }} className="px-10 py-5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                                            Descartar
                                        </button>
                                        <button type="submit" disabled={saving} className="px-14 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 flex items-center">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-3" /> : (
                                                <>
                                                    <Save className="h-4 w-4 mr-3" />
                                                    {editingItemId ? 'GUARDAR_CAMBIOS' : 'INSERTAR_VALORES'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Listado de Items en Propuesta */}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoría</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nuevo Costo Unitario ($)</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ctrl</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-32 text-center">
                                            <div className="max-w-xs mx-auto space-y-4 grayscale opacity-40">
                                                <Cpu className="h-20 w-20 mx-auto text-indigo-300" />
                                                <p className="text-sm font-bold text-slate-400">Su arquitectura aún no tiene componentes definidos.</p>
                                                <button onClick={() => { setItemForm(initialItemForm); setEditingItemId(null); setIsAddingItem(true); }} className="px-6 py-2 border-2 border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase tracking-widest transition-all">Añadir PRIMER ITEM</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((i, idx) => (
                                        <tr key={i.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-8 py-8 font-black text-slate-300 text-xs">Item {idx + 1}</td>
                                            <td className="px-4 py-8">
                                                <div className={cn(
                                                    "inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase shadow-sm",
                                                    i.itemType === 'PCS' ? "bg-indigo-600 text-white" :
                                                    i.itemType === 'SOFTWARE' ? "bg-purple-500 text-white" :
                                                    "bg-slate-800 text-white"
                                                )}>
                                                    {ITEM_TYPE_LABELS[i.itemType]}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-base mb-1 tracking-tight">{i.name}</span>
                                                    {i.description && <span className="text-[11px] text-slate-400 font-bold mb-2 italic">"{i.description}"</span>}
                                                    {i.itemType === 'PCS' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.modelo && <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-rose-100/50">{i.technicalSpecs.modelo}</span>}
                                                            {i.technicalSpecs.procesador && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.procesador}</span>}
                                                            {i.technicalSpecs.memoriaRam && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.memoriaRam}</span>}
                                                            {i.technicalSpecs.almacenamiento && <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-amber-100/50">{i.technicalSpecs.almacenamiento}</span>}
                                                            {i.technicalSpecs.garantiaEquipo && <span className="px-2.5 py-1 bg-cyan-50 text-cyan-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-cyan-100/50">{i.technicalSpecs.garantiaEquipo}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'ACCESSORIES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.garantia && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.garantia}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'PC_SERVICES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.responsable && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.responsable}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-amber-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'SOFTWARE' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-purple-100/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'INFRASTRUCTURE' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.garantia && <span className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-orange-100/50">{i.technicalSpecs.garantia}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'INFRA_SERVICES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.responsable && <span className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{i.technicalSpecs.responsable}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider ${
                                                        i.costCurrency === 'USD'
                                                            ? 'bg-indigo-100 text-indigo-600'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>{i.costCurrency || 'COP'}</span>
                                                    <span className="font-mono text-[13px] text-slate-400 tracking-tighter">${(Number(i.unitCost) * (1 + Number(i.internalCosts?.fletePct || 0) / 100)).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button onClick={() => editItem(i)} title="Editar" className="p-2 sm:p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-lg hover:shadow-indigo-100 rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                                                        <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <button onClick={() => duplicateItem(i)} title="Duplicar" className="p-2 sm:p-3 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-100 rounded-2xl transition-all border border-transparent hover:border-emerald-100">
                                                        <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <button onClick={() => i.id && deleteItem(i.id)} title="Eliminar" className="p-2 sm:p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 hover:shadow-lg hover:shadow-red-100 rounded-2xl transition-all border border-transparent hover:border-red-100">
                                                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <ProposalNavBar proposalId={id!} currentStep={1} />
        </div>
    );
}
