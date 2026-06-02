import { useState, useEffect, useRef } from 'react';
import { Megaphone, Loader2, Check } from 'lucide-react';
import { useMaintenanceBanner } from '../../../hooks/useMaintenanceBanner';

/** Largo máximo del mensaje del banner (espejo del DTO backend @MaxLength(500)). */
const BANNER_MESSAGE_MAX_LENGTH = 500;

/** Tiempo (ms) que se muestra el aviso de guardado. */
const SAVED_FEEDBACK_MS = 2500;

/**
 * Control (solo admin) para redactar, activar y desactivar el banner de
 * mantenimiento. El gating de admin lo hace el componente padre (Dashboard).
 */
export default function MaintenanceBannerControl() {
  const { banner, update } = useMaintenanceBanner();

  const [message, setMessage] = useState('');
  const [active, setActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasHydrated = useRef(false);

  useEffect(() => {
    if (banner && !hasHydrated.current) {
      setMessage(banner.message);
      setActive(banner.active);
      hasHydrated.current = true;
    }
  }, [banner]);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await update(message, active);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), SAVED_FEEDBACK_MS);
    } catch {
      setErrorMsg('No se pudo guardar el banner. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-50">
          <Megaphone className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Banner de mantenimiento</h3>
          <p className="text-xs text-gray-500">Aviso visible para todo el equipo</p>
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={BANNER_MESSAGE_MAX_LENGTH}
        rows={2}
        placeholder="Ej: Actualización programada hoy 8:00 p. m. Guarden su trabajo."
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
      />

      <div className="flex items-center justify-between mt-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-700">Mostrar banner</span>
        </label>

        <div className="flex items-center gap-3">
          {savedMsg && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Guardado
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar
          </button>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-600 mt-2">{errorMsg}</p>}
    </div>
  );
}
