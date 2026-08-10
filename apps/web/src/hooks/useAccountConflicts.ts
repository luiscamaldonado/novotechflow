import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { ConflictRecord, ConflictSearchState } from '../lib/types';
import { CONFLICT_SEARCH_DEBOUNCE_MS, MIN_CONFLICT_SEARCH_LENGTH } from '../lib/constants';

/** Resultado de la ultima busqueda, atado al nombre que la origino. */
interface ConflictSearchResult {
    name: string;
    records: ConflictRecord[];
}

/**
 * Búsqueda dinámica (debounced) de propuestas previas del mismo cliente para
 * detectar cruce de cuentas. Devuelve un único estado derivado en render
 * (idle | searching | ready | failed), anclado al nombre que originó cada
 * resultado: "ready" solo aparece cuando el servidor respondió para el nombre
 * vigente, nunca como estado por defecto.
 */
export function useAccountConflicts(clientName: string) {
    const [searchResult, setSearchResult] = useState<ConflictSearchResult | null>(null);
    const [failedName, setFailedName] = useState<string | null>(null);

    // ── Cruce de cuentas dinámico (debounced) ────────────
    useEffect(() => {
        const trimmedName = clientName.trim();

        if (trimmedName.length < MIN_CONFLICT_SEARCH_LENGTH) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const response = await api.get<ConflictRecord[]>(
                    `/proposals/client-history?clientName=${encodeURIComponent(trimmedName)}`
                );
                setSearchResult({ name: trimmedName, records: response.data });
            } catch (error) {
                console.error('Error buscando cruce de cuentas:', error);
                setFailedName(trimmedName);
            }
        }, CONFLICT_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [clientName]);

    const trimmedName = clientName.trim();

    let state: ConflictSearchState;
    if (trimmedName.length < MIN_CONFLICT_SEARCH_LENGTH) {
        state = { status: 'idle' };
    } else if (searchResult && searchResult.name === trimmedName) {
        state = { status: 'ready', conflicts: searchResult.records };
    } else if (failedName === trimmedName) {
        state = { status: 'failed' };
    } else {
        state = { status: 'searching' };
    }

    return { state };
}
