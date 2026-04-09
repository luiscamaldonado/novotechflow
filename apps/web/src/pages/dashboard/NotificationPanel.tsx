/* ------------------------------------------------------------------ */
/*  NotificationPanel.tsx — Panel completo de notificaciones           */
/*  Modal overlay que muestra todas las notificaciones ordenadas.       */
/* ------------------------------------------------------------------ */

import { useEffect, useCallback, useMemo } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';

import type { DashboardNotification } from '../../hooks/useNotifications';

// ── Props ───────────────────────────────────────────────────────────

interface NotificationPanelProps {
    notifications: DashboardNotification[];
    onClose: () => void;
    markAsRead: (ids: string[]) => void;
}

// ── Severity order for sorting (URGENT first, then WARNING) ─────────

const SEVERITY_ORDER: Record<string, number> = {
    URGENT: 0,
    WARNING: 1,
};

// ── Badge config by severity ────────────────────────────────────────

const BADGE_CONFIG = {
    URGENT: {
        label: 'URGENTE',
        classes: 'bg-red-100 text-red-700',
    },
    WARNING: {
        label: 'PREVENTIVA',
        classes: 'bg-amber-100 text-amber-700',
    },
} as const;

// ── Sorted notifications hook ───────────────────────────────────────

function useSortedNotifications(notifications: DashboardNotification[]) {
    return useMemo(() => {
        return [...notifications].sort((a, b) => {
            // 1. Severity: URGENT first
            const severityDiff =
                (SEVERITY_ORDER[a.severity] ?? 2) -
                (SEVERITY_ORDER[b.severity] ?? 2);
            if (severityDiff !== 0) return severityDiff;

            // 2. Within same severity: unread first
            if (a.read !== b.read) return a.read ? 1 : -1;

            return 0;
        });
    }, [notifications]);
}

// ── Sub-component: Single notification item ─────────────────────────

interface NotificationItemProps {
    notification: DashboardNotification;
    onMarkRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
    const badge = BADGE_CONFIG[notification.severity];
    const isUnread = !notification.read;

    const handleClick = useCallback(() => {
        if (isUnread) {
            onMarkRead(notification.id);
        }
    }, [isUnread, notification.id, onMarkRead]);

    return (
        <li
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
            className={`px-5 py-4 transition-colors cursor-pointer hover:bg-gray-50 ${
                isUnread
                    ? 'bg-indigo-50/50 border-l-4 border-indigo-400'
                    : 'bg-white border-l-4 border-transparent'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Unread indicator */}
                <div className="pt-1 shrink-0 w-2">
                    {isUnread && (
                        <span className="block h-2 w-2 rounded-full bg-indigo-500" />
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                    {/* Severity badge + proposal code */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${badge.classes}`}
                        >
                            {badge.label}
                        </span>
                        <span className="text-xs font-black text-gray-900 truncate">
                            {notification.proposalCode} — {notification.clientName}
                        </span>
                    </div>

                    {/* Message */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {notification.message}
                    </p>

                    {/* Date */}
                    <p className="text-[10px] text-gray-400 font-semibold">
                        {notification.date}
                    </p>
                </div>
            </div>
        </li>
    );
}

// ── Empty state ─────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell className="h-10 w-10 mb-3 stroke-1 text-gray-300" />
            <p className="text-sm font-semibold">No hay notificaciones pendientes</p>
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────

export default function NotificationPanel({
    notifications,
    onClose,
    markAsRead,
}: NotificationPanelProps) {
    const sorted = useSortedNotifications(notifications);

    const unreadIds = useMemo(
        () => notifications.filter((n) => !n.read).map((n) => n.id),
        [notifications],
    );

    const hasUnread = unreadIds.length > 0;

    // Cerrar con Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleMarkAllRead = useCallback(() => {
        if (hasUnread) markAsRead(unreadIds);
    }, [hasUnread, markAsRead, unreadIds]);

    const handleMarkSingleRead = useCallback(
        (id: string) => markAsRead([id]),
        [markAsRead],
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Panel de notificaciones"
        >
            {/* Panel interior — stopPropagation evita cierre al click dentro */}
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 flex flex-col overflow-hidden"
                style={{ maxHeight: '80vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                        Todas las Notificaciones
                    </h3>
                    <div className="flex items-center gap-2">
                        {hasUnread && (
                            <button
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Marcar todas como leídas
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Cerrar panel"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Notification list */}
                <div className="overflow-y-auto flex-1">
                    {sorted.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {sorted.map((n) => (
                                <NotificationItem
                                    key={n.id}
                                    notification={n}
                                    onMarkRead={handleMarkSingleRead}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
