import { Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { usePapeleraAdmin } from '../../hooks/usePapeleraAdmin';

/** Formatea un timestamp ISO al formato local colombiano. */
function formatDeletedAt(iso: string): string {
  return new Date(iso).toLocaleString('es-CO');
}

export default function PapeleraAdmin() {
  const { proposals, isLoading, error, restoringId, restore } = usePapeleraAdmin();

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
          <Trash2 className="h-8 w-8 mr-3 text-indigo-600" />
          Papelera de propuestas
        </h2>
        <p className="text-slate-500 text-sm font-medium mt-1">
          Propuestas eliminadas. Restaurar una propuesta la devuelve al dashboard.
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm font-bold text-red-500 py-8 text-center">{error}</p>
        ) : proposals.length === 0 ? (
          <p className="text-slate-400 text-sm font-medium py-16 text-center">
            No hay propuestas eliminadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Asunto</th>
                  <th className="px-3 py-3">Comercial</th>
                  <th className="px-3 py-3">Eliminada</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {proposals.map(proposal => (
                  <tr key={proposal.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-3 font-bold text-slate-700 whitespace-nowrap">
                      {proposal.proposalCode ?? '\u2014'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{proposal.clientName}</td>
                    <td className="px-3 py-3 text-slate-500 max-w-xs truncate">{proposal.subject}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                      {proposal.user.name}
                      {proposal.user.nomenclature ? ` [${proposal.user.nomenclature}]` : ''}
                    </td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                      {formatDeletedAt(proposal.deletedAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => restore(proposal.id)}
                        disabled={restoringId === proposal.id}
                        className={
                          restoringId === proposal.id
                            ? 'inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all'
                        }
                      >
                        {restoringId === proposal.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            Restaurar
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
