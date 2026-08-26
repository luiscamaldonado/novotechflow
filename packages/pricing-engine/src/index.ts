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
    unitPriceOverride?: number | null;
    isDiluted?: boolean;
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
 *
 * A negative fletePct is treated as 0 (ADR-116, B1): a negative flete does not
 * exist as a business case, so a mis-captured figure no longer turns into an
 * invisible discount on the cost. No finiteness guard on purpose — a non-numeric
 * flete is not adjudicated yet and stays in the backlog.
 */
export function calculateParentLandedCost(unitCost: number, fletePct: number): number {
    const pct = fletePct < 0 ? 0 : fletePct;
    return unitCost * (1 + pct / 100);
}

/**
 * Sum of (childLanded × childQuantity) across all children.
 * Returns the TOTAL children cost (not per-parent-unit).
 *
 * The child's flete goes through calculateParentLandedCost (ADR-116): the flete
 * enters the landed cost through a single door. With flete >= 0 it is
 * bit-identical to the inline formula it replaced; with a negative one the child
 * is now covered by the same sign guard as the parent.
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
        total += calculateParentLandedCost(cCost, cFlete) * child.quantity;
    }
    return total;
}

/**
 * Base landed cost per parent unit = parentLanded + (childrenTotal / parentQuantity)
 *
 * With quantity <= 0 the children term is dropped and the function returns the
 * parent landed cost alone (ADR-116): the only per-unit value that still means
 * anything. It no longer produces Infinity (children / 0), NaN (0 / 0), nor a
 * SUBTRACTION of the children cost (children / negative).
 *
 * Deliberate asymmetry with calculateItemLandedTotal (ADR-115/116): the
 * division-free leaf DOES count the children of a row with quantity 0, because
 * it measures total money and not money per unit. The difference is inherent to
 * "per unit of zero units" — here there is no unit to charge the children to,
 * while there the money is owed all the same.
 */
export function calculateBaseLandedCost(
    parentLandedCost: number,
    childrenCostPerUnit: number,
    quantity: number,
): number {
    if (quantity <= 0) return parentLandedCost;
    return parentLandedCost + (childrenCostPerUnit / quantity);
}

/**
 * Landed total of ONE scenario item, in the scenario currency:
 * (converted unitCost + parent flete) × quantity + total children cost.
 *
 * This is the same money as baseLandedCost × quantity, written without the
 * division by quantity so a quantity of 0 contributes 0 instead of NaN.
 * It is the unit of account of the dilution (ADR-115): what a diluted item
 * hands over, and what weighs a visible one.
 */
export function calculateItemLandedTotal(
    si: PricingScenarioItem,
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    const rawCost = Number(si.item.unitCost);
    const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
    const flete = Number(si.item.internalCosts?.fletePct || 0);
    const parentLanded = calculateParentLandedCost(cost, flete);
    const childrenCost = calculateChildrenCostPerUnit(si.children || [], scenarioCurrency, conversionTrm);
    return parentLanded * si.quantity + childrenCost;
}

/**
 * Total LANDED cost of all diluted items: Σ(landedTotal) for isDiluted=true.
 *
 * Landed and not raw (ADR-115): the flete and the children of a diluted item
 * are part of what has to be recovered. Distributing only unitCost × quantity
 * made them evaporate from the quote.
 */
export function calculateTotalDilutedCost(
    items: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const si of items) {
        if (si.isDiluted) {
            total += calculateItemLandedTotal(si, scenarioCurrency, conversionTrm);
        }
    }
    return total;
}

/**
 * Total normal subtotal: Σ(landedTotal) for isDiluted=false.
 * Used as the weight denominator for dilution distribution, so it has to be
 * measured with the same ruler as the numerator (ADR-115): LANDED cost.
 */
export function calculateTotalNormalSubtotal(
    items: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const si of items) {
        if (!si.isDiluted) {
            total += calculateItemLandedTotal(si, scenarioCurrency, conversionTrm);
        }
    }
    return total;
}

/**
 * Dilution share per unit for a normal item, based on weight-proportional distribution.
 * Weight = (itemLandedCost × itemQuantity) / totalNormalSubtotal
 * dilutionPerUnit = (weight × totalDilutedCost) / itemQuantity
 *
 * itemLandedCost is the item's LANDED cost per unit (baseLandedCost): flete and
 * children included, already converted to the scenario currency. The formula is
 * unchanged; what ADR-115 fixed is the caller, which used to hand over the raw
 * unitCost and so weighed an item by less than it actually costs.
 */
export function calculateDilutionPerUnit(
    itemLandedCost: number,
    itemQuantity: number,
    totalNormalSubtotal: number,
    totalDilutedCost: number,
): number {
    if (totalNormalSubtotal <= 0 || totalDilutedCost <= 0 || itemQuantity <= 0) return 0;
    const itemWeight = (itemLandedCost * itemQuantity) / totalNormalSubtotal;
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
 * True when a margin input can be trusted as a percentage (ADR-116): a finite,
 * non-negative number, or a string that spells one. An empty or whitespace-only
 * string is NOT a margin — it is a field the user cleared.
 */
function isValidMargin(value: number | string | null | undefined): boolean {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
    if (typeof value !== 'string' || value.trim() === '') return false;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
}

/**
 * Resolve the effective margin for a scenario item.
 * The override takes priority ONLY when it is a valid margin (ADR-116): an
 * invalid override ('', whitespace, non-numeric, negative, NaN, Infinity) falls
 * back to the item margin — the same destination as a field never touched. An
 * invalid base margin falls back to 0. Never returns NaN nor a negative number.
 */
export function resolveMargin(
    marginPctOverride: number | string | null | undefined,
    itemMarginPct: number | string,
): number {
    const override = marginPctOverride ?? undefined;
    if (override !== undefined && isValidMargin(override)) return Number(override);
    return isValidMargin(itemMarginPct) ? Number(itemMarginPct) : 0;
}

/**
 * Unit sale price = effectiveLandedCost / (1 - margin/100).
 * Returns 0 if margin >= MAX_MARGIN (avoids division by zero or negative price).
 * The finiteness half of the guard is DEFENSIVE (ADR-116): a NaN or Infinity
 * margin can no longer arrive through resolveMargin, but a consumer calling this
 * function directly cannot slip a poisoned division through either.
 */
export function calculateUnitPrice(effectiveLandedCost: number, margin: number): number {
    if (!Number.isFinite(margin) || margin >= MAX_MARGIN) return 0;
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

/**
 * IVA amount for a base amount: base x IVA_RATE if taxable, 0 otherwise.
 */
export function calculateIvaAmount(base: number, isTaxable: boolean): number {
    return isTaxable ? base * IVA_RATE : 0;
}

/**
 * Amount with IVA applied: base x (1 + IVA_RATE) if taxable, base otherwise.
 */
export function applyIva(base: number, isTaxable: boolean): number {
    return isTaxable ? base * (1 + IVA_RATE) : base;
}

/**
 * Rounds a money amount to the precision of its currency, half-up
 * (Math.round semantics: halves round toward +Infinity).
 * COP: 0 decimals (whole pesos). Any other currency (USD today): 2 decimals.
 * This is the SINGLE rounding policy of the system (ADR-113): every money
 * value that leaves the engine or reaches a document must pass through here.
 */
export function roundMoney(value: number, currency: string): number {
    const factor = currency === 'COP' ? 1 : 100;
    return Math.round(value * factor) / factor;
}

/**
 * Rounds a money amount UP (ceiling) to the precision of its currency.
 * Used ONLY for the sale unit price (ADR-114): the quoted unit price is
 * never below its exact value. Everything else uses roundMoney (half-up).
 * The noise guard treats float representation noise as the integer it
 * represents (8.2 * 100 = 820.0000000000001 must NOT become 8.21).
 */
export function roundMoneyUp(value: number, currency: string): number {
    const factor = currency === 'COP' ? 1 : 100;
    const scaled = value * factor;
    const nearest = Math.round(scaled);
    const isNoise = Math.abs(scaled - nearest) <= 1e-9 * Math.max(1, Math.abs(scaled));
    return (isNoise ? nearest : Math.ceil(scaled)) / factor;
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
    const currency = scenarioCurrency || 'COP';
    const rawCost = Number(si.item.unitCost);
    const cost = convertCost(rawCost, si.item.costCurrency || 'COP', currency, conversionTrm);
    const flete = Number(si.item.internalCosts?.fletePct || 0);
    const parentLanded = calculateParentLandedCost(cost, flete);

    const children = si.children || [];
    const childrenCost = calculateChildrenCostPerUnit(children, scenarioCurrency, conversionTrm);
    const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

    // Dilution (only for non-diluted items)
    let dilution = 0;
    if (!si.isDiluted) {
        const totalDilutedCost = calculateTotalDilutedCost(allItems, scenarioCurrency, conversionTrm);
        const totalNormalSub = calculateTotalNormalSubtotal(allItems, scenarioCurrency, conversionTrm);
        // The weight is the LANDED cost per unit (ADR-115), not the raw one.
        dilution = calculateDilutionPerUnit(baseLanded, si.quantity, totalNormalSub, totalDilutedCost);
    }

    const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
    const baseMargin = resolveMargin(si.marginPctOverride, si.item.marginPct);

    // ── Rounding policy (ADR-113) ────────────────────────
    // The chain above runs at full precision; money LEAVES this function
    // already rounded to the scenario currency. The price chain is built on the
    // ROUNDED unit price so that the arithmetic a client can redo by hand
    // closes: unitPrice x quantity = lineTotal.
    const roundedEffectiveLanded = roundMoney(effectiveLanded, currency);

    let unitPrice = 0;
    let displayMargin = baseMargin;

    if (!si.isDiluted) {
        // The sale unit price rounds UP (ADR-114): the quoted price is never
        // below its exact value. Every other money field keeps half-up.
        if (si.unitPriceOverride !== null && si.unitPriceOverride !== undefined) {
            unitPrice = roundMoneyUp(Number(si.unitPriceOverride), currency);
            // The displayed margin is derived from the values the user actually
            // sees (both rounded), not from the full-precision ones.
            displayMargin = calculateMarginFromPrice(unitPrice, roundedEffectiveLanded);
        } else {
            unitPrice = roundMoneyUp(calculateUnitPrice(effectiveLanded, baseMargin), currency);
        }
    }

    const lineTotal = roundMoney(calculateLineTotal(unitPrice, si.quantity), currency);

    // The cost columns are rounded at the output, each one on its own — NOT in
    // a chain. Deliberate concession (ADR-113): between internal columns there
    // can be a drift of up to one minor unit, because parentLanded + children/q
    // is rounded independently of baseLanded. The chain that closes exactly is
    // the client's one (unitPrice -> lineTotal -> subtotal -> vat -> total).
    return {
        parentLandedCost: roundMoney(parentLanded, currency),
        childrenCostPerUnit: roundMoney(childrenCost, currency),
        baseLandedCost: roundMoney(baseLanded, currency),
        dilutionPerUnit: roundMoney(dilution, currency),
        effectiveLandedCost: roundedEffectiveLanded,
        margin: displayMargin,
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
    const currency = scenarioCurrency || 'COP';
    let beforeVat = 0;
    let nonTaxed = 0;
    let totalCost = 0;

    // Pre-compute dilution aggregates
    const totalDilutedCost = calculateTotalDilutedCost(scenarioItems, scenarioCurrency, conversionTrm);
    const totalNormalSubtotal = calculateTotalNormalSubtotal(scenarioItems, scenarioCurrency, conversionTrm);

    const normalItems = scenarioItems.filter(si => !si.isDiluted);

    for (const si of normalItems) {
        const rawCost = Number(si.item.unitCost);
        const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);

        const children = si.children || [];
        const childrenCost = calculateChildrenCostPerUnit(children, scenarioCurrency, conversionTrm);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        // Same ruler as calculateItemDisplayValues (ADR-115): baseLanded, not cost.
        const dilution = calculateDilutionPerUnit(
            baseLanded, si.quantity, totalNormalSubtotal, totalDilutedCost,
        );
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);

        const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
        // Same rounding policy as calculateItemDisplayValues (ADR-113/114):
        // this function duplicates the pipeline, so the rounding point has to
        // be the same one or the rows and the totals stop agreeing. The unit
        // price rounds UP (ADR-114); everything else keeps half-up.
        let unitPrice: number;
        if (si.unitPriceOverride !== null && si.unitPriceOverride !== undefined) {
            unitPrice = roundMoneyUp(Number(si.unitPriceOverride), currency);
        } else {
            unitPrice = roundMoneyUp(calculateUnitPrice(effectiveLanded, margin), currency);
        }
        const lineTotal = roundMoney(calculateLineTotal(unitPrice, si.quantity), currency);

        // Full precision on purpose: totalCost never reaches a document, it only
        // feeds globalMarginPct, which is a percentage and not money.
        totalCost += effectiveLanded * si.quantity;

        if (si.item.isTaxable) {
            beforeVat += lineTotal;
        } else {
            nonTaxed += lineTotal;
        }
    }

    // beforeVat and nonTaxed are exact sums of already-rounded line totals, so
    // subtotal needs no rounding of its own. globalMarginPct stays at full
    // precision (percentage, not money); the display layer formats it.
    const totalPrice = beforeVat + nonTaxed;
    const globalMarginPct = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;
    const subtotal = beforeVat + nonTaxed;
    // Rounding policy (ADR-113) + ADR-112: the IVA goes through the helper —
    // this was the last direct IVA_RATE multiplication outside them.
    const vat = roundMoney(calculateIvaAmount(beforeVat, true), currency);
    const total = subtotal + vat;

    return { beforeVat, nonTaxed, subtotal, vat, total, globalMarginPct };
}
