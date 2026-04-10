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

// ── Hook ─────────────────────────────────────────────────────

export function useSpecOptionsAdmin() {
    const [options, setOptions] = useState<SpecOption[]>([]);
    const [selectedField, setSelectedField] = useState<SpecFieldName | ''>('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

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
    };

    const bulkImport = async (items: Array<{ fieldName: string; value: string }>): Promise<BulkImportResult> => {
        const res = await api.post('/admin/spec-options/bulk', { items });
        await fetchOptions();
        return res.data as BulkImportResult;
    };

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
    };
}
