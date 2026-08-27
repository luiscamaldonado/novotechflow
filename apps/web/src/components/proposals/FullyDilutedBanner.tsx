import { AlertTriangle } from 'lucide-react';
import { roundMoney } from '@repo/pricing-engine';
import { formatMoney } from '../../lib/constants';

interface FullyDilutedBannerProps {
    /** Costo diluido total del escenario, sin redondear. */
    dilutedCost: number;
    /** Moneda del escenario, para el redondeo y el formato (ADR-113). */
    currency: string;
}

/**
 * Banner de escenario 100% diluido (ADR-117, B3): todo el costo vive en ítems
 * diluidos y no queda base normal que lo absorba, así que la cotización sale en
 * $0 y el costo se pierde por completo.
 *
 * Sin lógica condicional interna: si se renderiza, se muestra — el padre decide
 * cuándo. Sin latch ni dismiss: el estado es corregible y el banner desaparece
 * solo al corregirlo.
 */
export default function FullyDilutedBanner({ dilutedCost, currency }: FullyDilutedBannerProps) {
    return (
        <div
            role="alert"
            className="flex items-start space-x-3 bg-red-50 border border-red-300 text-red-700 px-6 py-4 rounded-2xl shadow-xs"
        >
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-tight">Escenario 100% diluido</p>
                <p className="text-sm font-bold leading-snug">
                    El costo diluido de {formatMoney(roundMoney(dilutedCost, currency), currency)} no tiene
                    ítems visibles que lo absorban: la cotización sale en $0 y el costo se pierde por completo.
                </p>
            </div>
        </div>
    );
}
