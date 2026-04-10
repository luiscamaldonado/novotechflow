import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
    Users, Plus, Search, Pencil,
    Trash2, Loader2, ToggleLeft, ToggleRight,
    PackageOpen, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useClientsAdmin } from '../../hooks/useClientsAdmin';
import type { Client } from '../../hooks/useClientsAdmin';
import ClientFormModal from './components/ClientFormModal';
import ClientCsvImport from './components/ClientCsvImport';

// ── Component ────────────────────────────────────────────────

export default function ClientsAdmin() {
    const {
        search, setSearch,
        filtered, loading,
        createClient, updateClient,
        toggleActive, removeClient, bulkImport,
        selectedIds, toggleSelect, selectAll,
        clearSelection, bulkDelete,
    } = useClientsAdmin();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // ── Modal handlers ──

    const handleOpenCreate = () => { setEditingClient(null); setIsModalOpen(true); };
    const handleOpenEdit = (client: Client) => { setEditingClient(client); setIsModalOpen(true); };

    const handleSave = async (name: string) => {
        if (editingClient) {
            await updateClient(editingClient.id, name);
        } else {
            await createClient(name);
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (client: Client) => {
        if (!window.confirm(`¿Eliminar el cliente "${client.name}"? Esta acción no se puede deshacer.`)) return;
        try { await removeClient(client.id); } catch (error) { console.error('Error deleting client:', error); }
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (!window.confirm(`¿Eliminar ${count} clientes? Esta acción no se puede deshacer.`)) return;
        try {
            await bulkDelete(Array.from(selectedIds));
        } catch (error) {
            console.error('Error in bulk delete:', error);
        }
    };

    const handleToggle = async (client: Client) => {
        try { await toggleActive(client.id, !client.isActive); } catch (error) { console.error('Error toggling client:', error); }
    };

    // ── Checkbox helpers ──

    const isAllSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
    const isSomeSelected = filtered.some(c => selectedIds.has(c.id));

    const handleToggleAll = () => {
        if (isAllSelected) clearSelection();
        else selectAll();
    };

    // ── Loading state ──

    if (loading) {
        return (<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-indigo-600 animate-spin" /></div>);
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 px-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                        <Users className="h-8 w-8 mr-3 text-indigo-600" />
                        Gestión de Clientes
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Administra la lista de clientes para autocompletado.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <ClientCsvImport onBulkImport={bulkImport} />
                    <button onClick={handleOpenCreate} className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all font-black text-[10px] uppercase tracking-widest">
                        <Plus className="h-4 w-4" /><span>Agregar Cliente</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-200 focus:ring-0" />
                    </div>
                    <span className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest">
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-6 py-4">
                    <span className="text-sm font-bold text-indigo-700">
                        {selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={clearSelection}
                            className="flex items-center space-x-1 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                            <span>Deseleccionar</span>
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-sm"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar seleccionados</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center">
                        <PackageOpen className="h-16 w-16 mx-auto text-slate-100 mb-4" />
                        <p className="text-sm font-bold text-slate-400">No se encontraron clientes.</p>
                        <p className="text-xs text-slate-300 mt-2">Prueba ajustando los filtros o agrega un nuevo cliente.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-4 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={el => { if (el) el.indeterminate = isSomeSelected && !isAllSelected; }}
                                        onChange={handleToggleAll}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha creación</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(client => (
                                <ClientRow
                                    key={client.id}
                                    client={client}
                                    isSelected={selectedIds.has(client.id)}
                                    onToggleSelect={toggleSelect}
                                    onEdit={handleOpenEdit}
                                    onToggle={handleToggle}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && <ClientFormModal onClose={() => setIsModalOpen(false)} onSave={handleSave} editingClient={editingClient} />}
            </AnimatePresence>
        </div>
    );
}

// ── Table row ────────────────────────────────────────────────

function ClientRow({ client, isSelected, onToggleSelect, onEdit, onToggle, onDelete }: {
    client: Client;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onEdit: (c: Client) => void;
    onToggle: (c: Client) => void;
    onDelete: (c: Client) => void;
}) {
    const createdDate = new Date(client.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <tr className={cn(
            "border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors",
            isSelected && "bg-indigo-50/40"
        )}>
            <td className="px-4 py-4 w-10">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(client.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
            </td>
            <td className="px-6 py-4 font-bold text-slate-700">{client.name}</td>
            <td className="px-6 py-4 text-center">
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg", client.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                    {client.isActive ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td className="px-6 py-4 text-slate-500 text-xs font-medium">{createdDate}</td>
            <td className="px-6 py-4">
                <div className="flex items-center justify-end space-x-1">
                    <button onClick={() => onEdit(client)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Editar">
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => onToggle(client)}
                        className={cn("p-2 rounded-xl transition-colors", client.isActive ? "text-emerald-500 hover:text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50")}
                        title={client.isActive ? 'Desactivar' : 'Activar'}>
                        {client.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => onDelete(client)} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}
