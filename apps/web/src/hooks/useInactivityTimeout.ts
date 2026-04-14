import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;   // 5 minutos
const WARNING_BEFORE_MS = 60 * 1000;          // Aviso 1 minuto antes
const WARNING_AT_MS = INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS; // 4 minutos

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'
];

interface InactivityState {
  showWarning: boolean;
  secondsLeft: number;
}

export function useInactivityTimeout(): InactivityState & { dismissWarning: () => void } {
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsLeft(60);

    // Timer 1: show warning at 4 minutes
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(60);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_AT_MS);

    // Timer 2: force logout at 5 minutes
    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      logout();
    }, INACTIVITY_LIMIT_MS);
  }, [clearAllTimers, logout]);

  const handleActivity = useCallback(() => {
    // Throttle: only reset if more than 1 second since last reset
    const now = Date.now();
    if (now - lastActivityRef.current < 1000) return;
    lastActivityRef.current = now;
    startTimers();
  }, [startTimers]);

  const dismissWarning = useCallback(() => {
    handleActivity();
  }, [handleActivity]);

  useEffect(() => {
    // Only run if user is logged in
    if (!token) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    startTimers();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [token, startTimers, handleActivity, clearAllTimers]);

  return { showWarning, secondsLeft, dismissWarning };
}
