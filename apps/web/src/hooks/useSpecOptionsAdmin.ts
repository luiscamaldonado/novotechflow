import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────

export interface SpecOption {
    id: string;
    fieldName: string;
    value: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BulkImportResult {
    created: number;
    duplicates: number;
}

/** The 17 valid fieldName values for the SpecOption model. */
export const SPEC_FIELD_NAMES = [
    'fabricante',
    'formato',
    'modelo',
    'procesador',
    'sistemaOperativo',
    'graficos',
    'memoriaRam',
    'almacenamiento',
    'pantalla',
    'network',
    'seguridad',
    'garantia',
    'tipo',
    'tipoServicio',
    'tipoSoftware',
    'unidadMedida',
    'cliente',
] as const;

export type SpecFieldName = typeof SPEC_FIELD_NAMES[number];

/** Human-readable labels for each fieldName. */
export const FIELD_NAME_LABELS: Record<SpecFieldName, string> = {
    fabricante: 'Fabricante',
    formato: 'Formato',
    modelo: 'Modelo',
    procesador: 'Procesador',
    sistemaOperativo: 'Sistema Operativo',
    graficos: 'Gráficos',
    memoriaRam: 'Memoria RAM',
    almacenamiento: 'Almacenamiento',
    pantalla: 'Pantalla',
    network: 'Red / Network',
    seguridad: 'Seguridad',
    garantia: 'Garantía',
    tipo: 'Tipo',
    tipoServicio: 'Tipo de Servicio',
    tipoSoftware: 'Tipo de Software',
    unidadMedida: 'Unidad de Medida',
    cliente: 'Cliente',
};

// ── Download helper ──────────────────────────────────────────

/** Creates a CSV Blob, triggers a browser download via temp anchor, and cleans up. */
function downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

// ── Hook ─────────────────────────────────────────────────────

export function useSpecOptionsAdmin() {
    const [options, setOptions] = useState<SpecOption[]>([]);
    const [selectedField, setSelectedField] = useState<SpecFieldName | ''>('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchOptions = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, string> = { includeInactive: 'true' };
            if (selectedField) params.fieldName = selectedField;
            const res = await api.get('/admin/spec-options', { params });
            setOptions(res.data);
        } catch (error) {
            console.error('Error loading spec options:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedField]);

    /* Fetch only when a specific field is selected; clear data when deselected. */
    useEffect(() => {
        if (selectedField) {
            fetchOptions();
        } else {
            setOptions([]);
            setSelectedIds(new Set());
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedField]);

    /** Filtered + sorted list (fieldName filter + text search over value). */
    const filtered = useMemo(() => {
        let result = options;

        if (selectedField) {
            result = result.filter(o => o.fieldName === selectedField);
        }

        if (search) {
            const term = search.toLowerCase();
            result = result.filter(o => o.value.toLowerCase().includes(term));
        }

        return result.sort((a, b) => {
            const fieldCmp = a.fieldName.localeCompare(b.fieldName);
            if (fieldCmp !== 0) return fieldCmp;
            return a.value.localeCompare(b.value);
        });
    }, [options, selectedField, search]);

    // ── Selection actions ──

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(filtered.map(o => o.id)));
    }, [filtered]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    // ── CRUD actions ──

    const createOption = async (fieldName: string, value: string): Promise<void> => {
        const res = await api.post('/admin/spec-options', { fieldName, value });
        setOptions(prev => [...prev, res.data]);
    };

    const updateOption = async (id: string, data: { value?: string; isActive?: boolean }): Promise<void> => {
        const res = await api.patch(`/admin/spec-options/${id}`, data);
        setOptions(prev => prev.map(o => (o.id === id ? { ...o, ...res.data } : o)));
    };

    const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
        await updateOption(id, { isActive });
    };

    const removeOption = async (id: string): Promise<void> => {
        await api.delete(`/admin/spec-options/${id}`);
        setOptions(prev => prev.filter(o => o.id !== id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const bulkDelete = async (ids: string[]): Promise<{ deleted: number }> => {
        const res = await api.post('/admin/spec-options/bulk-delete', { ids });
        setOptions(prev => prev.filter(o => !ids.includes(o.id)));
        setSelectedIds(new Set());
        return res.data as { deleted: number };
    };

    const deleteByField = async (fieldName: string): Promise<{ deleted: number }> => {
        const res = await api.delete(`/admin/spec-options/by-field/${fieldName}`);
        setOptions(prev => prev.filter(o => o.fieldName !== fieldName));
        setSelectedIds(new Set());
        return res.data as { deleted: number };
    };

    const bulkImport = async (items: Array<{ fieldName: string; value: string }>): Promise<BulkImportResult> => {
        const res = await api.post('/admin/spec-options/bulk', { items });
        await fetchOptions();
        return res.data as BulkImportResult;
    };

    /**
     * Exports options as CSV and triggers a browser download.
     * - If `fieldName` is provided → single-column CSV (values only, no header).
     * - If `fieldName` is undefined → two-column CSV with `fieldName,value` header.
     */
    const exportToCsv = useCallback((fieldName?: SpecFieldName) => {
        const today = new Date().toISOString().slice(0, 10);

        if (fieldName) {
            const rows = options
                .filter(o => o.fieldName === fieldName)
                .sort((a, b) => a.value.localeCompare(b.value))
                .map(o => o.value);

            downloadCsv(rows.join('\n'), `opciones_${fieldName}_${today}.csv`);
        } else {
            const rows = options
                .sort((a, b) => {
                    const fc = a.fieldName.localeCompare(b.fieldName);
                    return fc !== 0 ? fc : a.value.localeCompare(b.value);
                })
                .map(o => `${o.fieldName},${o.value}`);

            downloadCsv(['fieldName,value', ...rows].join('\n'), `opciones_todas_${today}.csv`);
        }
    }, [options]);

    return {
        options,
        selectedField,
        setSelectedField,
        search,
        setSearch,
        filtered,
        loading,
        fetchOptions,
        createOption,
        updateOption,
        toggleActive,
        removeOption,
        bulkImport,
        exportToCsv,
        selectedIds,
        toggleSelect,
        selectAll,
        clearSelection,
        bulkDelete,
        deleteByField,
    };
}
