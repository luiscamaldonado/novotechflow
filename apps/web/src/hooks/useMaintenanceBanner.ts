import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

/** Intervalo (ms) de refresco del estado del banner de mantenimiento. */
const MAINTENANCE_BANNER_REFRESH_MS = 60 * 1000;

/** Estado del banner de mantenimiento (mensaje + visibilidad). */
export interface MaintenanceBanner {
  message: string;
  active: boolean;
}

interface UseMaintenanceBannerResult {
  banner: MaintenanceBanner | null;
  isLoading: boolean;
  update: (message: string, active: boolean) => Promise<void>;
}

/**
 * Lee el banner de mantenimiento desde el backend y lo refresca periódicamente,
 * de modo que los usuarios vean cambios sin recargar. Best-effort: ante fallos
 * de red conserva el último estado conocido.
 */
export function useMaintenanceBanner(): UseMaintenanceBannerResult {
  const [banner, setBanner] = useState<MaintenanceBanner | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBanner = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get<MaintenanceBanner>('/app-settings/maintenance-banner');
      setBanner(data);
    } catch {
      /* best-effort: conservar el último estado ante fallos transitorios */
    } finally {
      setIsLoading(false);
    }
  }, []);

  const update = useCallback(async (message: string, active: boolean): Promise<void> => {
    const { data } = await api.patch<MaintenanceBanner>(
      '/app-settings/maintenance-banner',
      { message, active },
    );
    setBanner(data);
  }, []);

  useEffect(() => {
    fetchBanner();
    const intervalId = setInterval(fetchBanner, MAINTENANCE_BANNER_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [fetchBanner]);

  return { banner, isLoading, update };
}
