import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { usePriceThresholds } from '../../../hooks/usePriceThresholds';

/** Rango permitido para el piso COP (espejo del backend). */
const MIN_COP = 1;
const MAX_COP = 10000000;
/** Rango permitido para el techo USD (espejo del backend). */
const MIN_USD = 1;
const MAX_USD = 100000000;

/** Valida que el string represente un entero dentro del rango [min, max]. */
function isValidInt(s: string, min: number, max: number): boolean {
    const n = Number(s);
    return Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Sección de configuración de los umbrales de validación de precio unitario.
 * Reusa el hook usePriceThresholds (lectura + actualización); el estado de edición es local.
 */
export default function PriceThresholdsSettings() {
    const { thresholds, isLoading, update } = usePriceThresholds();
    const [copValue, setCopValue] = useState('');
    const [usdValue, setUsdValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (isLoading) return;
        if (initializedRef.current) return;
        initializedRef.current = true;
        setCopValue(String(thresholds.copMinUnitPrice));
        setUsdValue(String(thresholds.usdMaxUnitPrice));
    }, [isLoading, thresholds]);

    const copValid = isValidInt(copValue, MIN_COP, MAX_COP);
    const usdValid = isValidInt(usdValue, MIN_USD, MAX_USD);
    const isChanged =
        copValue !== String(thresholds.copMinUnitPrice) ||
        usdValue !== String(thresholds.usdMaxUnitPrice);
    const isSaveDisabled = isSaving || !copValid || !usdValid || !isChanged;

    const handleSave = async () => {
        setErrorMsg(null);
        setIsSaving(true);
        try {
            await update({
                copMinUnitPrice: Number(copValue),
                usdMaxUnitPrice: Number(usdValue),
            });
            setSavedMsg(true);
            setTimeout(() => setSavedMsg(false), 2500);
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
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                Validación de precios
            </h3>

            <p className="text-sm text-slate-500 font-medium mb-5">
                Al entrar a la construcción del documento, el sistema avisa si algún precio unitario
                parece sospechoso por un posible error de moneda. No bloquea; solo alerta.
            </p>

            <div className="space-y-5">
                {/* Piso COP */}
                <div className="space-y-2">
                    <label htmlFor="cop-min-price" className="block text-sm font-bold text-slate-700">
                        Piso mínimo de precio unitario (COP)
                    </label>
                    <div className="flex items-center space-x-3">
                        <input
                            id="cop-min-price"
                            type="number"
                            min={MIN_COP}
                            max={MAX_COP}
                            value={copValue}
                            onChange={e => {
                                setCopValue(e.target.value);
                                setErrorMsg(null);
                            }}
                            className="w-40 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-200 focus:ring-0"
                        />
                        <span className="text-sm font-medium text-slate-400">COP</span>
                    </div>
                    <p className="text-xs text-slate-400">
                        Avisa cuando un ítem en un escenario en COP tiene un precio unitario por debajo
                        de este valor. Entre {MIN_COP} y {MAX_COP.toLocaleString('es-CO')}.
                    </p>
                    {copValue !== '' && !copValid && (
                        <p className="text-xs font-bold text-red-500">
                            Ingresa un número entero entre {MIN_COP} y {MAX_COP.toLocaleString('es-CO')}.
                        </p>
                    )}
                </div>

                {/* Techo USD */}
                <div className="space-y-2">
                    <label htmlFor="usd-max-price" className="block text-sm font-bold text-slate-700">
                        Techo máximo de precio unitario (USD)
                    </label>
                    <div className="flex items-center space-x-3">
                        <input
                            id="usd-max-price"
                            type="number"
                            min={MIN_USD}
                            max={MAX_USD}
                            value={usdValue}
                            onChange={e => {
                                setUsdValue(e.target.value);
                                setErrorMsg(null);
                            }}
                            className="w-40 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-200 focus:ring-0"
                        />
                        <span className="text-sm font-medium text-slate-400">USD</span>
                    </div>
                    <p className="text-xs text-slate-400">
                        Avisa cuando un ítem en un escenario en USD tiene un precio unitario por encima
                        de este valor. Entre {MIN_USD} y {MAX_USD.toLocaleString('es-CO')}.
                    </p>
                    {usdValue !== '' && !usdValid && (
                        <p className="text-xs font-bold text-red-500">
                            Ingresa un número entero entre {MIN_USD} y {MAX_USD.toLocaleString('es-CO')}.
                        </p>
                    )}
                </div>
            </div>

            {/* API error */}
            {errorMsg && (
                <p className="mt-4 text-xs font-bold text-red-500">
                    {errorMsg}
                </p>
            )}

            {/* Saved message */}
            {savedMsg && (
                <div className="mt-4 flex items-center space-x-2 text-emerald-600">
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
    );
}
