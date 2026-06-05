import { useState, useEffect } from 'react';
import { api } from '../lib/api';

/** Forma de una propuesta eliminada devuelta por GET /proposals/deleted. */
export interface DeletedProposal {
  id: string;
  proposalCode: string | null;
  clientName: string;
  subject: string;
  deletedAt: string;
  user: {
    name: string;
    nomenclature: string | null;
  };
}

interface UsePapeleraAdminResult {
  proposals: DeletedProposal[];
  isLoading: boolean;
  error: string | null;
  restoringId: string | null;
  restore: (id: string) => Promise<void>;
}

/** Mensaje de error de carga de la papelera. */
const LOAD_ERROR = 'No se pudo cargar la papelera. Intenta recargar la p\u00e1gina.';
/** Mensaje de error al restaurar una propuesta. */
const RESTORE_ERROR = 'No se pudo restaurar la propuesta. Intenta de nuevo.';

/** Extrae el mensaje del backend de un error de axios, con fallback. */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: string } } }).response;
    return resp?.data?.message ?? fallback;
  }
  return fallback;
}

/**
 * Gestiona el estado de la papelera de propuestas eliminadas (solo ADMIN).
 * Carga la lista al montar y permite restaurar filas individuales.
 */
export function usePapeleraAdmin(): UsePapeleraAdminResult {
  const [proposals, setProposals] = useState<DeletedProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    const loadDeleted = async () => {
      try {
        const { data } = await api.get<DeletedProposal[]>('/proposals/deleted');
        setProposals(data);
      } catch (err: unknown) {
        setError(extractErrorMessage(err, LOAD_ERROR));
      } finally {
        setIsLoading(false);
      }
    };
    loadDeleted();
  }, []);

  const restore = async (id: string): Promise<void> => {
    setError(null);
    setRestoringId(id);
    try {
      await api.patch(`/proposals/${id}/restore`);
      setProposals(prev => prev.filter(p => p.id !== id));
    } catch (err: unknown) {
      setError(extractErrorMessage(err, RESTORE_ERROR));
    } finally {
      setRestoringId(null);
    }
  };

  return { proposals, isLoading, error, restoringId, restore };
}
