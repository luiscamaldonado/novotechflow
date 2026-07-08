import { useState } from 'react';
import { Search } from 'lucide-react';
import { useAccountConflicts } from '../../hooks/useAccountConflicts';
import ConflictPanel from '../../components/proposals/ConflictPanel';

/**
 * Herramienta suelta de "Cruce de Cuentas": permite consultar si un cliente ya
 * está siendo trabajado por el equipo, sin entrar al flujo de creación de
 * propuesta. Reutiliza el hook y el panel del Paso 1 de NewProposal.
 */
export default function AccountCrossCheck() {
    const [clientName, setClientName] = useState('');
    const { conflicts, isClientEmpty, hasNoConflicts } = useAccountConflicts(clientName);

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-novo-primary">Cruce de Cuentas</h2>
                <p className="text-gray-500 text-sm mt-1">
                    Consulta si un cliente ya está siendo trabajado por el equipo, sin crear una propuesta.
                </p>
            </div>

            {/* Buscador de cliente */}
            <div className="space-y-2 relative">
                <label className="text-sm font-medium text-gray-700 ml-1">Nombre del cliente</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="Escribe el nombre del cliente..."
                        className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-inner"
                    />
                </div>
            </div>

            {/* Panel de resultados */}
            <ConflictPanel
                isClientEmpty={isClientEmpty}
                hasNoConflicts={hasNoConflicts}
                conflicts={conflicts}
            />
        </div>
    );
}
