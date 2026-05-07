import { ForbiddenException } from '@nestjs/common';

export interface LockableProposal {
  isLocked: boolean;
  proposalCode: string | null;
}

/**
 * Lanza ForbiddenException si la propuesta está bloqueada por ser versión histórica.
 * Si proposal es null/undefined, no hace nada (el caller maneja el NotFound).
 */
export function assertProposalNotLocked(proposal: LockableProposal | null | undefined): void {
  if (!proposal) return;
  if (proposal.isLocked) {
    throw new ForbiddenException(
      `La propuesta ${proposal.proposalCode ?? ''} est\u00e1 bloqueada por ser una versi\u00f3n hist\u00f3rica. Solo la \u00faltima versi\u00f3n es editable.`.trim(),
    );
  }
}
