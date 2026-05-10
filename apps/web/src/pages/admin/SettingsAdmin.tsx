import { useState, useEffect } from 'react';
import { Settings, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

/** Mínimo de minutos permitido para inactividad (espejo del backend). */
const MIN_INACTIVITY_MINUTES = 2;
/** Máximo de minutos permitido para inactividad (espejo del backend). */
const MAX_INACTIVITY_MINUTES = 60;

/** Valida que el string represente un entero dentro del rango [MIN, MAX]. */
function isValidValue(s: string): boolean {
    const n = Number(s);
    return Number.isInteger(n) && n >= MIN_INACTIVITY_MINUTES && n <= MAX_INACTIVITY_MINUTES;
}

export default function SettingsAdmin() {
    const [initialValue, setInitialValue] = useState<number | null>(null);
    const [value, setValue] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const loadSetting = async () => {
            try {
                const { data } = await api.get<{ minutes: number }>('/app-settings/inactivity-timeout');
                setInitialValue(data.minutes);
                setValue(String(data.minutes));
            } catch {
                setErrorMsg('No se pudo cargar la configuraci\u00f3n. Intenta recargar la p\u00e1gina.');
            } finally {
                setIsLoading(false);
            }
        };
        loadSetting();
    }, []);

    const isChanged = initialValue !== null && Number(value) !== initialValue;
    const isValid = isValidValue(value);
    const isSaveDisabled = isSaving || !isValid || !isChanged;

    const handleSave = async () => {
        setErrorMsg(null);
        setIsSaving(true);
        try {
            await api.patch('/app-settings/inactivity-timeout', { minutes: Number(value) });
            setInitialValue(Number(value));
            setSavedMsg(true);
            setTimeout(() => setSavedMsg(false), 2500);
            useAuthStore.getState().loadInactivityTimeout();
        } catch (err: unknown) {
            const fallback = 'Error al guardar. Intenta de nuevo.';
            if (err && typeof err === 'object' && 'response' in err) {
                const resp = (err as { response?: { data?: { message?: string } } }).response;
                setErrorMsg(resp?.data?.message ?? fallback);
            } else {
                setErrorMsg(fallback);
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 px-4 pb-20">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                    <Settings className="h-8 w-8 mr-3 text-indigo-600" />
                    Configuraci&oacute;n del sistema
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-1">
                    Ajustes globales de NovoTechFlow.
                </p>
            </div>

            {/* Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
                {/* Secci&oacute;n: Sesi&oacute;n */}
                <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                        Sesi&oacute;n
                    </h3>

                    <div className="space-y-2">
                        <label
                            htmlFor="inactivity-timeout"
                            className="block text-sm font-bold text-slate-700"
                        >
                            Tiempo de inactividad antes del cierre de sesi&oacute;n
                        </label>

                        <div className="flex items-center space-x-3">
                            <input
                                id="inactivity-timeout"
                                type="number"
                                min={MIN_INACTIVITY_MINUTES}
                                max={MAX_INACTIVITY_MINUTES}
                                value={value}
                                onChange={e => {
                                    setValue(e.target.value);
                                    setErrorMsg(null);
                                }}
                                className="w-28 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-200 focus:ring-0"
                            />
                            <span className="text-sm font-medium text-slate-400">min</span>
                        </div>

                        <p className="text-xs text-slate-400">
                            Entre {MIN_INACTIVITY_MINUTES} y {MAX_INACTIVITY_MINUTES} minutos.
                            El usuario ver&aacute; un aviso 60 segundos antes.
                        </p>
                    </div>

                    {/* Inline validation error */}
                    {value !== '' && !isValid && (
                        <p className="mt-2 text-xs font-bold text-red-500">
                            Ingresa un n&uacute;mero entero entre {MIN_INACTIVITY_MINUTES} y {MAX_INACTIVITY_MINUTES}.
                        </p>
                    )}

                    {/* API error */}
                    {errorMsg && (
                        <p className="mt-2 text-xs font-bold text-red-500">
                            {errorMsg}
                        </p>
                    )}

                    {/* Saved message */}
                    {savedMsg && (
                        <div className="mt-2 flex items-center space-x-2 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Guardado</span>
                        </div>
                    )}

                    {/* Save button */}
                    <div className="mt-6">
                        <button
                            onClick={handleSave}
                            disabled={isSaveDisabled}
                            className={
                                isSaveDisabled
                                    ? 'px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : 'px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all'
                            }
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
