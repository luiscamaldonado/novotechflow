import { create } from 'zustand';
import type { AuthUser } from '../lib/types';
import { INACTIVITY_TIMEOUT_STORAGE_KEY } from '../lib/constants';
import { api } from '../lib/api';

/** Rango válido para minutos de inactividad configurados en el backend. */
const MIN_TIMEOUT_MINUTES = 2;
const MAX_TIMEOUT_MINUTES = 60;

/**
 * Decodifica el payload de un JWT sin verificar firma.
 * La verificación de firma la hace el backend; aquí solo leemos `exp`.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

/** Verifica si un token JWT está expirado comparando `exp` contra el reloj local. */
function isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;
    return payload.exp < Date.now() / 1000;
}

/** Valida que un valor sea un número entero dentro del rango permitido [2, 60]. */
function isValidTimeoutMinutes(value: unknown): value is number {
    return typeof value === 'number' && value >= MIN_TIMEOUT_MINUTES && value <= MAX_TIMEOUT_MINUTES;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    inactivityTimeoutMinutes: number | null;
    login: (token: string, user: AuthUser) => void;
    logout: () => void;
    checkAuth: () => void;
    loadInactivityTimeout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    inactivityTimeoutMinutes: null,

    login: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true, inactivityTimeoutMinutes: null });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem(INACTIVITY_TIMEOUT_STORAGE_KEY);
        set({ token: null, user: null, isAuthenticated: false, inactivityTimeoutMinutes: null });
    },

    checkAuth: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            // Verificar expiración del JWT antes de confiar en él
            if (isTokenExpired(token)) {
                get().logout();
                set({ isLoading: false });
                return;
            }

            try {
                // Rehidratar timeout cacheado en localStorage si es válido
                const cachedStr = localStorage.getItem(INACTIVITY_TIMEOUT_STORAGE_KEY);
                const cached = cachedStr !== null ? Number(cachedStr) : null;
                const inactivityTimeoutMinutes = cached !== null && isValidTimeoutMinutes(cached) ? cached : null;

                set({
                    token,
                    user: JSON.parse(userStr),
                    isAuthenticated: true,
                    isLoading: false,
                    inactivityTimeoutMinutes,
                });
            } catch {
                set({ token: null, user: null, isAuthenticated: false, isLoading: false });
            }
        } else {
            set({ isLoading: false });
        }
    },

    loadInactivityTimeout: async () => {
        try {
            const { data } = await api.get<{ minutes: unknown }>('/app-settings/inactivity-timeout');
            const minutes = data.minutes;

            if (!isValidTimeoutMinutes(minutes)) return;

            localStorage.setItem(INACTIVITY_TIMEOUT_STORAGE_KEY, String(minutes));
            set({ inactivityTimeoutMinutes: minutes });
        } catch {
            // Silencioso: el hook usará el fallback si el state queda null
        }
    },
}));
