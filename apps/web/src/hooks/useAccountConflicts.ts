import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { ConflictRecord } from '../lib/types';
import { CONFLICT_SEARCH_DEBOUNCE_MS, MIN_CONFLICT_SEARCH_LENGTH } from '../lib/constants';

/**
 * Búsqueda dinámica (debounced) de propuestas previas del mismo cliente para
 * detectar cruce de cuentas. Devuelve la lista de coincidencias y dos banderas
 * derivadas para el panel: si el campo de cliente está vacío y si no hay cruces.
 */
export function useAccountConflicts(clientName: string) {
    const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);

    // ── Cruce de cuentas dinámico (debounced) ────────────
    useEffect(() => {
        const trimmedName = clientName.trim();

        if (trimmedName.length < MIN_CONFLICT_SEARCH_LENGTH) {
            setConflicts([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const response = await api.get(
                    `/proposals/client-history?clientName=${encodeURIComponent(trimmedName)}`
                );
                setConflicts(response.data);
            } catch (error) {
                console.error('Error buscando cruce de cuentas:', error);
            }
        }, CONFLICT_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [clientName]);

    const isClientEmpty = clientName.trim() === '';
    const hasNoConflicts = conflicts.length === 0;

    return { conflicts, isClientEmpty, hasNoConflicts };
}
