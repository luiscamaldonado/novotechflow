import { useState, useEffect, useMemo, useCallback } from 'react';
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

// ── Hook ─────────────────────────────────────────────────────

export function useClientsAdmin() {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/clients', {
                params: { includeInactive: 'true' },
            });
            setClients(res.data);
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    /** Filtered + sorted list (text search over name, sorted alphabetically). */
    const filtered = useMemo(() => {
        let result = clients;

        if (search) {
            const term = search.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(term));
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [clients, search]);

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
    };

    const bulkImport = async (
        items: Array<{ name: string }>,
    ): Promise<ClientBulkImportResult> => {
        const res = await api.post('/admin/clients/bulk', { items });
        await fetchClients();
        return res.data as ClientBulkImportResult;
    };

    return {
        clients,
        search,
        setSearch,
        filtered,
        loading,
        fetchClients,
        createClient,
        updateClient,
        toggleActive,
        removeClient,
        bulkImport,
    };
}
