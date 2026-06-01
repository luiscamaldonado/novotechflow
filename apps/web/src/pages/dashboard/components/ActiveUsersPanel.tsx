import { Loader2, Users } from 'lucide-react';
import { useActiveUsers } from '../../../hooks/useActiveUsers';

/** Formatea un ISO string a hora local HH:MM, o '—' si es nulo. */
function formatLastSeen(isoString: string | null): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Panel (solo admin) con los usuarios que tienen sesión activa ahora mismo.
 * El gating de admin lo hace el componente padre (Dashboard).
 */
export default function ActiveUsersPanel() {
  const { activeUsers, isLoading } = useActiveUsers();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-50">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Sesiones activas</h3>
            <p className="text-xs text-gray-500">Usuarios trabajando ahora mismo</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg bg-emerald-600 text-white text-sm font-bold">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : activeUsers.length}
        </span>
      </div>

      {!isLoading && activeUsers.length === 0 && (
        <p className="text-sm text-gray-400 py-2">
          Nadie con sesión activa en este momento.
        </p>
      )}

      {activeUsers.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {activeUsers.map((u) => (
            <li key={u.nomenclature} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold shrink-0">
                  {u.nomenclature}
                </span>
                <span className="text-sm text-gray-700 truncate">{u.name}</span>
              </div>
              <span className="text-xs text-gray-400 font-mono shrink-0">
                {formatLastSeen(u.lastSeenAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
