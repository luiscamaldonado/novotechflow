import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { IVA_RATE } from '../lib/constants';
import { convertCost } from '../lib/pricing-engine';

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
    technicalSpecs?: Record<string, string>;
    internalCosts?: { fletePct?: number; proveedor?: string };
}

export interface ScenarioItemData {
    id: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
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

// ── Calculation helpers ─────────────────────────────────────

/**
 * Calcula el precio unitario de venta para un item de escenario,
 * replicando exactamente la lógica de ProposalCalculations.tsx.
 */
export function calculateItemUnitPrice(
    si: ScenarioItemData,
    allItems: ScenarioItemData[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    if (si.isDilpidate) return 0;

    const item = si.item;
    const rawCost = Number(item.unitCost);
    const cost = convertCost(rawCost, item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
    const flete = Number(item.internalCosts?.fletePct || 0);
    const parentLandedCost = cost * (1 + flete / 100);

    // Children costs per unit of parent
    let childrenCostPerUnit = 0;
    const children = si.children || [];
    children.forEach(child => {
        const cRawCost = Number(child.item.unitCost);
        const cCost = convertCost(cRawCost, child.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
        const cFlete = Number(child.item.internalCosts?.fletePct || 0);
        childrenCostPerUnit += cCost * (1 + cFlete / 100) * child.quantity;
    });
    const baseLandedCost = parentLandedCost + (childrenCostPerUnit / si.quantity);

    // Dilution: proportional share of diluted items' cost
    const dilutedItems = allItems.filter(i => i.isDilpidate);
    const normalItems = allItems.filter(i => !i.isDilpidate);

    let totalDilutedCost = 0;
    dilutedItems.forEach(di => {
        const diCost = convertCost(Number(di.item.unitCost), di.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
        totalDilutedCost += diCost * di.quantity;
    });

    let totalNormalSubtotal = 0;
    normalItems.forEach(ni => {
        const niCost = convertCost(Number(ni.item.unitCost), ni.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm ?? null);
        totalNormalSubtotal += niCost * ni.quantity;
    });

    let effectiveLandedCost = baseLandedCost;
    if (totalNormalSubtotal > 0 && totalDilutedCost > 0) {
        const itemWeight = (cost * si.quantity) / totalNormalSubtotal;
        const dilutionPerUnit = (itemWeight * totalDilutedCost) / si.quantity;
        effectiveLandedCost = baseLandedCost + dilutionPerUnit;
    }

    const margin = si.marginPctOverride !== undefined && si.marginPctOverride !== null
        ? Number(si.marginPctOverride)
        : Number(item.marginPct);

    if (margin >= 100) return 0;
    return effectiveLandedCost / (1 - margin / 100);
}

/**
 * Procesa un escenario: calcula precios de venta de cada item visible
 * y los totales del escenario.
 */
function processScenario(scenario: ScenarioData): ProcessedScenario {
    const allItems = scenario.scenarioItems;
    const visibleItems: VisibleItemCalc[] = [];

    let subtotalGravado = 0;
    let subtotalNoGravado = 0;

    for (const si of allItems) {
        if (si.isDilpidate) continue;

        const unitSalePrice = calculateItemUnitPrice(si, allItems, scenario.currency, scenario.conversionTrm);
        const subtotalBeforeVat = unitSalePrice * si.quantity;
        const ivaAmount = si.item.isTaxable ? subtotalBeforeVat * IVA_RATE : 0;

        visibleItems.push({
            scenarioItem: si,
            unitSalePrice,
            quantity: si.quantity,
            subtotalBeforeVat,
            ivaAmount,
        });

        if (si.item.isTaxable) {
            subtotalGravado += subtotalBeforeVat;
        } else {
            subtotalNoGravado += subtotalBeforeVat;
        }
    }

    const subtotalBeforeVat = subtotalGravado + subtotalNoGravado;
    const iva = subtotalGravado * IVA_RATE;
    const total = subtotalBeforeVat + iva;

    return {
        id: scenario.id,
        name: scenario.name,
        currency: scenario.currency,
        visibleItems,
        totals: { subtotalGravado, subtotalNoGravado, subtotalBeforeVat, iva, total },
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
