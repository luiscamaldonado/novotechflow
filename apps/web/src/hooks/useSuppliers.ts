import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { SupplierCompany, SupplierContact } from '../lib/types';

interface NewContactInput {
    name: string;
    phone?: string;
    email?: string;
}

interface UseSuppliersResult {
    companies: SupplierCompany[];
    isLoading: boolean;
    createCompany: (name: string) => Promise<SupplierCompany>;
    createContact: (companyId: string, contact: NewContactInput) => Promise<SupplierContact>;
}

/**
 * Catalogo global de proveedores. Se trae completo una sola vez al montar
 * (~2000 empresas) y se filtra en memoria; no hace fetch por tecla.
 */
export function useSuppliers(): UseSuppliersResult {
    const [companies, setCompanies] = useState<SupplierCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCompanies = useCallback(async (): Promise<void> => {
        try {
            const { data } = await api.get<SupplierCompany[]>('/suppliers');
            setCompanies(data);
        } catch { /* best-effort */ }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const createCompany = useCallback(async (name: string): Promise<SupplierCompany> => {
        const { data } = await api.post<SupplierCompany>('/suppliers', { name });
        setCompanies(prev =>
            [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        );
        return data;
    }, []);

    const createContact = useCallback(
        async (companyId: string, contact: NewContactInput): Promise<SupplierContact> => {
            const { data } = await api.post<SupplierContact>(
                `/suppliers/${companyId}/contacts`,
                contact,
            );
            setCompanies(prev =>
                prev.map(c =>
                    c.id === companyId
                        ? {
                              ...c,
                              contacts: [...c.contacts, data].sort((a, b) =>
                                  a.name.localeCompare(b.name, 'es'),
                              ),
                          }
                        : c,
                ),
            );
            return data;
        },
        [],
    );

    return { companies, isLoading, createCompany, createContact };
}
