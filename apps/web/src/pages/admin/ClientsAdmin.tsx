import { Users } from 'lucide-react';

export default function ClientsAdmin() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-600" />
                Gestión de Clientes
            </h1>
            <p className="text-slate-500 mt-2">Próximamente...</p>
        </div>
    );
}
