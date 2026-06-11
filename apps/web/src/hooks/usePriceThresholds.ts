import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { PriceThresholds } from '../lib/priceValidation';

/** Defaults de respaldo si la lectura falla: NUNCA dejar los umbrales en 0/null (apagar\u00eda el check). */
const FALLBACK_THRESHOLDS: PriceThresholds = {
    copMinUnitPrice: 50000,
    usdMaxUnitPrice: 100000,
};

interface UsePriceThresholdsResult {
    thresholds: PriceThresholds;
    isLoading: boolean;
    update: (next: PriceThresholds) => Promise<void>;
}

/**
 * Lee los umbrales de validaci\u00f3n de precio desde el backend una sola vez al montar.
 * No refresca peri\u00f3dicamente: los umbrales cambian rara vez y aplican al recargar.
 * Ante fallo de red devuelve los defaults de respaldo, de modo que el check siempre
 * tenga umbrales v\u00e1lidos con qu\u00e9 trabajar.
 */
export function usePriceThresholds(): UsePriceThresholdsResult {
    const [thresholds, setThresholds] = useState<PriceThresholds>(FALLBACK_THRESHOLDS);
    const [isLoading, setIsLoading] = useState(true);

    const fetchThresholds = useCallback(async (): Promise<void> => {
        try {
            const { data } = await api.get<PriceThresholds>('/app-settings/price-thresholds');
            setThresholds(data);
        } catch {
            /* best-effort: conservar los defaults de respaldo ante fallos transitorios */
        } finally {
            setIsLoading(false);
        }
    }, []);

    const update = useCallback(async (next: PriceThresholds): Promise<void> => {
        const { data } = await api.patch<PriceThresholds>('/app-settings/price-thresholds', next);
        setThresholds(data);
    }, []);

    useEffect(() => {
        fetchThresholds();
    }, [fetchThresholds]);

    return { thresholds, isLoading, update };
}
