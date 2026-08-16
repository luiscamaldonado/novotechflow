import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Building2 } from 'lucide-react';
import type { ConflictSearchState } from '../../lib/types';

interface ConflictPanelProps {
    state: ConflictSearchState;
}

/**
 * Panel lateral que muestra propuestas previas para detectar cruces de cuenta.
 *
 * @param {ConflictSearchState} state - Estado derivado de la búsqueda de cruces.
 */
export default function ConflictPanel({ state }: ConflictPanelProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden lg:col-span-1 h-fit"
        >
            <div className="bg-linear-to-br from-indigo-50 to-white p-6 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                    <AlertCircle className="h-5 w-5" />
                    <h3 className="text-sm font-bold tracking-wide uppercase">Cruce de Cuentas</h3>
                </div>
                <p className="text-gray-500 text-xs">
                    Oportunidades creadas para este cliente en el último año.
                </p>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                <PanelBody state={state} />
            </div>
        </motion.div>
    );
}

/** Cuerpo del panel según el estado de la búsqueda. */
function PanelBody({ state }: { state: ConflictSearchState }) {
    switch (state.status) {
        case 'idle':
            return (
                <div className="text-center py-10 px-4 text-gray-400 text-sm">
                    Escribe el nombre del cliente para buscar proyectos previos y evitar cruces con otros comerciales.
                </div>
            );
        case 'searching':
            return (
                <div className="text-center py-10 px-4 text-gray-400 text-sm">
                    Buscando propuestas previas...
                </div>
            );
        case 'ready':
            if (state.conflicts.length === 0) {
                return (
                    <div className="text-center py-10 px-4">
                        <span className="inline-flex items-center justify-center p-3 bg-green-50 rounded-full mb-3 text-green-600">
                            <Building2 className="h-6 w-6" />
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900">Cliente Libre</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Nadie del equipo ha cotizado a este cliente en el último año.
                        </p>
                    </div>
                );
            }
            return (
                <div className="space-y-3">
                    {state.conflicts.map((item) => (
                        <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                            <div className="text-xs flex items-center text-gray-500 mb-1.5">
                                <span className="font-medium mr-1">Cliente:</span>
                                <span className="font-semibold text-gray-900">{item.clientName}</span>
                            </div>
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-gray-900">{item.proposalCode}</span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                    {new Date(item.issueDate).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-gray-600 text-xs mb-2 line-clamp-2">{item.subject}</p>
                            <div className="flex flex-col space-y-1 mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs flex items-center text-gray-500">
                                    <span className="font-medium mr-1">Comercial:</span>
                                    <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-bold tracking-wider">
                                        {item.user?.name || 'Desconocido'}
                                    </span>
                                </div>
                                <div className="text-xs flex items-center text-gray-500">
                                    <span className="font-medium mr-1">Estado:</span>
                                    {item.status} ({item.validityDays} días)
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        case 'failed':
            return (
                <div className="text-center py-10 px-4">
                    <span className="inline-flex items-center justify-center p-3 bg-amber-50 rounded-full mb-3 text-amber-600">
                        <AlertTriangle className="h-6 w-6" />
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900">No se pudo verificar el cruce</h4>
                    <p className="text-xs text-gray-500 mt-1">
                        Revisa tu conexión e intenta de nuevo.
                    </p>
                </div>
            );
    }
}
