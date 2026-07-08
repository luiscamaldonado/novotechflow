import { motion } from 'framer-motion';
import { AlertCircle, Building2 } from 'lucide-react';
import type { ConflictRecord } from '../../lib/types';

interface ConflictPanelProps {
    isClientEmpty: boolean;
    hasNoConflicts: boolean;
    conflicts: ConflictRecord[];
}

/**
 * Panel lateral que muestra propuestas previas para detectar cruces de cuenta.
 *
 * @param {boolean} isClientEmpty - Si el campo de cliente está vacío.
 * @param {boolean} hasNoConflicts - Si no se encontraron propuestas relacionadas.
 * @param {ConflictRecord[]} conflicts - Lista de propuestas candidatas a cruce.
 */
export default function ConflictPanel({
    isClientEmpty,
    hasNoConflicts,
    conflicts,
}: ConflictPanelProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-1 h-fit"
        >
            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                    <AlertCircle className="h-5 w-5" />
                    <h3 className="text-sm font-bold tracking-wide uppercase">Cruce de Cuentas</h3>
                </div>
                <p className="text-gray-500 text-xs">
                    Oportunidades creadas para este cliente en el último año.
                </p>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {isClientEmpty ? (
                    <div className="text-center py-10 px-4 text-gray-400 text-sm">
                        Escribe el nombre del cliente para buscar proyectos previos y evitar cruces con otros comerciales.
                    </div>
                ) : hasNoConflicts ? (
                    <div className="text-center py-10 px-4">
                        <span className="inline-flex items-center justify-center p-3 bg-green-50 rounded-full mb-3 text-green-600">
                            <Building2 className="h-6 w-6" />
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900">Cliente Libre</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Nadie del equipo ha cotizado a este cliente en el último año.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {conflicts.map((item) => (
                            <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-sm">
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
                                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
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
                )}
            </div>
        </motion.div>
    );
}
