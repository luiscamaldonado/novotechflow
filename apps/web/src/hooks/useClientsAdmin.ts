import { useState, useMemo, useCallback } from 'react';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────

export interface Client {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ClientBulkImportResult {
    created: number;
    duplicates: number;
}

interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

interface PaginatedResponse {
    data: Client[];
    meta: PaginationMeta;
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50;

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

export function useClientsAdmin() {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);

    /**
     * Fetches clients from the server with optional search query and pagination.
     * Called on-demand: after debounced search (≥2 chars) or "Cargar todos".
     */
    const fetchClients = useCallback(async (query?: string, targetPage = 1) => {
        try {
            setLoading(true);
            const params: Record<string, string | number> = {
                page: targetPage,
                pageSize: DEFAULT_PAGE_SIZE,
            };
            if (query && query.length >= 2) params.q = query;

            const res = await api.get<PaginatedResponse>('/admin/clients', { params });
            setClients(res.data.data);
            setPage(res.data.meta.page);
            setTotalPages(res.data.meta.totalPages);
            setTotal(res.data.meta.total);
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    /** Clears current results and pagination state. */
    const clearResults = useCallback(() => {
        setClients([]);
        setPage(1);
        setTotalPages(0);
        setTotal(0);
        setSelectedIds(new Set());
    }, []);

    /** Loads the next page (if available) keeping the current search term. */
    const nextPage = useCallback(() => {
        if (page < totalPages) {
            fetchClients(search.length >= 2 ? search : undefined, page + 1);
        }
    }, [page, totalPages, search, fetchClients]);

    /** Loads the previous page (if available) keeping the current search term. */
    const prevPage = useCallback(() => {
        if (page > 1) {
            fetchClients(search.length >= 2 ? search : undefined, page - 1);
        }
    }, [page, search, fetchClients]);

    /** Sorted list for display (already filtered server-side). */
    const filtered = useMemo(() => {
        return [...clients].sort((a, b) => a.name.localeCompare(b.name));
    }, [clients]);

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
        setSelectedIds(new Set(filtered.map(c => c.id)));
    }, [filtered]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    // ── CRUD actions ──

    const createClient = async (name: string): Promise<void> => {
        const res = await api.post('/admin/clients', { name });
        setClients(prev => [...prev, res.data]);
    };

    const updateClient = async (id: string, name: string): Promise<void> => {
        const res = await api.patch(`/admin/clients/${id}`, { name });
        setClients(prev => prev.map(c => (c.id === id ? { ...c, ...res.data } : c)));
    };

    const toggleActive = async (id: string, isActive: boolean): Promise<void> => {
        const res = await api.patch(`/admin/clients/${id}`, { isActive });
        setClients(prev => prev.map(c => (c.id === id ? { ...c, ...res.data } : c)));
    };

    const removeClient = async (id: string): Promise<void> => {
        await api.delete(`/admin/clients/${id}`);
        setClients(prev => prev.filter(c => c.id !== id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const bulkDelete = async (ids: string[]): Promise<{ deleted: number }> => {
        const res = await api.post('/admin/clients/bulk-delete', { ids });
        setClients(prev => prev.filter(c => !ids.includes(c.id)));
        setSelectedIds(new Set());
        return res.data as { deleted: number };
    };

    const bulkImport = async (
        items: Array<{ name: string }>,
    ): Promise<ClientBulkImportResult> => {
        const res = await api.post('/admin/clients/bulk', { items });
        /* Re-fetch current view after import to show new data */
        await fetchClients(search.length >= 2 ? search : undefined, page);
        return res.data as ClientBulkImportResult;
    };

    /** Downloads all currently loaded clients as a single-column CSV (names only). */
    const exportToCsv = useCallback(() => {
        const today = new Date().toISOString().slice(0, 10);
        const rows = clients
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => c.name);

        downloadCsv(rows.join('\n'), `clientes_${today}.csv`);
    }, [clients]);

    return {
        clients,
        search,
        setSearch,
        filtered,
        loading,
        fetchClients,
        clearResults,
        createClient,
        updateClient,
        toggleActive,
        removeClient,
        bulkImport,
        exportToCsv,
        selectedIds,
        toggleSelect,
        selectAll,
        clearSelection,
        bulkDelete,
        page,
        totalPages,
        total,
        nextPage,
        prevPage,
    };
}
