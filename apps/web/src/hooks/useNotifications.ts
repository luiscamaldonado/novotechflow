/* ------------------------------------------------------------------ */
/*  useNotifications.ts — Hook de notificaciones del Dashboard         */
/*  Consume el notification-engine y gestiona estado de lectura.       */
/* ------------------------------------------------------------------ */

import { useMemo, useState, useCallback } from 'react';

import {
  generateNotifications,
  type DashboardNotification,
  type NotificationProposal,
  type NotificationSeverity,
} from '../lib/notification-engine';

// ── Persistencia en localStorage ────────────────────────────────────

const STORAGE_KEY = 'novotechflow_read_notifications';

function getReadIds(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

// ── Hook principal ──────────────────────────────────────────────────

export function useNotifications(
  proposals: NotificationProposal[],
  trmRate: number | null,
) {
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);

  // Generar notificaciones (recalcula cuando cambian propuestas, TRM o lecturas)
  const notifications = useMemo(
    () => generateNotifications(proposals, trmRate, readIds),
    [proposals, trmRate, readIds],
  );

  // Separar por severidad
  const warnings = useMemo(
    () => notifications.filter((n) => n.severity === 'WARNING'),
    [notifications],
  );

  const urgents = useMemo(
    () => notifications.filter((n) => n.severity === 'URGENT'),
    [notifications],
  );

  // Contadores de no leídas
  const unreadWarnings = useMemo(
    () => warnings.filter((n) => !n.read).length,
    [warnings],
  );

  const unreadUrgents = useMemo(
    () => urgents.filter((n) => !n.read).length,
    [urgents],
  );

  // Marcar notificaciones específicas como leídas
  const markAsRead = useCallback((ids: string[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadIds(next);
      return next;
    });
  }, []);

  // Marcar todas de una severidad como leídas
  const markAllRead = useCallback(
    (severity: NotificationSeverity) => {
      const target = severity === 'WARNING' ? warnings : urgents;
      markAsRead(target.map((n) => n.id));
    },
    [warnings, urgents, markAsRead],
  );

  return {
    notifications,
    warnings,
    urgents,
    unreadWarnings,
    unreadUrgents,
    markAsRead,
    markAllRead,
  };
}

// Re-export de tipos para consumidores del hook
export type { DashboardNotification, NotificationSeverity };
