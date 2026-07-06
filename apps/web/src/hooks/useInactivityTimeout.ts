import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  INACTIVITY_TIMEOUT_FALLBACK_MINUTES,
  INACTIVITY_WARNING_BEFORE_MS,
} from '../lib/constants';

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
  const inactivityTimeoutMinutes = useAuthStore((s) => s.inactivityTimeoutMinutes);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const scheduleTimers = useCallback(() => {
    const minutes = inactivityTimeoutMinutes ?? INACTIVITY_TIMEOUT_FALLBACK_MINUTES;
    const inactivityLimitMs = minutes * 60 * 1000;
    const warningAtMs = inactivityLimitMs - INACTIVITY_WARNING_BEFORE_MS;

    clearAllTimers();
    lastActivityRef.current = Date.now();

    // Timer 1: show warning 1 minute before logout
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
    }, warningAtMs);

    // Timer 2: force logout at limit
    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      logout();
    }, inactivityLimitMs);
  }, [clearAllTimers, logout, inactivityTimeoutMinutes]);

  const restartTimers = useCallback(() => {
    setShowWarning(false);
    setSecondsLeft(60);
    scheduleTimers();
  }, [scheduleTimers]);

  const handleActivity = useCallback(() => {
    // Throttle: only reset if more than 1 second since last reset
    const now = Date.now();
    if (now - lastActivityRef.current < 1000) return;
    lastActivityRef.current = now;
    restartTimers();
  }, [restartTimers]);

  const dismissWarning = useCallback(() => {
    handleActivity();
  }, [handleActivity]);

  useEffect(() => {
    // Only run if user is logged in
    if (!token) {
      clearAllTimers();
      return;
    }

    scheduleTimers();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [token, scheduleTimers, handleActivity, clearAllTimers]);

  const isWarningVisible = showWarning && Boolean(token);
  return { showWarning: isWarningVisible, secondsLeft, dismissWarning };
}
