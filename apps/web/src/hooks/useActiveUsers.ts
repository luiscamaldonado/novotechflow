import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

/** Intervalo (ms) de refresco de la lista de usuarios activos. */
const ACTIVE_USERS_REFRESH_MS = 60 * 1000;

/** Usuario con sesión activa devuelto por GET /presence/active. */
export interface ActiveUser {
  name: string;
  nomenclature: string;
  /** ISO string del último latido (serialización JSON de un DateTime). */
  lastSeenAt: string | null;
}

interface UseActiveUsersResult {
  activeUsers: ActiveUser[];
  isLoading: boolean;
}

/**
 * Obtiene la lista de usuarios con sesión activa (endpoint solo-admin) y la
 * refresca periódicamente. Best-effort: ante un fallo de red conserva la
 * última lista conocida y no rompe la vista.
 */
export function useActiveUsers(): UseActiveUsersResult {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveUsers = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get<ActiveUser[]>('/presence/active');
      setActiveUsers(data);
    } catch {
      /* best-effort: conservar la última lista ante fallos transitorios */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveUsers();
    const intervalId = setInterval(fetchActiveUsers, ACTIVE_USERS_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [fetchActiveUsers]);

  return { activeUsers, isLoading };
}
