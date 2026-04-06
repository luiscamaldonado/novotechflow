import { Loader2, Receipt, X } from 'lucide-react';
import type { ProjForm } from '../../hooks/useProjections';
import type { BillingProjection } from '../../lib/types';

interface ProjectionModalProps {
    editingProjection: BillingProjection | null;
    projForm: ProjForm;
    setProjForm: React.Dispatch<React.SetStateAction<ProjForm>>;
    savingProjection: boolean;
    onSave: () => void;
    onClose: () => void;
}

export default function ProjectionModal({
    editingProjection,
    projForm,
    setProjForm,
    savingProjection,
    onSave,
    onClose,
}: ProjectionModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Receipt className="h-5 w-5 text-white/80" />
                        <h3 className="text-lg font-bold text-white">
                            {editingProjection ? 'Editar Proyección' : 'Nueva Proyección de Facturación'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5">
                    {/* Client Name */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Cliente</label>
                        <input
                            type="text"
                            value={projForm.clientName}
                            onChange={(e) => setProjForm(prev => ({ ...prev, clientName: e.target.value }))}
                            placeholder="Nombre del cliente"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Subtotal */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Subtotal</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3 text-gray-400 font-bold text-sm">$</span>
                            <input
                                type="number"
                                value={projForm.subtotal}
                                onChange={(e) => setProjForm(prev => ({ ...prev, subtotal: e.target.value }))}
                                placeholder="0"
                                className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <select
                            value={projForm.status}
                            onChange={(e) => setProjForm(prev => ({ ...prev, status: e.target.value as 'PENDIENTE_FACTURAR' | 'FACTURADA' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="PENDIENTE_FACTURAR">Pendiente Facturar</option>
                            <option value="FACTURADA">Facturada</option>
                        </select>
                    </div>

                    {/* Acquisition Type */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Adquisición</label>
                        <select
                            value={projForm.acquisitionType}
                            onChange={(e) => setProjForm(prev => ({ ...prev, acquisitionType: e.target.value as '' | 'VENTA' | 'DAAS' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="">— Seleccionar —</option>
                            <option value="VENTA">Venta</option>
                            <option value="DAAS">DaaS</option>
                        </select>
                    </div>

                    {/* Billing Date */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fecha de Facturación</label>
                        <input
                            type="date"
                            value={projForm.billingDate}
                            onChange={(e) => setProjForm(prev => ({ ...prev, billingDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={savingProjection || !projForm.clientName.trim() || !projForm.subtotal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/25"
                    >
                        {savingProjection ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Receipt className="h-4 w-4" />
                        )}
                        <span>{editingProjection ? 'Guardar Cambios' : 'Crear Proyección'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
