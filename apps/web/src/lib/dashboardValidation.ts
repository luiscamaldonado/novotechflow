import { PROJECTION_STATUSES } from './constants';
import { daysSince, isValidityExpired } from './dashboardDates';
import type { ProposalStatus, AcquisitionType } from './types';

/** Máximo de días que una propuesta puede permanecer en ELABORACION antes de obligar a cambiar su estado. */
const MAX_ELABORACION_DAYS = 5;

/** Estados exentos de la regla de fecha de cierre vencida (R5): terminales o ya en flujo de facturación. */
const R5_EXEMPT_STATUSES: ProposalStatus[] = ['GANADA', 'PERDIDA', 'PENDIENTE_FACTURAR', 'FACTURADA'];

export type HygieneRuleId =
    | 'CLOSE_DATE_REQUIRED'
    | 'ACQUISITION_REQUIRED'
    | 'BILLING_DATE_REQUIRED'
    | 'ELABORACION_STALE'
    | 'CLOSE_DATE_EXPIRED';

export interface HygieneIssue {
    ruleId: HygieneRuleId;
    message: string;
}

export interface ProposalHygieneInput {
    id: string;
    proposalCode: string | null;
    status: ProposalStatus;
    closeDate: string | null;
    billingDate: string | null;
    acquisitionType: AcquisitionType | null;
    createdAt: string;
}

export interface ProposalHygieneIssues {
    id: string;
    proposalCode: string | null;
    issues: HygieneIssue[];
}

/**
 * Evalúa las reglas de higiene de datos (R1-R5) para una sola propuesta.
 * Devuelve los issues en orden de regla; un arreglo vacío significa propuesta en regla.
 * Función pura: sin side effects, sin React, sin I/O.
 */
export function getProposalHygieneIssues(input: ProposalHygieneInput): HygieneIssue[] {
    const issues: HygieneIssue[] = [];
    const isElaboracion = input.status === 'ELABORACION';

    if (!input.closeDate) {
        issues.push({ ruleId: 'CLOSE_DATE_REQUIRED', message: 'Falta la fecha de cierre.' });
    }

    if (!isElaboracion && !input.acquisitionType) {
        issues.push({ ruleId: 'ACQUISITION_REQUIRED', message: 'Falta el tipo de adquisici\u00f3n (Venta o DaaS).' });
    }

    if (PROJECTION_STATUSES.includes(input.status) && !input.billingDate) {
        issues.push({ ruleId: 'BILLING_DATE_REQUIRED', message: 'Falta la fecha de facturaci\u00f3n.' });
    }

    if (isElaboracion && daysSince(input.createdAt) > MAX_ELABORACION_DAYS) {
        issues.push({
            ruleId: 'ELABORACION_STALE',
            message: `Lleva m\u00e1s de ${MAX_ELABORACION_DAYS} d\u00edas en Elaboraci\u00f3n; cambia el estado.`,
        });
    }

    if (input.closeDate && !R5_EXEMPT_STATUSES.includes(input.status) && isValidityExpired(input.closeDate)) {
        issues.push({ ruleId: 'CLOSE_DATE_EXPIRED', message: 'La fecha de cierre est\u00e1 vencida; actual\u00edzala o cambia el estado.' });
    }

    return issues;
}

/**
 * Evalúa todas las propuestas y devuelve solo las que tienen issues, ordenadas por
 * createdAt ascendente (más antigua primero) para que la UI muestre primero la más vencida.
 * Función pura: no muta la entrada.
 */
export function findBoardHygieneIssues(proposals: ProposalHygieneInput[]): ProposalHygieneIssues[] {
    return [...proposals]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((proposal) => ({
            id: proposal.id,
            proposalCode: proposal.proposalCode,
            issues: getProposalHygieneIssues(proposal),
        }))
        .filter((entry) => entry.issues.length > 0);
}
