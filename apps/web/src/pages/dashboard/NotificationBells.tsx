/* ------------------------------------------------------------------ */
/*  NotificationBells.tsx — Campanas de notificación del Dashboard      */
/*  Renderiza 2 campanas (WARNING / URGENT) con popovers flotantes.    */
/* ------------------------------------------------------------------ */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, BellRing } from 'lucide-react';

import type {
    DashboardNotification,
    NotificationSeverity,
} from '../../hooks/useNotifications';

// ── Props ───────────────────────────────────────────────────────────

interface NotificationBellsProps {
    warnings: DashboardNotification[];
    urgents: DashboardNotification[];
    unreadWarnings: number;
    unreadUrgents: number;
    markAllRead: (severity: NotificationSeverity) => void;
    onViewAll: () => void;
}

// ── Severity visual config ──────────────────────────────────────────

const SEVERITY_STYLES = {
    WARNING: {
        iconColor: 'text-amber-500 hover:text-amber-600',
        badgeBg: 'bg-amber-500',
        headerBg: 'bg-amber-50',
        headerText: 'text-amber-800',
        headerBorder: 'border-amber-100',
        label: 'Advertencias',
    },
    URGENT: {
        iconColor: 'text-red-500 hover:text-red-600',
        badgeBg: 'bg-red-500',
        headerBg: 'bg-red-50',
        headerText: 'text-red-800',
        headerBorder: 'border-red-100',
        label: 'Urgentes',
    },
} as const;

// ── Sub-component: Single bell with popover ─────────────────────────

interface BellButtonProps {
    severity: NotificationSeverity;
    notifications: DashboardNotification[];
    unreadCount: number;
    markAllRead: (severity: NotificationSeverity) => void;
    onViewAll: () => void;
}

function BellButton({
    severity,
    notifications,
    unreadCount,
    markAllRead,
    onViewAll,
}: BellButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const styles = SEVERITY_STYLES[severity];
    const Icon = severity === 'WARNING' ? Bell : BellRing;

    // Cerrar popover al hacer click fuera
    useEffect(() => {
        if (!isOpen) return;

        function handleMouseDown(e: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    const handleToggle = useCallback(() => {
        const willOpen = !isOpen;
        setIsOpen(willOpen);

        // Al abrir, marcar todas como leídas
        if (willOpen && unreadCount > 0) {
            markAllRead(severity);
        }
    }, [isOpen, unreadCount, markAllRead, severity]);

    const handleViewAll = useCallback(() => {
        setIsOpen(false);
        onViewAll();
    }, [onViewAll]);

    return (
        <div ref={containerRef} className="relative">
            {/* Bell icon + badge */}
            <button
                onClick={handleToggle}
                className={`relative p-2 rounded-xl transition-all hover:bg-gray-100 ${styles.iconColor}`}
                title={styles.label}
            >
                <Icon className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span
                        className={`absolute -top-0.5 -right-0.5 flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-black text-white ${styles.badgeBg} shadow-sm`}
                    >
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Popover */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div
                        className={`px-4 py-3 ${styles.headerBg} border-b ${styles.headerBorder}`}
                    >
                        <h4
                            className={`text-xs font-black uppercase tracking-wider ${styles.headerText}`}
                        >
                            {styles.label} ({notifications.length})
                        </h4>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                                No hay notificaciones
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {notifications.map((n) => (
                                    <li
                                        key={n.id}
                                        className={`px-4 py-3 transition-colors ${
                                            n.read
                                                ? 'bg-white'
                                                : 'bg-indigo-50/50'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {/* Unread indicator */}
                                            {!n.read && (
                                                <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-gray-900 truncate">
                                                    {n.proposalCode} —{' '}
                                                    {n.clientName}
                                                </p>
                                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                                                    {n.message}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                                                    {n.date}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                        <button
                            onClick={handleViewAll}
                            className="w-full text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                            Ver todas las notificaciones
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────

export default function NotificationBells({
    warnings,
    urgents,
    unreadWarnings,
    unreadUrgents,
    markAllRead,
    onViewAll,
}: NotificationBellsProps) {
    return (
        <div className="flex items-center gap-1">
            <BellButton
                severity="WARNING"
                notifications={warnings}
                unreadCount={unreadWarnings}
                markAllRead={markAllRead}
                onViewAll={onViewAll}
            />
            <BellButton
                severity="URGENT"
                notifications={urgents}
                unreadCount={unreadUrgents}
                markAllRead={markAllRead}
                onViewAll={onViewAll}
            />
        </div>
    );
}
