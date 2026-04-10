import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { Client } from '../../../hooks/useClientsAdmin';

// ── Types ────────────────────────────────────────────────────

interface ClientFormModalProps {
    onClose: () => void;
    onSave: (name: string) => Promise<void>;
    editingClient: Client | null;
}

// ── Component ────────────────────────────────────────────────

export default function ClientFormModal({
    onClose, onSave, editingClient,
}: ClientFormModalProps) {
    const [name, setName] = useState(editingClient?.name ?? '');
    const [isSaving, setIsSaving] = useState(false);

    const isEditing = editingClient !== null;
    const isValid = name.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        setIsSaving(true);
        try {
            await onSave(name.trim());
        } catch (error) {
            console.error('Error saving client:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-xl font-extrabold text-slate-900">
                    {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Nombre del cliente
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Banco de Bogotá"
                            autoFocus
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-200 focus:ring-0"
                        />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || isSaving}
                            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl shadow-lg shadow-indigo-200 font-black text-[10px] uppercase tracking-widest disabled:opacity-60 transition-all"
                        >
                            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                            <span>{isEditing ? 'Guardar' : 'Crear'}</span>
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}
