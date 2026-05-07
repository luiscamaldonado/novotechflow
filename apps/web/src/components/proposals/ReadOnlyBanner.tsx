import { Lock } from 'lucide-react';

/**
 * Banner de aviso para versiones históricas bloqueadas.
 * Sin lógica condicional interna: si se renderiza, se muestra.
 * El padre decide cuándo mostrarlo.
 */
export default function ReadOnlyBanner() {
    return (
        <div className="flex items-center space-x-3 bg-amber-50 border-2 border-amber-200 text-amber-800 px-6 py-4 rounded-2xl shadow-sm">
            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm font-bold leading-snug">
                Esta es una versión histórica bloqueada. Solo la última versión es editable.
                Para continuar editando, clónala como nueva versión.
            </p>
        </div>
    );
}
