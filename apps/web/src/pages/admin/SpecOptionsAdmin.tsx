import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
    Settings, Plus, Search, Pencil,
    Trash2, Loader2, ToggleLeft, ToggleRight,
    PackageOpen, X, Download,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
    useSpecOptionsAdmin,
    SPEC_FIELD_NAMES,
    FIELD_NAME_LABELS,
} from '../../hooks/useSpecOptionsAdmin';
import type { SpecOption, SpecFieldName } from '../../hooks/useSpecOptionsAdmin';
import SpecOptionFormModal from './components/SpecOptionFormModal';
import CsvImportSection from './components/CsvImportSection';

// ── Component ────────────────────────────────────────────────

export default function SpecOptionsAdmin() {
    const {
        selectedField, setSelectedField,
        search, setSearch,
        filtered, loading,
        createOption, updateOption,
        toggleActive, removeOption, bulkImport,
        exportToCsv,
        selectedIds, toggleSelect, selectAll,
        clearSelection, bulkDelete, deleteByField,
    } = useSpecOptionsAdmin();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<SpecOption | null>(null);

    // ── Modal handlers ──

    const handleOpenCreate = () => {
        setEditingOption(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (option: SpecOption) => {
        setEditingOption(option);
        setIsModalOpen(true);
    };

    const handleSave = async (fieldName: string, value: string) => {
        if (editingOption) {
            await updateOption(editingOption.id, { value });
        } else {
            await createOption(fieldName, value);
        }
    };

    // ── Delete handlers ──

    const handleDelete = async (option: SpecOption) => {
        const label = FIELD_NAME_LABELS[option.fieldName as SpecFieldName] || option.fieldName;
        if (!window.confirm(`¿Eliminar "${option.value}" del campo ${label}? Esta acción no se puede deshacer.`)) return;
        try {
            await removeOption(option.id);
        } catch (error) {
            console.error('Error deleting option:', error);
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (!window.confirm(`¿Eliminar ${count} opciones? Esta acción no se puede deshacer.`)) return;
        try {
            await bulkDelete(Array.from(selectedIds));
        } catch (error) {
            console.error('Error in bulk delete:', error);
        }
    };

    const handleDeleteByField = async () => {
        if (!selectedField) return;
        const label = FIELD_NAME_LABELS[selectedField];
        if (!window.confirm(`¿Eliminar TODAS las opciones de "${label}"? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteByField(selectedField);
        } catch (error) {
            console.error('Error deleting field options:', error);
        }
    };

    // ── Toggle handler ──

    const handleToggle = async (option: SpecOption) => {
        try {
            await toggleActive(option.id, !option.isActive);
        } catch (error) {
            console.error('Error toggling option:', error);
        }
    };

    // ── Checkbox helpers ──

    const isAllSelected = filtered.length > 0 && filtered.every(o => selectedIds.has(o.id));
    const isSomeSelected = filtered.some(o => selectedIds.has(o.id));

    const handleToggleAll = () => {
        if (isAllSelected) clearSelection();
        else selectAll();
    };

    // ── Loading state ──

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 px-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                        <Settings className="h-8 w-8 mr-3 text-indigo-600" />
                        Catálogo de Opciones
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Gestiona los valores de autocompletado para los campos técnicos.
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <CsvImportSection onBulkImport={bulkImport} selectedField={selectedField} />
                    <button
                        onClick={() => exportToCsv(selectedField || undefined)}
                        className="flex items-center space-x-2 bg-sky-50 hover:bg-sky-100 text-sky-600 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                        <Download className="h-4 w-4" />
                        <span>
                            {selectedField
                                ? `Exportar ${FIELD_NAME_LABELS[selectedField]}`
                                : 'Exportar Todas'}
                        </span>
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Agregar Opción</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center flex-wrap gap-4">
                    <select
                        value={selectedField}
                        onChange={e => setSelectedField(e.target.value as SpecFieldName | '')}
                        className="px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-200 focus:ring-0 min-w-[200px]"
                    >
                        <option value="">Todos los campos</option>
                        {SPEC_FIELD_NAMES.map(fn => (
                            <option key={fn} value={fn}>{FIELD_NAME_LABELS[fn]}</option>
                        ))}
                    </select>

                    {/* Botón "Eliminar todo el campo" — solo visible cuando hay campo seleccionado */}
                    {selectedField && (
                        <button
                            onClick={handleDeleteByField}
                            className="flex items-center space-x-2 px-4 py-3 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar todo el campo</span>
                        </button>
                    )}

                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por valor..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-200 focus:ring-0"
                        />
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
                        {selectedIds.size} opcion{selectedIds.size !== 1 ? 'es' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
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
                        <p className="text-sm font-bold text-slate-400">No se encontraron opciones.</p>
                        <p className="text-xs text-slate-300 mt-2">Prueba ajustando los filtros o agrega una nueva opción.</p>
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
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Campo</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(option => (
                                <OptionRow
                                    key={option.id}
                                    option={option}
                                    isSelected={selectedIds.has(option.id)}
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
                <SpecOptionFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    editingOption={editingOption}
                />
            </AnimatePresence>
        </div>
    );
}

// ── Table row ────────────────────────────────────────────────

function OptionRow({
    option, isSelected, onToggleSelect, onEdit, onToggle, onDelete,
}: {
    option: SpecOption;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onEdit: (o: SpecOption) => void;
    onToggle: (o: SpecOption) => void;
    onDelete: (o: SpecOption) => void;
}) {
    return (
        <tr className={cn(
            "border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors",
            isSelected && "bg-indigo-50/40"
        )}>
            <td className="px-4 py-4 w-10">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(option.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
            </td>
            <td className="px-6 py-4">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">
                    {FIELD_NAME_LABELS[option.fieldName as SpecFieldName] || option.fieldName}
                </span>
            </td>
            <td className="px-6 py-4 font-bold text-slate-700">{option.value}</td>
            <td className="px-6 py-4 text-center">
                <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg",
                    option.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                )}>
                    {option.isActive ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center justify-end space-x-1">
                    <button onClick={() => onEdit(option)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Editar">
                        <Pencil className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onToggle(option)}
                        className={cn(
                            "p-2 rounded-xl transition-colors",
                            option.isActive
                                ? "text-emerald-500 hover:text-amber-500 hover:bg-amber-50"
                                : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                        )}
                        title={option.isActive ? 'Desactivar' : 'Activar'}
                    >
                        {option.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => onDelete(option)} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}
