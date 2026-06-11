import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import type { ScenarioPriceWarnings, PriceWarning } from '../../lib/priceValidation';

interface PriceWarningModalProps {
    scenarioWarnings: ScenarioPriceWarnings[];
    onClose: () => void;
}

/** Formatea un número como moneda simple con separador de miles es-CO. */
function formatAmount(value: number, currency: string): string {
    return `${currency} ${value.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
}

/** Texto del motivo según el tipo de hallazgo. */
function reasonText(kind: PriceWarning['kind']): string {
    return kind === 'COP_BELOW_FLOOR'
        ? 'valor muy bajo, verif\u00edcalo'
        : 'valor muy alto, verif\u00edcalo';
}

/**
 * Modal de aviso (no bloqueante) de precios unitarios sospechosos por probable error de moneda.
 * Lista los hallazgos agrupados por escenario; los de COP bajo (graves) van primero y en rojo,
 * los de USD alto (tolerables) después y en ámbar. Un solo botón cierra sin obligar a corregir.
 */
export default function PriceWarningModal({ scenarioWarnings, onClose }: PriceWarningModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Revisa antes de continuar</h3>
                            <p className="text-xs text-slate-500 font-medium">Algunos precios unitarios parecen sospechosos</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all shrink-0"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 max-h-[55vh] overflow-y-auto space-y-5">
                    {scenarioWarnings.map((sw) => (
                        <div key={sw.scenarioId}>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                Escenario: {sw.scenarioName}
                            </p>
                            <div className="space-y-2">
                                {sw.warnings.map((w, idx) => {
                                    const isLow = w.kind === 'COP_BELOW_FLOOR';
                                    return (
                                        <div
                                            key={`${sw.scenarioId}-${idx}`}
                                            className={
                                                isLow
                                                    ? 'rounded-xl border border-red-200 bg-red-50 px-4 py-3'
                                                    : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'
                                            }
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-800">{w.itemName}</span>
                                                <span
                                                    className={
                                                        isLow
                                                            ? 'text-sm font-black text-red-600'
                                                            : 'text-sm font-black text-amber-600'
                                                    }
                                                >
                                                    {formatAmount(w.unitSalePrice, w.currency)}
                                                </span>
                                            </div>
                                            <p
                                                className={
                                                    isLow
                                                        ? 'text-xs font-semibold text-red-600 mt-0.5'
                                                        : 'text-xs font-semibold text-amber-600 mt-0.5'
                                                }
                                            >
                                                {reasonText(w.kind)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black tracking-tight hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30"
                    >
                        Entendido, continuar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
