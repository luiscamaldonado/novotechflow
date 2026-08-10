// ──────────────────────────────────────────────────────────
// Web-only pricing helpers (dashboard amount resolution).
// Core financial calc lives in @repo/pricing-engine (single source of truth).
// ──────────────────────────────────────────────────────────

import { calculateScenarioTotals } from '@repo/pricing-engine';
import type { ProposalSummary } from './types';

export * from '@repo/pricing-engine';

type CurrencyCode = 'COP' | 'USD';

export interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
}

export function computeMinSubtotal(proposal: ProposalSummary): MinSubtotalResult {
    if (!proposal.scenarios || proposal.scenarios.length === 0) {
        return { subtotal: null, currency: null };
    }

    let minSubtotal: number | null = null;
    let minCurrency: CurrencyCode | null = null;

    for (const scenario of proposal.scenarios) {
        const totals = calculateScenarioTotals(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
        const sub = totals.subtotal;

        if (minSubtotal === null || sub < minSubtotal) {
            minSubtotal = sub;
            minCurrency = (scenario.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode;
        }
    }

    return { subtotal: minSubtotal, currency: minCurrency };
}

export function getDashboardAmount(
    proposal: ProposalSummary,
): MinSubtotalResult & { isManual: boolean } {
    const fromScenarios = computeMinSubtotal(proposal);
    if (fromScenarios.subtotal !== null && fromScenarios.subtotal > 0) {
        return { ...fromScenarios, isManual: false };
    }
    const manual = proposal.manualAmount ? Number(proposal.manualAmount) : NaN;
    if (!isNaN(manual) && manual > 0) {
        return { subtotal: manual, currency: 'USD', isManual: true };
    }
    return { subtotal: null, currency: null, isManual: false };
}
