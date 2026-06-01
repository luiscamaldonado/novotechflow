import { AlertTriangle } from 'lucide-react';
import { useMaintenanceBanner } from '../hooks/useMaintenanceBanner';

/**
 * Banner global de mantenimiento programado. Visible para todos los usuarios
 * cuando el admin lo activa y hay un mensaje. Estilo de advertencia (no error).
 */
export default function MaintenanceBanner() {
  const { banner } = useMaintenanceBanner();

  if (!banner?.active || !banner.message.trim()) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-8 py-3">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-800">{banner.message}</p>
      </div>
    </div>
  );
}
