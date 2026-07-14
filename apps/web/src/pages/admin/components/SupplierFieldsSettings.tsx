import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSupplierFieldRequirements } from '../../../hooks/useSupplierFieldRequirements';
import type { SupplierFieldRequirements } from '../../../lib/types';

interface ToggleRowProps {
    label: string;
    description: string;
    checked: boolean;
    isSaving: boolean;
    disabled: boolean;
    onChange: (next: boolean) => void;
}

function ToggleRow({ label, description, checked, isSaving, disabled, onChange }: ToggleRowProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{description}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 pt-1">
                {isSaving && <Loader2 className="h-3 w-3 text-indigo-600 animate-spin" />}
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={e => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </label>
        </div>
    );
}

/**
 * Sección de configuración de la obligatoriedad de los campos de proveedor.
 * Reusa el hook useSupplierFieldRequirements; el guardado es inmediato al togglear.
 */
export default function SupplierFieldsSettings() {
    const { requirements, isLoading, update } = useSupplierFieldRequirements();
    const [savingKey, setSavingKey] = useState<keyof SupplierFieldRequirements | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleToggle = async (key: keyof SupplierFieldRequirements, next: boolean) => {
        setErrorMsg(null);
        setSavingKey(key);
        try {
            await update({ [key]: next });
        } catch (err: unknown) {
            const fallback = 'Error al guardar. Intenta de nuevo.';
            if (err && typeof err === 'object' && 'response' in err) {
                const resp = (err as { response?: { data?: { message?: string } } }).response;
                setErrorMsg(resp?.data?.message ?? fallback);
            } else {
                setErrorMsg(fallback);
            }
        } finally {
            setSavingKey(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                Campos de proveedor
            </h3>

            <p className="text-sm text-slate-500 font-medium mb-5">
                Controla qué campos del contacto del proveedor son obligatorios en el constructor de
                propuestas. Apagar uno reduce fricción, pero deja la base de proveedores incompleta.
                La empresa proveedora es siempre obligatoria y no se puede desactivar.
            </p>

            <div className="space-y-5">
                <ToggleRow
                    label="Contacto obligatorio"
                    description="Exige seleccionar un contacto del proveedor al crear un ítem nuevo."
                    checked={requirements.nameRequired}
                    isSaving={savingKey === 'nameRequired'}
                    disabled={savingKey !== null}
                    onChange={next => handleToggle('nameRequired', next)}
                />
                <ToggleRow
                    label="Teléfono obligatorio"
                    description="Exige el teléfono al registrar un contacto nuevo."
                    checked={requirements.phoneRequired}
                    isSaving={savingKey === 'phoneRequired'}
                    disabled={savingKey !== null}
                    onChange={next => handleToggle('phoneRequired', next)}
                />
                <ToggleRow
                    label="Correo obligatorio"
                    description="Exige el correo al registrar un contacto nuevo."
                    checked={requirements.emailRequired}
                    isSaving={savingKey === 'emailRequired'}
                    disabled={savingKey !== null}
                    onChange={next => handleToggle('emailRequired', next)}
                />
            </div>

            {errorMsg && (
                <p className="mt-4 text-xs font-bold text-red-500">
                    {errorMsg}
                </p>
            )}
        </div>
    );
}
