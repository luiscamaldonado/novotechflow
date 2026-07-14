import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';
import { normalizeSupplierName, findSimilarCompanies } from '../../../lib/supplierMatch';
import type { SupplierCompany } from '../../../lib/types';

/** Cantidad de empresas similares a sugerir antes de crear una nueva. */
const MAX_SIMILAR_SUGGESTIONS = 3;

interface NewSupplierModalProps {
    isOpen: boolean;
    initialName: string;
    companies: SupplierCompany[];
    onClose: () => void;
    onCreated: (company: SupplierCompany) => void;
    onSelectExisting: (company: SupplierCompany) => void;
    createCompany: (name: string) => Promise<SupplierCompany>;
}

/** Extrae el mensaje de un 409 del backend; para cualquier otro error devuelve null. */
function extractConflictMessage(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
        return null;
    }
    const { response } = error as {
        response?: { status?: number; data?: { message?: string } };
    };
    if (response?.status !== 409) return null;
    return response.data?.message ?? null;
}

export default function NewSupplierModal({
    isOpen,
    initialName,
    companies,
    onClose,
    onCreated,
    onSelectExisting,
    createCompany,
}: NewSupplierModalProps) {
    const [name, setName] = useState(initialName);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setErrorMsg(null);
        }
    }, [isOpen, initialName]);

    const trimmedName = name.trim();
    const normalizedName = normalizeSupplierName(name);

    const similar = useMemo(() => {
        if (!trimmedName) return [];
        return findSimilarCompanies(trimmedName, companies, MAX_SIMILAR_SUGGESTIONS);
    }, [trimmedName, companies]);

    if (!isOpen) return null;

    const isValid = trimmedName.length > 0;

    const handleCreate = async () => {
        if (!isValid) return;
        setIsSaving(true);
        setErrorMsg(null);
        try {
            const company = await createCompany(trimmedName);
            onCreated(company);
            onClose();
        } catch (error: unknown) {
            const conflictMessage = extractConflictMessage(error);
            setErrorMsg(
                conflictMessage ?? 'No se pudo crear el proveedor. Intenta de nuevo.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectExisting = (company: SupplierCompany) => {
        onSelectExisting(company);
        onClose();
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
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 space-y-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-slate-900">Nuevo proveedor</h3>
                    <p className="text-xs text-slate-400 font-medium">
                        Se agrega al catálogo compartido: lo verán todos los usuarios.
                    </p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Nombre de la empresa
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="escriba el nombre de la empresa del proveedor"
                            autoFocus
                            disabled={isSaving}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-medium focus:border-indigo-200 focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        {trimmedName && (
                            <p className="mt-2 text-[11px] text-slate-400 font-medium">
                                Se guardará como: <span className="font-black text-slate-500">{normalizedName}</span>
                            </p>
                        )}
                    </div>

                    {similar.length > 0 && (
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs font-bold text-amber-800">
                                    Estas empresas se parecen. Si es una de ellas, selecciónala en vez de crear una nueva:
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                {similar.map(company => (
                                    <button
                                        key={company.id}
                                        type="button"
                                        onClick={() => handleSelectExisting(company)}
                                        disabled={isSaving}
                                        className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-100/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="text-xs font-black text-slate-700 truncate">{company.name}</span>
                                        {company.nit && (
                                            <span className="text-[11px] text-slate-400 font-medium shrink-0">{company.nit}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                            <p className="text-xs font-bold text-red-600">{errorMsg}</p>
                        </div>
                    )}

                    <div className="flex items-center justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-5 py-2.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!isValid || isSaving}
                            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl shadow-lg shadow-indigo-200 font-black text-[10px] uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                            <span>Crear proveedor</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
