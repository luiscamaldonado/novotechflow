// ──────────────────────────────────────────────────────────
// Pricing Engine — Single source of truth for financial calcs
// Pure functions, zero React/state dependencies
// ──────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────
export const IVA_RATE = 0.19;
export const MAX_MARGIN = 100;

/**
 * Convierte un costo de una moneda a otra usando la TRM.
 * Si las monedas son iguales o no hay TRM, retorna el costo sin cambios.
 */
export function convertCost(
    unitCost: number,
    itemCurrency: string,
    scenarioCurrency: string,
    trm: number | null | undefined,
): number {
    if (itemCurrency === scenarioCurrency || !trm || trm <= 0) return unitCost;
    if (itemCurrency === 'USD' && scenarioCurrency === 'COP') return unitCost * trm;
    if (itemCurrency === 'COP' && scenarioCurrency === 'USD') return unitCost / trm;
    return unitCost;
}

// ── Types ────────────────────────────────────────────────
export interface PricingItem {
    unitCost: number;
    costCurrency?: string;
    internalCosts?: { fletePct?: number | string };
    marginPct: number;
    isTaxable: boolean;
}

export interface PricingScenarioItem {
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: PricingItem;
    children?: PricingScenarioItem[];
}

export interface ScenarioTotals {
    beforeVat: number;
    nonTaxed: number;
    subtotal: number;
    vat: number;
    total: number;
    globalMarginPct: number;
}

// ── Pure calculation functions ───────────────────────────

/**
 * Landed cost of a parent item = unitCost × (1 + fletePct / 100)
 */
export function calculateParentLandedCost(unitCost: number, fletePct: number): number {
    return unitCost * (1 + fletePct / 100);
}

/**
 * Sum of (childLanded × childQuantity) across all children.
 * Returns the TOTAL children cost (not per-parent-unit).
 */
export function calculateChildrenCostPerUnit(
    children: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const child of children) {
        const rawCost = Number(child.item.unitCost);
        const cCost = convertCost(rawCost, child.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
        const cFlete = Number(child.item.internalCosts?.fletePct || 0);
        total += cCost * (1 + cFlete / 100) * child.quantity;
    }
    return total;
}

/**
 * Base landed cost per parent unit = parentLanded + (childrenTotal / parentQuantity)
 */
export function calculateBaseLandedCost(
    parentLandedCost: number,
    childrenCostPerUnit: number,
    quantity: number,
): number {
    return parentLandedCost + (childrenCostPerUnit / quantity);
}

/**
 * Total cost of all diluted items: Σ(unitCost × quantity) for isDilpidate=true.
 */
export function calculateTotalDilutedCost(
    items: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const si of items) {
        if (si.isDilpidate) {
            const rawCost = Number(si.item.unitCost);
            const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
            total += cost * si.quantity;
        }
    }
    return total;
}

/**
 * Total normal subtotal: Σ(unitCost × quantity) for isDilpidate=false.
 * Used as the weight denominator for dilution distribution.
 */
export function calculateTotalNormalSubtotal(
    items: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const si of items) {
        if (!si.isDilpidate) {
            const rawCost = Number(si.item.unitCost);
            const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
            total += cost * si.quantity;
        }
    }
    return total;
}

/**
 * Dilution share per unit for a normal item, based on weight-proportional distribution.
 * Weight = (itemCost × itemQuantity) / totalNormalSubtotal
 * dilutionPerUnit = (weight × totalDilutedCost) / itemQuantity
 */
export function calculateDilutionPerUnit(
    itemCost: number,
    itemQuantity: number,
    totalNormalSubtotal: number,
    totalDilutedCost: number,
): number {
    if (totalNormalSubtotal <= 0 || totalDilutedCost <= 0 || itemQuantity <= 0) return 0;
    const itemWeight = (itemCost * itemQuantity) / totalNormalSubtotal;
    return (itemWeight * totalDilutedCost) / itemQuantity;
}

/**
 * Effective landed cost = baseLandedCost + dilutionPerUnit
 */
export function calculateEffectiveLandedCost(
    baseLandedCost: number,
    dilutionPerUnit: number,
): number {
    return baseLandedCost + dilutionPerUnit;
}

/**
 * Resolve the effective margin for a scenario item.
 * Override takes priority unless null/undefined. Always returns a number.
 */
export function resolveMargin(
    marginPctOverride: number | string | null | undefined,
    itemMarginPct: number | string,
): number {
    const override = marginPctOverride ?? undefined;
    return override !== undefined ? Number(override) : Number(itemMarginPct);
}

/**
 * Unit sale price = effectiveLandedCost / (1 - margin/100).
 * Returns 0 if margin >= MAX_MARGIN (avoids division by zero or negative price).
 */
export function calculateUnitPrice(effectiveLandedCost: number, margin: number): number {
    if (margin >= MAX_MARGIN) return 0;
    return effectiveLandedCost / (1 - margin / 100);
}

/**
 * Line total = unitPrice × quantity.
 */
export function calculateLineTotal(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
}

/**
 * Inverse calculation: derive margin from a given sale price.
 * margin = ((unitPrice - effectiveLandedCost) / unitPrice) × 100
 */
export function calculateMarginFromPrice(
    unitPrice: number,
    effectiveLandedCost: number,
): number {
    if (unitPrice <= 0) return 0;
    return ((unitPrice - effectiveLandedCost) / unitPrice) * 100;
}

// ── Display values for a single item ─────────────────────

export interface ItemDisplayValues {
    parentLandedCost: number;
    childrenCostPerUnit: number;
    baseLandedCost: number;
    dilutionPerUnit: number;
    effectiveLandedCost: number;
    margin: number;
    unitPrice: number;
    lineTotal: number;
}

/**
 * Computes all display values for a single scenario item,
 * considering the full list of items for dilution distribution.
 */
export function calculateItemDisplayValues(
    si: PricingScenarioItem,
    allItems: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): ItemDisplayValues {
    const rawCost = Number(si.item.unitCost);
    const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
    const flete = Number(si.item.internalCosts?.fletePct || 0);
    const parentLanded = calculateParentLandedCost(cost, flete);

    const children = si.children || [];
    const childrenCost = calculateChildrenCostPerUnit(children, scenarioCurrency, conversionTrm);
    const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

    // Dilution (only for non-diluted items)
    let dilution = 0;
    if (!si.isDilpidate) {
        const totalDilutedCost = calculateTotalDilutedCost(allItems, scenarioCurrency, conversionTrm);
        const totalNormalSub = calculateTotalNormalSubtotal(allItems, scenarioCurrency, conversionTrm);
        dilution = calculateDilutionPerUnit(cost, si.quantity, totalNormalSub, totalDilutedCost);
    }

    const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
    const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);

    let unitPrice = 0;
    if (!si.isDilpidate) {
        unitPrice = calculateUnitPrice(effectiveLanded, margin);
    }

    const lineTotal = calculateLineTotal(unitPrice, si.quantity);

    return {
        parentLandedCost: parentLanded,
        childrenCostPerUnit: childrenCost,
        baseLandedCost: baseLanded,
        dilutionPerUnit: dilution,
        effectiveLandedCost: effectiveLanded,
        margin,
        unitPrice,
        lineTotal,
    };
}

// ── Scenario-level totals ────────────────────────────────

/**
 * Calculate full financial totals for a scenario.
 * Includes dilution, taxable/non-taxable split, IVA, and global margin.
 */
export function calculateScenarioTotals(
    scenarioItems: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): ScenarioTotals {
    let beforeVat = 0;
    let nonTaxed = 0;
    let totalCost = 0;

    // Pre-compute dilution aggregates
    const totalDilutedCost = calculateTotalDilutedCost(scenarioItems, scenarioCurrency, conversionTrm);
    const totalNormalSubtotal = calculateTotalNormalSubtotal(scenarioItems, scenarioCurrency, conversionTrm);

    const normalItems = scenarioItems.filter(si => !si.isDilpidate);

    for (const si of normalItems) {
        const rawCost = Number(si.item.unitCost);
        const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);

        const children = si.children || [];
        const childrenCost = calculateChildrenCostPerUnit(children, scenarioCurrency, conversionTrm);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        const dilution = calculateDilutionPerUnit(
            cost, si.quantity, totalNormalSubtotal, totalDilutedCost,
        );
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);

        const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
        const unitPrice = calculateUnitPrice(effectiveLanded, margin);
        const lineTotal = calculateLineTotal(unitPrice, si.quantity);

        totalCost += effectiveLanded * si.quantity;

        if (si.item.isTaxable) {
            beforeVat += lineTotal;
        } else {
            nonTaxed += lineTotal;
        }
    }

    const totalPrice = beforeVat + nonTaxed;
    const globalMarginPct = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;
    const subtotal = beforeVat + nonTaxed;
    const vat = beforeVat * IVA_RATE;
    const total = beforeVat + vat + nonTaxed;

    return { beforeVat, nonTaxed, subtotal, vat, total, globalMarginPct };
}
