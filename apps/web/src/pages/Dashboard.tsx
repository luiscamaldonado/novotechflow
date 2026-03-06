import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, PlusCircle, Trash2, Edit2, Loader2, Calendar, DollarSign, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProposals();
    }, []);

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error("Error eliminando propuesta:", error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 text-novo-primary animate-spin" />
            </div>
        );
    }

    const actives = proposals.filter(p => p.status !== 'ARCHIVED').length;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {user?.role === 'ADMIN' ? 'Resumen Global de Actividad' : 'Mis Propuestas'}
                    </h2>
                    <p className="text-gray-500">
                        {user?.role === 'ADMIN' ? 'Métricas y propuestas recientes de todo el equipo comercial.' : 'Gestiona tus cotizaciones recientes y cierres.'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/proposals/new')}
                    className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-novo-primary/30"
                >
                    <PlusCircle className="h-5 w-5" />
                    <span>Nueva Propuesta</span>
                </button>
            </div>

            {/* Widgets Rápidos */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                        <FileText className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Propuestas Activas</p>
                        <p className="text-2xl font-bold text-gray-900">{actives}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Ratio de Cierre</p>
                        <p className="text-2xl font-bold text-gray-900">En Calculo</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                        <Clock className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Histórico Total</p>
                        <p className="text-2xl font-bold text-gray-900">{proposals.length}</p>
                    </div>
                </div>
            </div>

            {/* Tabla Principal */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900">Listado de Propuestas</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Código</th>
                                <th className="px-6 py-4">Cliente / Asunto</th>
                                {user?.role === 'ADMIN' && <th className="px-6 py-4 text-center">Asesor</th>}
                                <th className="px-6 py-4 text-center">Fecha y Validez</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {proposals.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 6 : 5} className="px-6 py-16 text-center text-gray-500">
                                        No hay propuestas registradas aún.
                                    </td>
                                </tr>
                            ) : (
                                proposals.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-bold text-novo-primary">
                                            {p.proposalCode}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-gray-900">{p.clientName}</p>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-1" title={p.subject}>{p.subject}</p>
                                        </td>
                                        {user?.role === 'ADMIN' && (
                                            <td className="px-6 py-4 text-center text-xs font-semibold uppercase text-indigo-700">
                                                <span className="bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                                                    {p.user?.nomenclature || 'XX'} - {p.user?.name?.split(' ')[0]}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center text-xs">
                                                <div className="flex items-center text-gray-700">
                                                    <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                                                    {new Date(p.issueDate).toLocaleDateString()}
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1">{p.validityDays} días validez</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 text-[10px] font-bold tracking-wider rounded-full uppercase
                                                ${p.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : ''}
                                                ${p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : ''}
                                                ${p.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-600' : ''}
                                            `}>
                                                {p.status === 'DRAFT' && 'Borrador'}
                                                {p.status === 'COMPLETED' && 'Lista'}
                                                {p.status === 'ARCHIVED' && 'Archivada'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <button
                                                    onClick={() => navigate(`/proposals/${p.id}/builder`)}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded bg-white hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all shadow-sm"
                                                    title="Editar Cotización"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(p.id, p.proposalCode)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded bg-white hover:bg-red-50 border border-transparent hover:border-red-100 transition-all shadow-sm"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
