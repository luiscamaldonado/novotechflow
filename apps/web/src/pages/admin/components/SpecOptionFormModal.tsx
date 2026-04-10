import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { SPEC_FIELD_NAMES, FIELD_NAME_LABELS } from '../../../hooks/useSpecOptionsAdmin';
import type { SpecOption, SpecFieldName } from '../../../hooks/useSpecOptionsAdmin';

// ── Types ────────────────────────────────────────────────────

interface SpecOptionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (fieldName: string, value: string) => Promise<void>;
    editingOption: SpecOption | null;
}

// ── Component ────────────────────────────────────────────────

export default function SpecOptionFormModal({
    isOpen,
    onClose,
    onSave,
    editingOption,
}: SpecOptionFormModalProps) {
    const [fieldName, setFieldName] = useState<SpecFieldName>(SPEC_FIELD_NAMES[0]);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isEditMode = editingOption !== null;

    useEffect(() => {
        if (editingOption) {
            setFieldName(editingOption.fieldName as SpecFieldName);
            setValue(editingOption.value);
        } else {
            setFieldName(SPEC_FIELD_NAMES[0]);
            setValue('');
        }
        setError('');
    }, [editingOption, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value.trim()) {
            setError('El valor es obligatorio.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await onSave(fieldName, value.trim());
            onClose();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })
                ?.response?.data?.message || 'Error al guardar la opción.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md mx-4 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        {isEditMode ? 'Editar Opción' : 'Nueva Opción'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        <X className="h-4 w-4 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Field name select */}
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            Campo
                        </label>
                        <select
                            value={fieldName}
                            onChange={e => setFieldName(e.target.value as SpecFieldName)}
                            disabled={isEditMode}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-200 focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {SPEC_FIELD_NAMES.map(fn => (
                                <option key={fn} value={fn}>
                                    {FIELD_NAME_LABELS[fn]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Value input */}
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            Valor
                        </label>
                        <input
                            type="text"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder="Ej: HP, Dell, 16 GB DDR5..."
                            autoFocus
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-200 focus:ring-0"
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <p className="text-xs font-bold text-red-500">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all disabled:opacity-60"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <span>{isEditMode ? 'Actualizar' : 'Crear'}</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
