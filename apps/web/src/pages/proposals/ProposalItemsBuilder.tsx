import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, Code, Wrench, Save, Loader2, ArrowRight,
    Plus, Trash2, Lock
} from 'lucide-react';
import { api } from '../../lib/api';

// Tipos para los artículos
type ItemType = 'PRODUCT' | 'SOFTWARE' | 'SERVICE';

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
}

export default function ProposalItemsBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Propuesta general
    const [proposal, setProposal] = useState<any>(null);

    // Artículos
    const [items, setItems] = useState<ProposalItem[]>([]);
    const [isAddingItem, setIsAddingItem] = useState(false);

    // Formulario de artículo actual
    const initialItemForm: ProposalItem = {
        itemType: 'PRODUCT',
        name: '',
        description: '',
        brand: '',
        partNumber: '',
        quantity: 1,
        unitCost: 0,
        marginPct: 20,
        unitPrice: 0
    };
    const [itemForm, setItemForm] = useState<ProposalItem>(initialItemForm);

    useEffect(() => {
        loadProposalData();
    }, [id]);

    const loadProposalData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${id}`);

            // Format dates for input
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

    // Actualizar la propuesta (fechas)
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
            // Opcional: mostrar un toast o aviso de "Fechas actualizadas"
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

    // Agregar Artículo
    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        setItemForm(prev => {
            const next = { ...prev, [name]: ['quantity', 'unitCost', 'marginPct', 'unitPrice'].includes(name) ? Number(value) : value };

            // Lógica de cálculo automático
            if (name === 'unitCost' || name === 'marginPct') {
                const cost = name === 'unitCost' ? Number(value) : prev.unitCost;
                const margin = name === 'marginPct' ? Number(value) : prev.marginPct;
                // Calculo de precio: Costo / (1 - Margen%)
                if (margin < 100) {
                    next.unitPrice = cost / (1 - (margin / 100));
                } else {
                    next.unitPrice = cost; // Prevenir división por 0 o negativa
                }
            } else if (name === 'unitPrice') {
                const price = Number(value);
                const cost = prev.unitCost;
                if (price > 0) {
                    next.marginPct = ((price - cost) / price) * 100;
                }
            }

            return next as ProposalItem;
        });
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
        if (!window.confirm("¿Seguro que deseas eliminar este artículo?")) return;
        try {
            await api.delete(`/proposals/items/${itemId}`);
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (error) {
            console.error(error);
            alert("Error al eliminar artículo.");
        }
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-novo-primary animate-spin" />
            </div>
        );
    }

    const totalCost = items.reduce((acc, i) => acc + (i.unitCost * i.quantity), 0);
    const totalPrice = items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
    const totalMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header del Asistente */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Constructor de Propuesta</h2>
                    <p className="text-gray-500 text-sm mt-1">Paso 2: Edición de Artículos y Costos</p>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">CÓDIGO</span>
                    <p className="text-lg font-mono font-bold text-novo-primary">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* Progreso Visual */}
            <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center text-gray-900 font-semibold cursor-pointer" onClick={() => navigate('/proposals/new')}>
                    <div className="w-8 h-8 rounded-full border-2 border-novo-primary text-novo-primary flex items-center justify-center mr-2 bg-indigo-50">1</div>
                    <span className="hidden sm:inline">Información General</span>
                </div>
                <div className="h-px bg-novo-primary flex-1"></div>
                <div className="flex items-center text-novo-primary font-semibold">
                    <div className="w-8 h-8 rounded-full bg-novo-primary text-white flex items-center justify-center mr-2 shadow-md shadow-novo-primary/30">2</div>
                    <span className="hidden sm:inline">Constructor de Artículos</span>
                </div>
                <div className="h-px bg-gray-300 flex-1"></div>
                <div className="flex items-center text-gray-400 font-medium opacity-60">
                    <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center mr-2">3</div>
                    <span className="hidden sm:inline">Generación PDF</span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

                {/* Panel lateral: Detalles Generales (Editables) */}
                <div className="xl:col-span-1 space-y-6">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                            <Lock className="h-4 w-4 mr-2 text-gray-400" />
                            Datos Fijos
                        </h3>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Cliente / Empresa</p>
                            <p className="font-semibold text-gray-800 break-words mt-1">{proposal.clientName}</p>
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <form onSubmit={handleUpdateProposal} className="space-y-5">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Ajustes Generales</h3>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700">Asunto</label>
                                <textarea
                                    name="subject"
                                    value={proposal.subject}
                                    onChange={handleDateChange}
                                    className="block w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary"
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700">Fecha de Emisión</label>
                                <input
                                    type="date"
                                    name="issueDate"
                                    value={proposal.issueDate}
                                    onChange={handleDateChange}
                                    className="block w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-700">Días Validez</label>
                                    <input
                                        type="number"
                                        name="validityDays"
                                        value={proposal.validityDays}
                                        onChange={handleDateChange}
                                        className="block w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-700">Fecha Final</label>
                                    <input
                                        type="date"
                                        name="validityDate"
                                        value={proposal.validityDate}
                                        onChange={handleDateChange}
                                        className="block w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-novo-primary bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Guardar Cambios
                            </button>
                        </form>
                    </motion.div>
                </div>

                {/* Área principal: Tabla de Artículos */}
                <div className="xl:col-span-3 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                        {/* Cabecera Tabla */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Lista de Artículos</h3>
                                <p className="text-sm text-gray-500">Agrega hardware, licencias o servicios.</p>
                            </div>

                            {!isAddingItem && (
                                <button
                                    onClick={() => setIsAddingItem(true)}
                                    className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent text-white px-4 py-2 rounded-xl shadow-lg shadow-novo-primary/20 transition-all text-sm font-medium"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Agregar Ítem</span>
                                </button>
                            )}
                        </div>

                        {/* Formulario de Agregar Ítem */}
                        <AnimatePresence>
                            {isAddingItem && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-b border-indigo-100 bg-indigo-50/30 overflow-hidden"
                                >
                                    <form onSubmit={saveItem} className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Tipo</label>
                                                <select name="itemType" value={itemForm.itemType} onChange={handleItemChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                                                    <option value="PRODUCT">Producto/Hardware</option>
                                                    <option value="SOFTWARE">Licencia/Software</option>
                                                    <option value="SERVICE">Servicio Profesional</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-9 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Nombre del Artículo</label>
                                                <input type="text" name="name" value={itemForm.name} onChange={handleItemChange} required placeholder="Ej. Servidor Dell PowerEdge R650" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                                            </div>

                                            <div className="md:col-span-12 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Descripción (Opcional, visible en PDF)</label>
                                                <textarea name="description" value={itemForm.description} onChange={handleItemChange} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white resize-none" />
                                            </div>

                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Costo Unit. ($)</label>
                                                <input type="number" step="0.01" name="unitCost" value={itemForm.unitCost} onChange={handleItemChange} required className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-right font-mono" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Margen (%)</label>
                                                <input type="number" step="0.01" name="marginPct" value={itemForm.marginPct} onChange={handleItemChange} required className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-right font-mono text-indigo-700" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Precio Venta ($)</label>
                                                <input type="number" step="0.01" name="unitPrice" value={itemForm.unitPrice} onChange={handleItemChange} required className="w-full px-3 py-2 rounded-lg border border-novo-primary/30 focus:border-novo-primary text-sm bg-indigo-50/50 text-right font-mono font-bold" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                                                <input type="number" name="quantity" value={itemForm.quantity} min="1" onChange={handleItemChange} required className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-center font-bold" />
                                            </div>
                                        </div>

                                        <div className="mt-5 flex justify-end space-x-3">
                                            <button type="button" onClick={() => setIsAddingItem(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                                                Cancelar
                                            </button>
                                            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-novo-primary hover:bg-novo-accent rounded-lg flex items-center">
                                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                                Guardar Ítem
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Tabla */}
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Descripción</th>
                                        <th className="px-4 py-3 text-right">Cant.</th>
                                        <th className="px-4 py-3 text-right">Costo U.</th>
                                        <th className="px-4 py-3 text-center">MG%</th>
                                        <th className="px-4 py-3 text-right">Precio Venta</th>
                                        <th className="px-4 py-3 text-right">Total ($)</th>
                                        <th className="px-4 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                                                <Package className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                                                <p>La propuesta no tiene artículos aún.</p>
                                                <button onClick={() => setIsAddingItem(true)} className="mt-2 text-novo-primary hover:underline font-medium">Añadir el primero</button>
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((i) => (
                                            <tr key={i.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    {i.itemType === 'PRODUCT' && <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-bold tracking-wider"><Package className="h-3 w-3 mr-1" /> HW</span>}
                                                    {i.itemType === 'SOFTWARE' && <span className="inline-flex items-center px-2 py-1 rounded bg-purple-50 text-purple-700 text-[10px] font-bold tracking-wider"><Code className="h-3 w-3 mr-1" /> SW</span>}
                                                    {i.itemType === 'SERVICE' && <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wider"><Wrench className="h-3 w-3 mr-1" /> SRV</span>}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={i.name}>{i.name}</td>
                                                <td className="px-4 py-3 text-right font-bold">{i.quantity}</td>
                                                <td className="px-4 py-3 text-right font-mono text-xs">${Number(i.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-center font-mono text-xs text-indigo-600 bg-indigo-50/30">{Number(i.marginPct).toFixed(1)}%</td>
                                                <td className="px-4 py-3 text-right font-mono text-xs">${Number(i.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-gray-900">${(Number(i.unitPrice) * i.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => i.id && deleteItem(i.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded bg-white hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {items.length > 0 && (
                                    <tfoot className="bg-gray-50/80 border-t-2 border-gray-200">
                                        <tr>
                                            <td colSpan={5} className="px-4 py-4 text-right font-bold text-gray-600 text-xs uppercase tracking-wider">
                                                Resumen Global
                                                <div className="text-[10px] font-normal text-gray-400 normal-case mt-0.5">Margen Prom: {totalMargin.toFixed(1)}%</div>
                                            </td>
                                            <td colSpan={3} className="px-4 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[11px] text-gray-500 font-medium mb-1 line-through">Costo: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    <span className="text-xl font-bold font-mono text-novo-primary">
                                                        ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium mt-1">Antes de impuestos</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            disabled={items.length === 0}
                            onClick={() => alert("Continuar a ventana 5: Selección y Generación de PDF (En Desarrollo)")}
                            className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl transition-all font-medium shadow-lg shadow-novo-primary/20 group"
                        >
                            <span>Generar PDF</span>
                            <ArrowRight className={`h-5 w-5 ${items.length > 0 ? 'group-hover:translate-x-1 transition-transform' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
