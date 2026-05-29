import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { IVA_RATE } from '../lib/constants';
import { calculateItemDisplayValues, calculateScenarioTotals } from '../lib/pricing-engine';

// ── Types ────────────────────────────────────────────────────

export interface ProposalItemData {
    id: string;
    name: string;
    description?: string | null;
    itemType: string;
    brand?: string;
    partNumber?: string;
    unitCost: number;
    costCurrency?: string;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    deliveryDays?: number | null;
    technicalSpecs?: Record<string, string>;
    internalCosts?: { fletePct?: number; proveedor?: string };
}

export interface ScenarioItemData {
    id: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    unitPriceOverride?: number | null;
    isDiluted?: boolean;
    item: ProposalItemData;
    children?: ScenarioItemData[];
}

export interface ScenarioData {
    id: string;
    name: string;
    currency: string;
    conversionTrm?: number | null;
    scenarioItems: ScenarioItemData[];
}

/** A visible item with its calculated sale price */
export interface VisibleItemCalc {
    scenarioItem: ScenarioItemData;
    unitSalePrice: number;
    quantity: number;
    subtotalBeforeVat: number;
    ivaAmount: number;
}

/** Totals for a single scenario */
export interface ScenarioCalcTotals {
    subtotalGravado: number;
    subtotalNoGravado: number;
    subtotalBeforeVat: number;
    iva: number;
    total: number;
}

/** A processed scenario ready for document rendering */
export interface ProcessedScenario {
    id: string;
    name: string;
    currency: string;
    visibleItems: VisibleItemCalc[];
    totals: ScenarioCalcTotals;
}

// ── Scenario processing (delegates to pricing-engine) ───────

/**
 * Procesa un escenario delegando 100 % al pricing-engine.
 * Respeta unitPriceOverride, dilución, y todos los cálculos del engine.
 */
function processScenario(scenario: ScenarioData): ProcessedScenario {
    const allItems = scenario.scenarioItems;
    const visibleItems: VisibleItemCalc[] = [];

    for (const si of allItems) {
        if (si.isDiluted) continue;
        const display = calculateItemDisplayValues(
            si, allItems, scenario.currency, scenario.conversionTrm,
        );
        const subtotalBeforeVat = display.lineTotal;
        const ivaAmount = si.item.isTaxable ? subtotalBeforeVat * IVA_RATE : 0;
        visibleItems.push({
            scenarioItem: si,
            unitSalePrice: display.unitPrice,
            quantity: si.quantity,
            subtotalBeforeVat,
            ivaAmount,
        });
    }

    const t = calculateScenarioTotals(
        allItems, scenario.currency, scenario.conversionTrm,
    );

    return {
        id: scenario.id,
        name: scenario.name,
        currency: scenario.currency,
        visibleItems,
        totals: {
            subtotalGravado: t.beforeVat,
            subtotalNoGravado: t.nonTaxed,
            subtotalBeforeVat: t.subtotal,
            iva: t.vat,
            total: t.total,
        },
    };
}

// ── Hook ─────────────────────────────────────────────────────

export function useProposalScenarios(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [processedScenarios, setProcessedScenarios] = useState<ProcessedScenario[]>([]);

    const loadScenarios = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${proposalId}/scenarios`);
            const scenarios: ScenarioData[] = res.data || [];
            setProcessedScenarios(scenarios.map(processScenario));
        } catch (error) {
            console.error('Error loading scenarios for document', error);
        } finally {
            setLoading(false);
        }
    }, [proposalId]);

    useEffect(() => {
        loadScenarios();
    }, [loadScenarios]);

    return { loading, processedScenarios, reloadScenarios: loadScenarios };
}
