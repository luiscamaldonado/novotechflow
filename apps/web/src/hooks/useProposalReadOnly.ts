/**
 * Determina si una propuesta debe renderizarse en modo solo lectura.
 *
 * Una propuesta es read-only cuando `isLocked === true`, que ocurre para
 * todas las versiones excepto la última de cada grupo (ej: en el grupo
 * COT-LMA05001-1, -2, -3 → solo -3 es editable).
 *
 * El backend ya rechaza con 403 cualquier mutación contra una propuesta
 * locked. Este hook gobierna la UX: deshabilita inputs, oculta botones
 * de export y muestra el banner de aviso.
 */
export interface ReadOnlyState {
  isReadOnly: boolean;
}

export function useProposalReadOnly(
  proposal: { isLocked?: boolean } | null | undefined
): ReadOnlyState {
  return { isReadOnly: !!proposal?.isLocked };
}
