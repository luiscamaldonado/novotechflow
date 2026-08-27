import type { ProcessedScenario } from '../hooks/useProposalScenarios';

/** Umbrales de validaci\u00f3n de precio unitario (piso COP, techo USD). */
export interface PriceThresholds {
    copMinUnitPrice: number;
    usdMaxUnitPrice: number;
}

/** Tipo de hallazgo: precio por debajo del piso (COP), por encima del techo
 *  (USD), o escenario 100 % diluido (ADR-117, B3). */
export type PriceWarningKind =
    | 'COP_BELOW_FLOOR'
    | 'USD_ABOVE_CEILING'
    | 'FULLY_DILUTED_SCENARIO';

/** Un hallazgo de precio sospechoso para un \u00edtem concreto. */
export interface ItemPriceWarning {
    kind: 'COP_BELOW_FLOOR' | 'USD_ABOVE_CEILING';
    itemName: string;
    currency: string;
    unitSalePrice: number;
    threshold: number;
}

/** Un hallazgo de escenario 100 % diluido: sin item concreto ni umbral,
 *  solo el costo que se pierde (ADR-117, B3). */
export interface FullyDilutedScenarioWarning {
    kind: 'FULLY_DILUTED_SCENARIO';
    currency: string;
    dilutedCost: number;
}

/** Un hallazgo, discriminado por kind. */
export type PriceWarning = ItemPriceWarning | FullyDilutedScenarioWarning;

/** Hallazgos agrupados por escenario; solo se incluyen escenarios con al menos un hallazgo. */
export interface ScenarioPriceWarnings {
    scenarioId: string;
    scenarioName: string;
    warnings: PriceWarning[];
}

/**
 * Eval\u00faa un escenario procesado contra los umbrales.
 * Asim\u00e9trico: en COP marca unitarios por DEBAJO del piso; en USD por ENCIMA del techo.
 * Los umbrales solo recorren visibleItems (ya excluye diluidos); el hallazgo de
 * escenario 100 % diluido es la excepcion y no depende de ellos (ADR-117, B3).
 * Funci\u00f3n pura: sin React, sin I/O.
 */
export function getScenarioPriceWarnings(
    scenario: ProcessedScenario,
    thresholds: PriceThresholds,
): PriceWarning[] {
    const warnings: PriceWarning[] = [];
    const currency = scenario.currency;

    // Va ANTES de visibleItems (ADR-117, B3): con todos los items diluidos la
    // lista de visibles queda vacia, asi que este es el unico hallazgo posible,
    // y es el que evita que findProposalPriceWarnings descarte el escenario por
    // no tener ninguno.
    if (scenario.isFullyDiluted) {
        warnings.push({
            kind: 'FULLY_DILUTED_SCENARIO',
            currency,
            dilutedCost: scenario.dilutedCost,
        });
    }

    for (const vi of scenario.visibleItems) {
        const price = vi.unitSalePrice;
        if (currency === 'COP' && price < thresholds.copMinUnitPrice) {
            warnings.push({
                kind: 'COP_BELOW_FLOOR',
                itemName: vi.scenarioItem.item.name,
                currency,
                unitSalePrice: price,
                threshold: thresholds.copMinUnitPrice,
            });
        } else if (currency === 'USD' && price > thresholds.usdMaxUnitPrice) {
            warnings.push({
                kind: 'USD_ABOVE_CEILING',
                itemName: vi.scenarioItem.item.name,
                currency,
                unitSalePrice: price,
                threshold: thresholds.usdMaxUnitPrice,
            });
        }
    }

    return warnings;
}

/**
 * Eval\u00faa todos los escenarios y devuelve solo los que tienen hallazgos.
 * Funci\u00f3n pura: no muta la entrada.
 */
export function findProposalPriceWarnings(
    scenarios: ProcessedScenario[],
    thresholds: PriceThresholds,
): ScenarioPriceWarnings[] {
    return scenarios
        .map((scenario) => ({
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            warnings: getScenarioPriceWarnings(scenario, thresholds),
        }))
        .filter((entry) => entry.warnings.length > 0);
}
