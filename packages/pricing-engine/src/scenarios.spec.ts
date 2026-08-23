import { describe, it, expect } from 'vitest';
import {
    IVA_RATE,
    calculateItemDisplayValues,
    calculateScenarioTotals,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
} from './index';
import type { PricingScenarioItem } from './index';

// ──────────────────────────────────────────────────────────
// GOLDEN TESTS de las 2 funciones compuestas
// (calculateItemDisplayValues, calculateScenarioTotals).
//
// index.spec.ts caracteriza las 12 funciones hoja una por una. Este archivo
// las mira ENSAMBLADAS sobre un escenario mixto, porque las dos compuestas
// duplican el pipeline internamente: si divergen, la UI muestra un precio y
// los totales cobran otro. Los invariantes del final son el testigo de eso.
//
// Mismo principio rector que index.spec.ts: fotografía, no juicio. Los valores
// esperados se derivan a mano de las fórmulas del JSDoc, con la aritmética en
// comentarios por bloques (costo -> landed -> dilución -> precio -> línea).
//
// FIXTURES: formas de producción, números inventados. Ningún costo, margen ni
// nombre de cliente real.
//
// Precisiones: los montos COP van con toBeCloseTo(v, 4) — 0.0001 COP, once
// órdenes de magnitud más fino que un peso — y los porcentajes con precisión 6.
// ──────────────────────────────────────────────────────────

const SCENARIO_CURRENCY = 'COP';
const TRM = 4000;

/**
 * ITEM A — padre importado en USD con un hijo nacional en COP.
 * Forma típica de un equipo importado que se entrega con un accesorio local.
 */
const ITEM_A: PricingScenarioItem = {
    quantity: 2,
    item: {
        unitCost: 1000,
        costCurrency: 'USD',
        internalCosts: { fletePct: 1.5 },
        marginPct: 20,
        isTaxable: true,
    },
    children: [
        {
            quantity: 1,
            item: {
                unitCost: 200000,
                costCurrency: 'COP',
                internalCosts: { fletePct: 0 },
                marginPct: 0,
                isTaxable: true,
            },
        },
    ],
};

/** ITEM B — normal en COP, NO gravado (forma de un servicio exento). */
const ITEM_B: PricingScenarioItem = {
    quantity: 3,
    item: {
        unitCost: 500000,
        costCurrency: 'COP',
        marginPct: 15,
        isTaxable: false,
    },
};

/** ITEM C — diluido: su costo se reparte entre A, B y D en vez de cobrarse. */
const ITEM_C: PricingScenarioItem = {
    quantity: 1,
    isDiluted: true,
    item: {
        unitCost: 300000,
        costCurrency: 'COP',
        marginPct: 30,
        isTaxable: true,
    },
};

/** ITEM D — normal con precio pactado a mano (unitPriceOverride). */
const ITEM_D: PricingScenarioItem = {
    quantity: 1,
    unitPriceOverride: 600000,
    item: {
        unitCost: 400000,
        costCurrency: 'COP',
        marginPct: 10,
        isTaxable: true,
    },
};

const SCENARIO: PricingScenarioItem[] = [ITEM_A, ITEM_B, ITEM_C, ITEM_D];

const displayValuesOf = (si: PricingScenarioItem, items: PricingScenarioItem[] = SCENARIO) =>
    calculateItemDisplayValues(si, items, SCENARIO_CURRENCY, TRM);

// ── Agregados del fixture, derivados a mano ──────────────
//
// Ambos totales usan costo CRUDO convertido x cantidad (sin flete ni hijos):
//   A: 1000 USD x 4000 = 4 000 000 COP, x q2 = 8 000 000   (normal)
//   B:                     500 000 COP, x q3 = 1 500 000   (normal)
//   C:                     300 000 COP, x q1 =   300 000   (DILUIDO)
//   D:                     400 000 COP, x q1 =   400 000   (normal)
//
// totalDilutedCost    =                                       300 000
// totalNormalSubtotal = 8 000 000 + 1 500 000 + 400 000 =    9 900 000
const TOTAL_DILUTED_COST = 300_000;
const TOTAL_NORMAL_SUBTOTAL = 9_900_000;

describe('fixture aggregates', () => {
    it('splits the scenario into 300 000 diluted and 9 900 000 normal', () => {
        // Los dos números que gobiernan toda la dilución del fixture. Si este
        // test cae, todos los golden de abajo mienten por la misma causa.
        expect(calculateTotalDilutedCost(SCENARIO, SCENARIO_CURRENCY, TRM)).toBe(TOTAL_DILUTED_COST);
        expect(calculateTotalNormalSubtotal(SCENARIO, SCENARIO_CURRENCY, TRM)).toBe(TOTAL_NORMAL_SUBTOTAL);
    });
});

describe('calculateItemDisplayValues', () => {
    it('computes the 8 display values for item A (USD parent + COP child)', () => {
        const dv = displayValuesOf(ITEM_A);

        // ── costo ──
        // convertCost(1000, USD, COP, 4000) = 1000 x 4000 = 4 000 000
        // ── landed ──
        // parentLanded = 4 000 000 x (1 + 1.5/100) = 4 000 000 x 1.015 = 4 060 000
        expect(dv.parentLandedCost).toBeCloseTo(4_060_000, 4);
        // childrenCost = 200 000 x (1 + 0/100) x q1 = 200 000   (TOTAL, no per-unit)
        expect(dv.childrenCostPerUnit).toBeCloseTo(200_000, 4);
        // baseLanded = 4 060 000 + 200 000/q2 = 4 060 000 + 100 000 = 4 160 000
        expect(dv.baseLandedCost).toBeCloseTo(4_160_000, 4);

        // ── dilución ──
        // weight = (4 000 000 x q2) / 9 900 000 = 8 000 000/9 900 000 = 80/99
        // perUnit = (80/99 x 300 000) / q2 = 24 000 000/198 = 121 212.1212...
        expect(dv.dilutionPerUnit).toBeCloseTo(121_212.121212, 4);
        // effectiveLanded = 4 160 000 + 121 212.1212... = 4 281 212.1212...
        expect(dv.effectiveLandedCost).toBeCloseTo(4_281_212.121212, 4);

        // ── precio ──
        // margin = resolveMargin(undefined, 20) = 20  (sin override)
        expect(dv.margin).toBe(20);
        // unitPrice = 4 281 212.1212... / (1 - 20/100) = .../0.8 = 5 351 515.1515...
        expect(dv.unitPrice).toBeCloseTo(5_351_515.151515, 4);

        // ── línea ──
        // lineTotal = 5 351 515.1515... x q2 = 10 703 030.3030...
        expect(dv.lineTotal).toBeCloseTo(10_703_030.30303, 4);
    });

    it('computes the 8 display values for item B (normal, non-taxable)', () => {
        const dv = displayValuesOf(ITEM_B);

        // ── costo ── misma moneda: 500 000 sin convertir
        // ── landed ── sin internalCosts, flete 0; sin hijos
        expect(dv.parentLandedCost).toBe(500_000);
        expect(dv.childrenCostPerUnit).toBe(0);
        // baseLanded = 500 000 + 0/q3 = 500 000
        expect(dv.baseLandedCost).toBe(500_000);

        // ── dilución ──
        // weight = (500 000 x q3) / 9 900 000 = 1 500 000/9 900 000 = 15/99
        // perUnit = (15/99 x 300 000) / q3 = 45 454.5454.../3 = 15 151.5151...
        expect(dv.dilutionPerUnit).toBeCloseTo(15_151.515152, 4);
        // effectiveLanded = 500 000 + 15 151.5151... = 515 151.5151...
        expect(dv.effectiveLandedCost).toBeCloseTo(515_151.515152, 4);

        // ── precio ──
        expect(dv.margin).toBe(15);
        // unitPrice = 515 151.5151... / 0.85 = 606 060.6060...
        expect(dv.unitPrice).toBeCloseTo(606_060.606061, 4);

        // ── línea ──
        // lineTotal = 606 060.6060... x q3 = 1 818 181.8181...
        expect(dv.lineTotal).toBeCloseTo(1_818_181.818182, 4);
    });

    it('uses unitPriceOverride verbatim as the unit price for item D', () => {
        const dv = displayValuesOf(ITEM_D);

        // El override entra tal cual, sin pasar por la fórmula de margen.
        expect(dv.unitPrice).toBe(600_000);
        // lineTotal = 600 000 x q1 = 600 000
        expect(dv.lineTotal).toBe(600_000);
    });

    it('recomputes the displayed margin from the override, not from the base margin', () => {
        const dv = displayValuesOf(ITEM_D);

        // ── costo/landed ── 400 000, flete 0, sin hijos -> baseLanded 400 000
        expect(dv.baseLandedCost).toBe(400_000);
        // ── dilución ──
        // weight = (400 000 x q1)/9 900 000 = 4/99
        // perUnit = (4/99 x 300 000)/q1 = 1 200 000/99 = 12 121.2121...
        expect(dv.dilutionPerUnit).toBeCloseTo(12_121.212121, 4);
        // effectiveLanded = 400 000 + 12 121.2121... = 412 121.2121...
        expect(dv.effectiveLandedCost).toBeCloseTo(412_121.212121, 4);

        // ── margen mostrado ──
        // calculateMarginFromPrice(600 000, 412 121.2121...)
        //   = ((600 000 - 412 121.2121...) / 600 000) x 100
        //   = (187 878.7878... / 600 000) x 100 = 31.3131...%
        // NO es el marginPct base del item (10).
        expect(dv.margin).toBeCloseTo(31.31313131, 6);
        expect(dv.margin).not.toBe(ITEM_D.item.marginPct);
    });

    it('prices a diluted item at 0 even though it carries a margin', () => {
        const dv = displayValuesOf(ITEM_C);

        // caracterización: todo el bloque de precio vive dentro de
        // `if (!si.isDiluted)`, asi que un item diluido nunca lo ejecuta y su
        // unitPrice se queda en el 0 inicial. Su costo sí se calcula y se
        // reparte, pero la línea no se cobra: es justo el punto de la dilución.
        expect(dv.unitPrice).toBe(0);
        expect(dv.lineTotal).toBe(0);

        // El costo sí existe: 300 000, flete 0, sin hijos.
        expect(dv.baseLandedCost).toBe(300_000);
        expect(dv.effectiveLandedCost).toBe(300_000);
    });

    it('leaves a diluted item at its base margin instead of zeroing it', () => {
        const dv = displayValuesOf(ITEM_C);

        // caracterización: displayMargin arranca en baseMargin y solo se
        // recalcula dentro del bloque `if (!si.isDiluted)`. Un item diluido
        // reporta margen 30% junto a un precio de 0 — una combinación que no
        // significa nada y que la UI puede mostrar como si fuera un margen real.
        expect(dv.margin).toBe(30);
        expect(dv.unitPrice).toBe(0);
    });

    it('ignores unitPriceOverride on a diluted item', () => {
        // caracterización: la rama del override también está dentro de
        // `if (!si.isDiluted)`, asi que un precio pactado a mano sobre un item
        // diluido se descarta EN SILENCIO. Quien lo capture en la UI ve su
        // número guardado y un precio de 0 en la cotización.
        const dilutedWithOverride: PricingScenarioItem = { ...ITEM_C, unitPriceOverride: 999_999 };
        const items = [ITEM_A, ITEM_B, dilutedWithOverride, ITEM_D];
        const dv = displayValuesOf(dilutedWithOverride, items);

        expect(dv.unitPrice).toBe(0);
        expect(dv.lineTotal).toBe(0);
    });
});

describe('calculateScenarioTotals', () => {
    it('computes the 6 totals for the mixed scenario', () => {
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);

        // C queda fuera del bucle (filter !isDiluted). Líneas que sí entran:
        //   A gravado:     10 703 030.3030...
        //   D gravado:        600 000
        //   B NO gravado:   1 818 181.8181...
        //
        // beforeVat = 10 703 030.3030... + 600 000 = 11 303 030.3030...
        expect(totals.beforeVat).toBeCloseTo(11_303_030.30303, 4);
        // nonTaxed  = 1 818 181.8181...
        expect(totals.nonTaxed).toBeCloseTo(1_818_181.818182, 4);
        // subtotal  = beforeVat + nonTaxed = 13 121 212.1212...
        expect(totals.subtotal).toBeCloseTo(13_121_212.121212, 4);

        // golden H1: única implementación de IVA que debe sobrevivir.
        // vat = beforeVat x 0.19 = 11 303 030.3030... x 0.19 = 2 147 575.7575...
        // El IVA se aplica SOLO a la base gravada; los 1 818 181.81 de B no
        // entran. Cualquier otro cálculo de IVA en el repo debe converger aquí
        // o desaparecer.
        expect(totals.vat).toBeCloseTo(2_147_575.757576, 4);

        // total = beforeVat + vat + nonTaxed = 15 268 787.8787...
        expect(totals.total).toBeCloseTo(15_268_787.878788, 4);

        // totalCost = Σ effectiveLanded x cantidad sobre los items normales
        //   A: 4 281 212.1212... x q2 =  8 562 424.2424...
        //   B:   515 151.5151... x q3 =  1 545 454.5454...
        //   D:   412 121.2121... x q1 =    412 121.2121...
        //   = 10 520 000  (= 10 220 000 de landed + los 300 000 diluidos)
        // globalMarginPct = ((13 121 212.1212 - 10 520 000)/13 121 212.1212) x 100
        //                 = (2 601 212.1212/13 121 212.1212) x 100 = 19.8244...%
        expect(totals.globalMarginPct).toBeCloseTo(19.82448037, 6);
    });

    it('applies IVA_RATE to the taxable base only', () => {
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);

        // golden H1: única implementación de IVA que debe sobrevivir.
        // Escrito como relación y no como literal, para que siga siendo el
        // testigo si algún día cambia la tarifa: el IVA es beforeVat x IVA_RATE,
        // nunca subtotal x IVA_RATE.
        expect(totals.vat).toBeCloseTo(totals.beforeVat * IVA_RATE, 4);
        expect(totals.vat).not.toBeCloseTo(totals.subtotal * IVA_RATE, 4);
        // Y el total cierra: subtotal + IVA.
        expect(totals.total).toBeCloseTo(totals.subtotal + totals.vat, 4);
    });

    it('returns all six totals as 0 for an empty scenario', () => {
        const totals = calculateScenarioTotals([], SCENARIO_CURRENCY, TRM);

        expect(totals.beforeVat).toBe(0);
        expect(totals.nonTaxed).toBe(0);
        expect(totals.subtotal).toBe(0);
        expect(totals.vat).toBe(0);
        expect(totals.total).toBe(0);
        // globalMarginPct cae al guard `totalPrice > 0 ? ... : 0`.
        expect(totals.globalMarginPct).toBe(0);
    });

    it('returns all zeros for a scenario of diluted items only', () => {
        // caracterización: los 300 000 de costo de C DESAPARECEN. El bucle solo
        // recorre items normales, asi que sin un item normal que los reciba el
        // costo diluido no se reparte ni se cobra: no aparece en ningún total y
        // tampoco en globalMarginPct. Un escenario 100% diluido se cotiza en $0
        // con un costo real de 300 000 — pérdida total, sin ninguna señal.
        const totals = calculateScenarioTotals([ITEM_C], SCENARIO_CURRENCY, TRM);

        expect(totals.beforeVat).toBe(0);
        expect(totals.nonTaxed).toBe(0);
        expect(totals.subtotal).toBe(0);
        expect(totals.vat).toBe(0);
        expect(totals.total).toBe(0);
        expect(totals.globalMarginPct).toBe(0);
        // Pero el costo diluido sí existe y es exactamente lo que se pierde:
        expect(calculateTotalDilutedCost([ITEM_C], SCENARIO_CURRENCY, TRM)).toBe(300_000);
    });
});

describe('coherence invariants between the two composite functions', () => {
    it('invariant 1: the display line totals sum to the scenario subtotal', () => {
        // Si esto cae, la UI (que pinta calculateItemDisplayValues por fila)
        // muestra números que no suman lo que cobra calculateScenarioTotals.
        // Hoy la coincidencia es exacta al bit; se asierta con toBeCloseTo para
        // tolerar un reordenamiento de operaciones que siga siendo correcto.
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const sumOfLineTotals = SCENARIO
            .filter((si) => !si.isDiluted)
            .reduce((acc, si) => acc + displayValuesOf(si).lineTotal, 0);

        expect(sumOfLineTotals).toBeCloseTo(totals.subtotal, 6);
    });

    it('invariant 2: the taxable / non-taxable split agrees item by item', () => {
        // Desglosa el invariante 1 por el mismo criterio que usan los totales
        // (si.item.isTaxable), asi que un unitPrice que difiera en UN item ya no
        // se puede cancelar contra otro: cada mitad tiene que cuadrar sola.
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const normalItems = SCENARIO.filter((si) => !si.isDiluted);

        const taxableSum = normalItems
            .filter((si) => si.item.isTaxable)
            .reduce((acc, si) => acc + displayValuesOf(si).lineTotal, 0);
        const nonTaxableSum = normalItems
            .filter((si) => !si.item.isTaxable)
            .reduce((acc, si) => acc + displayValuesOf(si).lineTotal, 0);

        expect(taxableSum).toBeCloseTo(totals.beforeVat, 6);
        expect(nonTaxableSum).toBeCloseTo(totals.nonTaxed, 6);
    });

    it('invariant 3: removing the diluted item lowers total cost by exactly its cost', () => {
        // La conservación se cumple sobre el COSTO, no sobre el precio.
        // totalCost no se retorna, pero se recupera de globalMarginPct:
        //   globalMarginPct = ((totalPrice - totalCost)/totalPrice) x 100
        //   => totalCost = totalPrice x (1 - globalMarginPct/100)
        const withC = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const withoutC = calculateScenarioTotals(
            [ITEM_A, ITEM_B, ITEM_D], SCENARIO_CURRENCY, TRM,
        );

        const costWithC = withC.subtotal * (1 - withC.globalMarginPct / 100);
        const costWithoutC = withoutC.subtotal * (1 - withoutC.globalMarginPct / 100);

        // 10 520 000 - 10 220 000 = 300 000 = el costo de C, ni un peso más.
        expect(costWithC).toBeCloseTo(10_520_000, 4);
        expect(costWithoutC).toBeCloseTo(10_220_000, 4);
        expect(costWithC - costWithoutC).toBeCloseTo(TOTAL_DILUTED_COST, 4);
    });

    it('invariant 3b: the subtotal rises by the diluted cost MARKED UP, not by the cost', () => {
        // caracterización: la dilución entra como costo y sale marcada por el
        // margen de cada item, asi que el subtotal NO sube los 300 000.
        //   A: 242 424.2424 de costo, marcado /0.8  -> 303 030.3030 de precio
        //   B:  45 454.5454 de costo, marcado /0.85 ->  53 475.9358 de precio
        //   D:  12 121.2121 de costo, precio FIJADO ->       0      de precio
        //   Σ = 356 506.2388 > 300 000
        const withC = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const withoutC = calculateScenarioTotals(
            [ITEM_A, ITEM_B, ITEM_D], SCENARIO_CURRENCY, TRM,
        );

        expect(withC.subtotal - withoutC.subtotal).toBeCloseTo(356_506.238859, 4);
        expect(withC.subtotal - withoutC.subtotal).not.toBeCloseTo(TOTAL_DILUTED_COST, 4);
    });

    it('invariant 3c: an overridden price absorbs its dilution share as lost margin', () => {
        // caracterización: el item D no puede repercutir su dilución porque su
        // precio está fijado, asi que absorbe los 12 121.2121 como margen menor.
        //   sin C: margen = ((600 000 - 400 000)/600 000) x 100 = 33.3333...%
        //   con C: margen = ((600 000 - 412 121.2121)/600 000) x 100 = 31.3131...%
        // Dos puntos de margen que se van sin que el precio se mueva. Es el modo
        // de falla que importa en DaaS: diluir un servicio sobre items con precio
        // pactado no encarece la cotización, erosiona el margen en silencio.
        const withoutC = [ITEM_A, ITEM_B, ITEM_D];

        const marginWithC = displayValuesOf(ITEM_D).margin;
        const marginWithoutC = displayValuesOf(ITEM_D, withoutC).margin;

        expect(marginWithoutC).toBeCloseTo(33.33333333, 6);
        expect(marginWithC).toBeCloseTo(31.31313131, 6);
        expect(marginWithC).toBeLessThan(marginWithoutC);

        // Y el precio no se movió ni un peso.
        expect(displayValuesOf(ITEM_D).unitPrice).toBe(displayValuesOf(ITEM_D, withoutC).unitPrice);
    });
});
