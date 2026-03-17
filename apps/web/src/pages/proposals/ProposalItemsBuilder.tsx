import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, Code, Wrench, Save, Loader2, ArrowRight,
    Plus, Trash2, Lock, Monitor, Laptop, Settings, Cpu,
    Calendar, Clock, FileText, ChevronRight, Search
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

// Tipos para los artículos según nuevos estándares
type ItemType = 'PCS' | 'ACCESSORIES' | 'PC_SERVICES' | 'SOFTWARE' | 'INFRASTRUCTURE' | 'INFRA_SERVICES';

interface PcSpecs {
    formato?: string;
    fabricante?: string;
    modelo?: string;
    procesador?: string;
    sistemaOperativo?: string;
    graficos?: string;
    memoriaRam?: string;
    almacenamiento?: string;
    pantalla?: string;
    network?: string;
    seguridad?: string;
    garantiaBateria?: string;
    garantiaEquipo?: string;
}

interface ProposalItem {
    id?: string;
    itemType: ItemType;
    name: string;
    description: string;
    brand: string;
    partNumber: string;
    quantity: number;
    unitCost: number;
    marginPct: number;
    unitPrice: number;
    technicalSpecs?: PcSpecs;
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    PCS: 'PCs',
    ACCESSORIES: 'Accesorios y Opciones',
    PC_SERVICES: 'Servicios PCs',
    SOFTWARE: 'Software',
    INFRASTRUCTURE: 'Infraestructura',
    INFRA_SERVICES: 'Servicios de Infraestructura'
};

export default function ProposalItemsBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [catalogs, setCatalogs] = useState<Record<string, string[]>>({});
    const [activeSuggestion, setActiveSuggestion] = useState<{ field: string; index: number } | null>(null);

    // Propuesta general
    const [proposal, setProposal] = useState<any>(null);

    // Artículos
    const [items, setItems] = useState<ProposalItem[]>([]);
    const [isAddingItem, setIsAddingItem] = useState(false);

    // Formulario de artículo actual
    const initialItemForm: ProposalItem = {
        itemType: 'PCS',
        name: '',
        description: '',
        brand: '',
        partNumber: '',
        quantity: 1,
        unitCost: 0,
        marginPct: 20,
        unitPrice: 0,
        technicalSpecs: {}
    };
    const [itemForm, setItemForm] = useState<ProposalItem>(initialItemForm);

    useEffect(() => {
        loadProposalData();
        loadCatalogs();
    }, [id]);

    const loadProposalData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${id}`);
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];

            setProposal(data);
            setItems(data.proposalItems || []);
        } catch (error) {
            console.error(error);
            alert("No se pudo cargar la propuesta");
        } finally {
            setLoading(false);
        }
    };

    const loadCatalogs = async () => {
        try {
            const res = await api.get('/catalogs/pc-specs');
            setCatalogs(res.data);
        } catch (error) {
            console.error("Error cargando catálogos", error);
        }
    };

    const handleUpdateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            await api.patch(`/proposals/${id}`, {
                subject: proposal.subject,
                issueDate: proposal.issueDate,
                validityDays: parseInt(proposal.validityDays),
                validityDate: proposal.validityDate
            });
        } catch (error) {
            console.error(error);
            alert("Error al actualizar la propuesta.");
        } finally {
            setSaving(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProposal((prev: any) => {
            const next = { ...prev, [name]: value };
            if (name === 'validityDays') {
                const days = parseInt(value, 10) || 0;
                const d = new Date(next.issueDate);
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
            } else if (name === 'validityDate') {
                const start = new Date(next.issueDate);
                const end = new Date(value);
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                next.validityDays = diffDays > 0 ? diffDays : 0;
            } else if (name === 'issueDate') {
                const days = parseInt(next.validityDays, 10) || 0;
                const d = new Date(value);
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
            }
            return next;
        });
    };

    const TECH_ABBR = new Set([
        'DDR','DDR3','DDR4','DDR5','DDR6',
        'LPDDR','LPDDR3','LPDDR4','LPDDR4X','LPDDR5','LPDDR5X','LPDDR6',
        'UDIMM','SODIMM','RDIMM','LRDIMM','ECC','DIMM',
        'SSD','HDD','SATA','SAS','NVME','BGA','EMMC',
        'RJ45','WIFI','LAN','WAN','NFC','USB','HDMI','DP','VGA','BIOS','UEFI','PCIE',
        'TPM','IR',
        'NVIDIA','AMD','INTEL','RTX','GTX','RX','RDNA',
        'OS','IOT','CPU','GPU','NPU','RAM','ROM',
        'GB','TB','MB','GHZ','MHZ','HP','IBM','ASUS'
    ]);
    const toProperTitleCase = (str: string) => {
        if (!str) return '';
        const titled = str.toLowerCase()
            .replace(/(^|[\s\(\+\/\-])(\w)/g, (match) => match.toUpperCase())
            .trim();
        return titled.replace(/[\w.\-]+/g, (token) => {
            const upper = token.toUpperCase();
            if (TECH_ABBR.has(upper)) return upper;
            const withoutDigits = upper.replace(/\d+[A-Z]?$/, '');
            if (withoutDigits && TECH_ABBR.has(withoutDigits)) return upper;
            return token;
        });
    };

    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target;

        setItemForm(prev => {
            let next = { ...prev };
            
            if (name.startsWith('spec.')) {
                const specField = name.split('.')[1];
                next.technicalSpecs = { ...prev.technicalSpecs, [specField]: value };
                setActiveSuggestion({ field: specField, index: -1 });
            } else {
                // @ts-ignore
                next[name] = ['quantity', 'unitCost', 'marginPct', 'unitPrice'].includes(name) ? Number(value) : value;
            }

            // Lógica de cálculo automático
            if (name === 'unitCost' || name === 'marginPct') {
                const cost = name === 'unitCost' ? Number(value) : next.unitCost;
                const margin = name === 'marginPct' ? Number(value) : next.marginPct;
                if (margin < 100) {
                    next.unitPrice = cost / (1 - (margin / 100));
                }
            } else if (name === 'unitPrice') {
                const price = Number(value);
                const cost = next.unitCost;
                if (price > 0) {
                    next.marginPct = ((price - cost) / price) * 100;
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
                [field]: value // Ya viene normalizado de la BD
            }
        }));
        setActiveSuggestion(null);
    };

    const saveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await api.post(`/proposals/${id}/items`, itemForm);
            setItems(prev => [...prev, res.data]);
            setIsAddingItem(false);
            setItemForm(initialItemForm);
        } catch (error) {
            console.error(error);
            alert("Error al agregar artículo.");
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async (itemId: string) => {
        if (!window.confirm("¿Segura que deseas eliminar este item?")) return;
        try {
            await api.delete(`/proposals/items/${itemId}`);
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (error) {
            console.error(error);
            alert("Error al eliminar el item.");
        }
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const totalCost = items.reduce((acc, i) => acc + (i.unitCost * i.quantity), 0);
    const totalPrice = items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
    const totalMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
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
                    <form onSubmit={handleUpdateProposal} className="flex flex-col md:flex-row items-end gap-6">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                <FileText className="h-3 w-3 mr-1.5" /> Asunto
                            </label>
                            <textarea 
                                name="subject" 
                                value={proposal.subject} 
                                onChange={handleDateChange} 
                                className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 font-bold text-slate-700 h-12 resize-none leading-relaxed" 
                                placeholder="Especifique el asunto del requerimiento..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-auto">
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
                        {!isAddingItem && (
                            <button onClick={() => setIsAddingItem(true)} className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-95 text-xs font-black uppercase tracking-widest">
                                <Plus className="h-5 w-5" />
                                <span>AÑADIR ITEM</span>
                            </button>
                        )}
                    </div>

                    {/* Formulario de Configuración Dinámica */}
                    <AnimatePresence>
                        {isAddingItem && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-indigo-50/20 overflow-hidden border-b border-indigo-100">
                                <form onSubmit={saveItem} className="p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        {/* ITEM # (Solo lectura) */}
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">ITEM #</label>
                                            <div className="w-full px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 text-sm font-black text-slate-400 flex items-center justify-center">
                                                {items.length + 1}
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

                                        {/* SECCIÓN ESPECIAL PARA PCs */}
                                        {itemForm.itemType === 'PCS' && (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-8 bg-white rounded-[2.5rem] border-2 border-indigo-100 shadow-inner">
                                                <div className="md:col-span-4 lg:col-span-4 flex items-center space-x-3 mb-2">
                                                    <div className="bg-indigo-600 p-2 rounded-xl shadow-md"><Monitor className="h-5 w-5 text-white" /></div>
                                                    <div>
                                                         <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Ficha Técnica Automatizada</h4>
                                                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Configure los parámetros del equipo basados en el catálogo maestro.</p>
                                                    </div>
                                                </div>
                                                
                                                {Object.entries({
                                                    formato: { label: 'Formato', cat: 'FORMATO' },
                                                    fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
                                                    modelo: { label: 'Modelo', cat: 'MODELO' },
                                                    procesador: { label: 'Procesador', cat: 'PROCESADOR' },
                                                    sistemaOperativo: { label: 'Sistema Operativo', cat: 'SISTEMA_OPERATIVO' },
                                                    graficos: { label: 'Gráficos', cat: 'GRAFICOS' },
                                                    memoriaRam: { label: 'Memoria RAM', cat: 'MEMORIA_RAM' },
                                                    almacenamiento: { label: 'Almacenamiento', cat: 'ALMACENAMIENTO' },
                                                    pantalla: { label: 'Pantalla', cat: 'PANTALLA' },
                                                    network: { label: 'Network', cat: 'NETWORK' },
                                                    seguridad: { label: 'Seguridad', cat: 'SEGURIDAD' },
                                                    garantiaBateria: { label: 'Garantía Batería', cat: 'GARANTIA_BATERIA' },
                                                    garantiaEquipo: { label: 'Garantía Equipo', cat: 'GARANTIA_EQUIPO' },
                                                }).map(([field, spec]) => {
                                                    //@ts-ignore
                                                    const currentVal = itemForm.technicalSpecs?.[field] || '';
                                                    const suggestions = currentVal.trim().length > 0 
                                                        ? catalogs[spec.cat]?.filter(v => 
                                                            v.toLowerCase().includes(currentVal.toLowerCase())
                                                          ).slice(0, 20) || []
                                                        : [];

                                                    return (
                                                        <div key={field} className="space-y-1.5 relative group">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-hover:text-indigo-400 transition-colors">{spec.label}</label>
                                                            <div className="relative">
                                                                <input 
                                                                    type="text"
                                                                    name={`spec.${field}`}
                                                                    value={currentVal}
                                                                    onChange={handleItemChange}
                                                                    onBlur={() => setTimeout(() => setActiveSuggestion(null), 200)}
                                                                    placeholder={`Escriba ${spec.label}...`}
                                                                    autoComplete="off"
                                                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white text-[13px] font-bold text-slate-700 transition-all outline-none"
                                                                />
                                                                {suggestions.length > 0 && activeSuggestion?.field === field && (
                                                                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                                                        {suggestions.map((s, i) => (
                                                                            <button
                                                                                key={i}
                                                                                type="button"
                                                                                onClick={() => selectSuggestion(field, s)}
                                                                                className="w-full px-4 py-2.5 text-left text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                                                            >
                                                                                <span>{s}</span>
                                                                                <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </motion.div>
                                        )}

                                        {/* Descripción General */}
                                        <div className="md:col-span-12 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notas Técnicas Complementarias</label>
                                            <textarea name="description" value={itemForm.description} onChange={handleItemChange} rows={3} placeholder="Ingrese detalles específicos no contemplados en la ficha técnica..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-medium text-slate-700 resize-none shadow-sm transition-all" />
                                        </div>

                                        {/* Estructura Comercial */}
                                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl">
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                                                <input type="number" step="0.01" name="unitCost" value={itemForm.unitCost} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-emerald-400 text-right focus:ring-2 focus:ring-emerald-500/20" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Margen Objetivo (%)</label>
                                                <input type="number" step="0.01" name="marginPct" value={itemForm.marginPct} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-indigo-400 text-right focus:ring-2 focus:ring-indigo-500/20" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Precio de Venta ($)</label>
                                                <input type="number" step="0.01" name="unitPrice" value={itemForm.unitPrice} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-indigo-600 border-none text-sm font-black text-white text-right shadow-lg shadow-indigo-500/20 focus:ring-2 focus:ring-white/20" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Cantidad Solicitada</label>
                                                <input type="number" name="quantity" value={itemForm.quantity} min="1" onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-white border-none text-sm font-black text-slate-900 text-center" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-4 pt-4">
                                        <button type="button" onClick={() => setIsAddingItem(false)} className="px-10 py-5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                                            Descartar
                                        </button>
                                        <button type="submit" disabled={saving} className="px-14 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 flex items-center">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-3" /> : (
                                                <>
                                                    <Save className="h-4 w-4 mr-3" />
                                                    INSERTAR_VALORES
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
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Cant.</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unitario ($)</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total ($)</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ctrl</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-8 py-32 text-center">
                                            <div className="max-w-xs mx-auto space-y-4 grayscale opacity-40">
                                                <Cpu className="h-20 w-20 mx-auto text-indigo-300" />
                                                <p className="text-sm font-bold text-slate-400">Su arquitectura aún no tiene componentes definidos.</p>
                                                <button onClick={() => setIsAddingItem(true)} className="px-6 py-2 border-2 border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase tracking-widest transition-all">Añadir PRIMER ITEM</button>
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
                                                            {i.technicalSpecs.procesador && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.procesador}</span>}
                                                            {i.technicalSpecs.memoriaRam && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.memoriaRam}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8 text-right font-black text-slate-900 text-base">x{i.quantity}</td>
                                            <td className="px-4 py-8 text-right font-mono text-[13px] text-slate-400 tracking-tighter">${Number(i.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-8 text-right font-mono text-lg font-black text-indigo-600 tracking-tighter">${(Number(i.unitPrice) * i.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-8 py-8 text-center">
                                                <button onClick={() => i.id && deleteItem(i.id)} className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 hover:shadow-lg hover:shadow-red-100 rounded-2xl transition-all border border-transparent hover:border-red-100">
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {items.length > 0 && (
                                <tfoot className="bg-slate-900 sticky bottom-0 z-20">
                                    <tr>
                                        <td colSpan={5} className="px-8 py-10 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">VALORIZACIÓN TOTAL EX-VAT</span>
                                                <div className="flex items-center justify-end space-x-4 mt-2">
                                                     <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">Margen Ponderado:</span>
                                                     <span className="text-xl font-mono font-black text-emerald-400">{totalMargin.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td colSpan={2} className="px-8 py-10 text-right bg-indigo-600 relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="text-4xl font-mono font-black text-white relative z-10 tracking-tighter">
                                                ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <p className="text-[10px] text-white/60 font-black uppercase tracking-[0.2em] mt-1 relative z-10">Total Cotización</p>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                    <button 
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span>Volver a Cabecera</span>
                    </button>
                    <button
                        disabled={items.length === 0}
                        onClick={() => alert("Generando flujo de PDF corporativo...")}
                        className="flex items-center space-x-4 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white px-16 py-6 rounded-[2rem] transition-all font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 group active:scale-95"
                    >
                        <span>Finalizar & Generar PDF</span>
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-3 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
