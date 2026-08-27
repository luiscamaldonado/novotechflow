import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
    calculateItemDisplayValues,
    calculateIvaAmount,
    calculateScenarioTotals,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    roundMoney,
} from '@repo/pricing-engine';

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
    /** Costo aterrizado total de los ítems diluidos, sin redondear. */
    dilutedCost: number;
    /** Todo el costo está en ítems diluidos y no queda base que lo absorba. */
    isFullyDiluted: boolean;
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
        // El engine ya entrega lineTotal y unitPrice redondeados a la moneda del
        // escenario (ADR-113): se toman tal cual, sin recalcular nada aqui.
        const subtotalBeforeVat = display.lineTotal;
        // IVA informativo por item; el IVA impreso del documento es el del
        // escenario (totals.iva). Se redondea igual que cualquier otro dinero.
        const ivaAmount = roundMoney(
            calculateIvaAmount(subtotalBeforeVat, si.item.isTaxable),
            scenario.currency,
        );
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

    // Misma deteccion que el banner de ProposalCalculations (ADR-117, B3), sobre
    // los items CRUDOS y con el mismo TRM que los totales. Aqui es la senal para
    // el aviso pre-documento: el filtro de visibles de arriba vuelve este estado
    // invisible al validador de precios (diseno de ADR-039 que este flag
    // complementa, no reemplaza).
    const dilutedCost = calculateTotalDilutedCost(
        allItems, scenario.currency, scenario.conversionTrm,
    );
    const normalSubtotal = calculateTotalNormalSubtotal(
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
        dilutedCost,
        isFullyDiluted: dilutedCost > 0 && normalSubtotal <= 0,
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-al-montar: patron del proyecto, rediseno de data-fetching pendiente (ADR-086)
        loadScenarios();
    }, [loadScenarios]);

    return { loading, processedScenarios, reloadScenarios: loadScenarios };
}
