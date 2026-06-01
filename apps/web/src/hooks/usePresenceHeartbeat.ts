import { useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

/** Intervalo (ms) entre latidos de presencia mientras la app est\u00e1 abierta. */
const PRESENCE_HEARTBEAT_INTERVAL_MS = 30 * 1000;

/**
 * Registra presencia del usuario actual v\u00eda POST /presence/heartbeat de forma
 * peri\u00f3dica mientras la sesi\u00f3n est\u00e9 activa. Es independiente del timeout de
 * inactividad: late aunque el usuario no interact\u00fae, y se detiene al desmontar
 * (logout) o al perder la sesi\u00f3n.
 */
export function usePresenceHeartbeat(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    const sendHeartbeat = (): void => {
      api.post('/presence/heartbeat').catch(() => {
        /* best-effort: el heartbeat tolera fallos transitorios de red */
      });
    };

    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);
}
