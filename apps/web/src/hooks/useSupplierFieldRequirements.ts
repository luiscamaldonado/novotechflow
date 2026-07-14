import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { SupplierFieldRequirements } from '../lib/types';

/** Default del backend: los tres campos obligatorios. */
const FALLBACK_REQUIREMENTS: SupplierFieldRequirements = {
    nameRequired: true,
    phoneRequired: true,
    emailRequired: true,
};

interface UseSupplierFieldRequirementsResult {
    requirements: SupplierFieldRequirements;
    isLoading: boolean;
    update: (next: Partial<SupplierFieldRequirements>) => Promise<void>;
}

export function useSupplierFieldRequirements(): UseSupplierFieldRequirementsResult {
    const [requirements, setRequirements] = useState<SupplierFieldRequirements>(FALLBACK_REQUIREMENTS);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequirements = useCallback(async (): Promise<void> => {
        try {
            const { data } = await api.get<SupplierFieldRequirements>(
                '/app-settings/supplier-field-requirements',
            );
            setRequirements(data);
        } catch { /* best-effort */ }
        finally { setIsLoading(false); }
    }, []);

    const update = useCallback(async (next: Partial<SupplierFieldRequirements>): Promise<void> => {
        const { data } = await api.patch<SupplierFieldRequirements>(
            '/app-settings/supplier-field-requirements',
            next,
        );
        setRequirements(data);
    }, []);

    useEffect(() => {
        fetchRequirements();
    }, [fetchRequirements]);

    return { requirements, isLoading, update };
}
