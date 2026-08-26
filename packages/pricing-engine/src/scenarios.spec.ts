import { describe, it, expect } from 'vitest';
import {
    IVA_RATE,
    calculateBaseLandedCost,
    calculateChildrenCostPerUnit,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateItemDisplayValues,
    calculateItemLandedTotal,
    calculateParentLandedCost,
    calculateScenarioTotals,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    calculateUnitPrice,
    convertCost,
    resolveMargin,
    roundMoney,
    roundMoneyUp,
} from './index';
import type { ItemDisplayValues, PricingScenarioItem, ScenarioTotals } from './index';

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
// POLÍTICA DE REDONDEO (ADR-113). Las funciones HOJA siguen a precisión
// completa; las dos COMPUESTAS entregan dinero YA REDONDEADO con roundMoney a
// la moneda del escenario. Consecuencias para este archivo:
//
//   - En el fixture COP todo monto retornado es un ENTERO, así que los asserts
//     de dinero son toBe exacto, no toBeCloseTo(v, 4). La aritmética del
//     comentario muestra el valor a precisión completa Y el punto de redondeo.
//   - Los invariantes de coherencia entre las dos compuestas pasan de
//     toBeCloseTo a igualdad EXACTA: ambas redondean en el mismo punto, así que
//     las sumas de líneas redondeadas coinciden al bit.
//   - Los PORCENTAJES (margin, globalMarginPct) no son dinero y siguen a
//     precisión completa: se asiertan con toBeCloseTo(v, 6) como antes.
//   - La cadena que el cliente puede rehacer a mano cuadra exacta:
//     unitPrice x quantity = lineTotal, Σ lineTotal = subtotal,
//     vat = roundMoney(IVA de beforeVat), total = subtotal + vat.
//   - MODO TECHO (ADR-114): SOLO el unitPrice pasa por roundMoneyUp — el
//     unitario cotizado nunca queda por debajo de su valor exacto (rama de
//     override incluida). Líneas, IVA, totales y columnas de costo siguen en
//     roundMoney. El invariante 7 deriva el precio exacto por las hoja y
//     verifica la garantía en ambos fixtures.
//
// POLÍTICA DE DILUCIÓN (ADR-115). El costo que se reparte y los pesos que lo
// reparten son LANDED y convertidos: costo en la moneda del escenario + flete
// del padre + costo total de los hijos (la misma matemática de
// baseLandedCost x cantidad). Antes ambos lados usaban el costo CRUDO, así que
// el flete y los hijos de un item diluido se evaporaban de la cotización.
// Consecuencias para este archivo:
//
//   - El fixture COP se mueve entero por el lado de la dilución: su denominador
//     sube de 9 900 000 (crudo) a 10 220 000 (landed) porque el item A tiene
//     flete Y un hijo, así que su peso landed difiere de su peso crudo. Los
//     otros dos normales (B y D) no tienen ni flete ni hijos: cambian solo
//     porque el denominador cambió.
//   - El fixture USD NO se mueve, y eso se verificó contra runtime en vez de
//     asumirse: sus tres items no tienen flete ni hijos y no hay item diluido,
//     así que landed == crudo y la dilución sigue siendo 0.
//   - El invariante 3 (libro de costos) no se mueve ni un peso: totalCost ya
//     era landed + diluido. Lo que sí cambia es que ahora el costo sin C
//     coincide EXACTAMENTE con totalNormalSubtotal, porque los dos son landed.
//   - El golden del caso real de ADR-115, al final, es el que fija la magnitud
//     del bug corregido: 10,80 USD en un escenario de 65 mil.
//
// Todos los valores de abajo se re-derivaron contra runtime tras el cambio.
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

// ── Fixture USD: la misma forma, pero con CENTAVOS ───────
//
// El fixture COP no puede ejercitar el caso interesante del redondeo a
// centavos: en pesos enteros, precio_redondeado x cantidad_entera nunca
// arrastra ruido IEEE 754. Con factor 100 sí, y es justo el caso que la
// política tiene que absorber para que la línea impresa cuadre.
//
// Escenario en USD, items en USD: convertCost no interviene (misma moneda) y
// no hay item diluido, así que la dilución es 0 y el foco queda en el precio.
//
// Ni un valor de este fixture se movió con ADR-115, y se verificó contra runtime
// en vez de asumirse: sus tres items no tienen flete ni hijos (landed == crudo) y
// sin item diluido el guard de calculateDilutionPerUnit devuelve 0 igual que
// antes. Es el contraste que aísla la causa: lo que se movió en el fixture COP
// se movió por el flete y el hijo de A, no por el cambio en general.
const USD_CURRENCY = 'USD';

/** USD 1 — precio con mitad exacta (1.125) y cantidad 3: el ruido clásico. */
const USD_ITEM_1: PricingScenarioItem = {
    quantity: 3,
    item: { unitCost: 0.9, costCurrency: 'USD', marginPct: 20, isTaxable: true },
};

/** USD 2 — precio con cola infinita (10/0.67) y cantidad 7. */
const USD_ITEM_2: PricingScenarioItem = {
    quantity: 7,
    item: { unitCost: 10, costCurrency: 'USD', marginPct: 33, isTaxable: true },
};

/** USD 3 — override tecleado con TRES decimales, no gravado. */
const USD_ITEM_3: PricingScenarioItem = {
    quantity: 1,
    unitPriceOverride: 1234.567,
    item: { unitCost: 800, costCurrency: 'USD', marginPct: 10, isTaxable: false },
};

const USD_SCENARIO: PricingScenarioItem[] = [USD_ITEM_1, USD_ITEM_2, USD_ITEM_3];

const usdDisplayValuesOf = (si: PricingScenarioItem) =>
    calculateItemDisplayValues(si, USD_SCENARIO, USD_CURRENCY, null);

/** Campos de dinero de cada retorno. Los porcentajes quedan fuera a propósito. */
const MONEY_FIELDS_OF_ITEM: Array<keyof ItemDisplayValues> = [
    'parentLandedCost',
    'childrenCostPerUnit',
    'baseLandedCost',
    'dilutionPerUnit',
    'effectiveLandedCost',
    'unitPrice',
    'lineTotal',
];
const MONEY_FIELDS_OF_TOTALS: Array<keyof ScenarioTotals> = [
    'beforeVat',
    'nonTaxed',
    'subtotal',
    'vat',
    'total',
];

// ── Agregados del fixture, derivados a mano ──────────────
//
// Ambos totales usan el LANDED convertido de cada item (ADR-115): costo
// convertido + flete del padre, x cantidad, + costo total de los hijos.
//   A: 1000 USD x 4000 = 4 000 000 -> x1.015 = 4 060 000, x q2 + 200 000 hijo
//                                            = 8 320 000   (normal)
//   B:                     500 000 sin flete ni hijos, x q3
//                                            = 1 500 000   (normal)
//   C:                     300 000 sin flete ni hijos, x q1
//                                            =   300 000   (DILUIDO)
//   D:                     400 000 sin flete ni hijos, x q1
//                                            =   400 000   (normal)
//
// totalDilutedCost    =                                       300 000
// totalNormalSubtotal = 8 320 000 + 1 500 000 + 400 000 =   10 220 000
//
// SE MOVIÓ: el denominador era 9 900 000 con costo crudo. Los 320 000 de
// diferencia son el flete de A (60 000 x q2) y su hijo (200 000) entrando al
// peso, que es exactamente lo que el reparto crudo ignoraba. El numerador NO se
// movió porque C no tiene flete ni hijos — el fixture COP prueba el lado de los
// pesos; el golden del caso real de abajo prueba el lado del total repartido.
const TOTAL_DILUTED_COST = 300_000;
const TOTAL_NORMAL_SUBTOTAL = 10_220_000;

describe('fixture aggregates', () => {
    it('splits the scenario into 300 000 diluted and 10 220 000 landed normal', () => {
        // Los dos números que gobiernan toda la dilución del fixture. Si este
        // test cae, todos los golden de abajo mienten por la misma causa.
        // Funciones HOJA: siguen a precisión completa, la política no las toca.
        expect(calculateTotalDilutedCost(SCENARIO, SCENARIO_CURRENCY, TRM)).toBe(TOTAL_DILUTED_COST);
        expect(calculateTotalNormalSubtotal(SCENARIO, SCENARIO_CURRENCY, TRM)).toBe(TOTAL_NORMAL_SUBTOTAL);
        // Y el denominador es la suma de los landed totales de los normales, no
        // de sus costos crudos. El valor viejo queda escrito como testigo.
        const landedOfNormals = SCENARIO
            .filter((si) => !si.isDiluted)
            .reduce((acc, si) => acc + calculateItemLandedTotal(si, SCENARIO_CURRENCY, TRM), 0);
        expect(landedOfNormals).toBe(TOTAL_NORMAL_SUBTOTAL);
        expect(calculateTotalNormalSubtotal(SCENARIO, SCENARIO_CURRENCY, TRM)).not.toBe(9_900_000);
    });
});

describe('calculateItemDisplayValues', () => {
    it('computes the 8 display values for item A (USD parent + COP child)', () => {
        const dv = displayValuesOf(ITEM_A);

        // ── costo ──
        // convertCost(1000, USD, COP, 4000) = 1000 x 4000 = 4 000 000
        // ── landed ── (cadena interna a precisión completa, redondeo a la salida)
        // parentLanded = 4 000 000 x (1 + 1.5/100) = 4 000 000 x 1.015 = 4 060 000
        expect(dv.parentLandedCost).toBe(4_060_000);
        // childrenCost = 200 000 x (1 + 0/100) x q1 = 200 000   (TOTAL, no per-unit)
        expect(dv.childrenCostPerUnit).toBe(200_000);
        // baseLanded = 4 060 000 + 200 000/q2 = 4 060 000 + 100 000 = 4 160 000
        expect(dv.baseLandedCost).toBe(4_160_000);

        // ── dilución ── (ADR-115: el peso es el LANDED de A, no su crudo)
        // weight = (4 160 000 x q2) / 10 220 000 = 8 320 000/10 220 000 = 416/511
        // perUnit = (416/511 x 300 000) / q2 = 124 800 000/511/2 = 122 113.5029...
        //   -> roundMoney COP SUBE a 122 114 (la cola .5029 pasa de medio peso)
        // Con el peso crudo (80/99) daban 121 212: A pesaba menos de lo que
        // cuesta, así que recibía menos dilución de la que le toca.
        expect(dv.dilutionPerUnit).toBe(122_114);
        expect(dv.dilutionPerUnit).not.toBe(121_212);
        // effectiveLanded = 4 160 000 + 122 113.5029... = 4 282 113.5029...
        //   -> 4 282 114
        expect(dv.effectiveLandedCost).toBe(4_282_114);

        // ── precio ──
        // margin = resolveMargin(undefined, 20) = 20. Es PORCENTAJE: no se
        // redondea, sale tal cual.
        expect(dv.margin).toBe(20);
        // El precio se calcula sobre el effective SIN redondear y se TECHA al
        // salir (ADR-114): 4 282 113.5029.../(1 - 20/100) = 5 352 641.8787...
        //   -> roundMoneyUp = 5 352 642 (half-up daba 5 352 642 también aquí;
        //   el techo sigue verificado por el invariante 7).
        expect(dv.unitPrice).toBe(5_352_642);

        // ── línea ── se construye sobre el precio YA TECHADO:
        // 5 352 642 x q2 = 10 705 284 exacto (entero x entero).
        expect(dv.lineTotal).toBe(10_705_284);
    });

    it('computes the 8 display values for item B (normal, non-taxable)', () => {
        const dv = displayValuesOf(ITEM_B);

        // ── costo ── misma moneda: 500 000 sin convertir
        // ── landed ── sin internalCosts, flete 0; sin hijos
        expect(dv.parentLandedCost).toBe(500_000);
        expect(dv.childrenCostPerUnit).toBe(0);
        // baseLanded = 500 000 + 0/q3 = 500 000
        expect(dv.baseLandedCost).toBe(500_000);

        // ── dilución ── B no tiene flete ni hijos, así que su LANDED es su
        // crudo: se mueve solo porque el denominador pasó a 10 220 000 (ADR-115).
        // weight = (500 000 x q3) / 10 220 000 = 1 500 000/10 220 000 = 75/511
        // perUnit = (75/511 x 300 000) / q3 = 22 500 000/511/3 = 14 677.1037...
        //   -> roundMoney COP baja a 14 677 (.1037 no llega a medio peso)
        // Menos que los 15 152 de antes: A ahora pesa lo que cuesta y se lleva
        // la parte que B recibía de más.
        expect(dv.dilutionPerUnit).toBe(14_677);
        // effectiveLanded = 500 000 + 14 677.1037... = 514 677.1037... -> 514 677
        expect(dv.effectiveLandedCost).toBe(514_677);

        // ── precio ──
        expect(dv.margin).toBe(15);
        // 514 677.1037.../0.85 = 605 502.4749... -> techo 605 503 (ADR-114;
        // half-up ya subía aquí, así que B no se mueve con el cambio de modo).
        expect(dv.unitPrice).toBe(605_503);

        // ── línea ── AQUÍ SE VE LA POLÍTICA (ADR-113).
        // La línea se construye sobre el precio REDONDEADO, no sobre el exacto:
        //   605 503         x q3 = 1 816 509           <- lo que se imprime
        //   605 502.4749... x q3 = 1 816 507.4248...   -> redondeado: 1 816 507
        // Se eligen los 1 816 509 A PROPÓSITO: el cliente multiplica el precio
        // que ve por 3 y le tiene que cuadrar. Los dos pesos de diferencia
        // contra el cálculo a precisión completa son el precio de esa garantía.
        expect(dv.lineTotal).toBe(1_816_509);
        expect(dv.lineTotal).not.toBe(1_816_507);
    });

    it('uses unitPriceOverride verbatim as the unit price for item D', () => {
        const dv = displayValuesOf(ITEM_D);

        // El override entra sin pasar por la fórmula de margen, pero SÍ por el
        // techo (ADR-114): 600 000 ya es un entero de pesos, así que sale igual.
        expect(dv.unitPrice).toBe(600_000);
        // lineTotal = 600 000 x q1 = 600 000
        expect(dv.lineTotal).toBe(600_000);
    });

    it('recomputes the displayed margin from the override, not from the base margin', () => {
        const dv = displayValuesOf(ITEM_D);

        // ── costo/landed ── 400 000, flete 0, sin hijos -> baseLanded 400 000
        expect(dv.baseLandedCost).toBe(400_000);
        // ── dilución ── sin flete ni hijos: landed == crudo, se mueve solo por
        // el denominador nuevo (ADR-115).
        // weight = (400 000 x q1)/10 220 000 = 20/511
        // perUnit = (20/511 x 300 000)/q1 = 6 000 000/511 = 11 741.6829... -> 11 742
        expect(dv.dilutionPerUnit).toBe(11_742);
        // effectiveLanded = 400 000 + 11 741.6829... = 411 741.6829... -> 411 742
        expect(dv.effectiveLandedCost).toBe(411_742);

        // ── margen mostrado ──
        // Se recalcula sobre los valores REDONDEADOS, que son los que el usuario
        // ve en pantalla: calculateMarginFromPrice(600 000, 411 742)
        //   = ((600 000 - 411 742) / 600 000) x 100
        //   = (188 258 / 600 000) x 100 = 31.3763333...%
        // Sobre el effective sin redondear daría 31.37638617%; la diferencia
        // (5.3e-5 puntos) es el precio de que la columna y el margen cuenten la
        // misma historia. Sigue sin ser el marginPct base del item (10).
        expect(dv.margin).toBeCloseTo(31.37633333, 6);
        expect(dv.margin).not.toBe(ITEM_D.item.marginPct);
    });

    it('prices a diluted item at 0 even though it carries a margin', () => {
        const dv = displayValuesOf(ITEM_C);

        // caracterización: todo el bloque de precio vive dentro de
        // `if (!si.isDiluted)`, asi que un item diluido nunca lo ejecuta y su
        // unitPrice se queda en el 0 inicial. Su costo sí se calcula y se
        // reparte, pero la línea no se cobra: es justo el punto de la dilución.
        // El redondeo no lo altera: roundMoney(0) es 0.
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

        // C queda fuera del bucle (filter !isDiluted). Líneas que sí entran, ya
        // redondeadas por la misma política que usa calculateItemDisplayValues
        // (unitario TECHADO por ADR-114, línea en half-up):
        //   A gravado:     10 705 284   (5 352 642 x 2, unitario techado)
        //   D gravado:        600 000
        //   B NO gravado:   1 816 509
        //
        // beforeVat = 10 705 284 + 600 000 = 11 305 284
        // Suma EXACTA de enteros: no hay redondeo adicional que aplicar.
        expect(totals.beforeVat).toBe(11_305_284);
        // nonTaxed = 1 816 509
        expect(totals.nonTaxed).toBe(1_816_509);
        // subtotal = beforeVat + nonTaxed = 13 121 793
        // A precisión completa eran 13 121 791.1822...: los 1.82 de deriva son
        // 0.24 de A (0.1213 de techo x q2) y 1.58 de B (0.5250 x q3), o sea el
        // costo de que la línea se construya sobre el unitario ya redondeado.
        expect(totals.subtotal).toBe(13_121_793);

        // golden H1: única implementación de IVA que debe sobrevivir.
        // vat = roundMoney(calculateIvaAmount(11 305 284, true))
        //     = roundMoney(11 305 284 x 0.19) = roundMoney(2 148 003.96) = 2 148 004
        // El IVA se aplica SOLO a la base gravada; los 1 816 509 de B no entran.
        // Cualquier otro cálculo de IVA en el repo debe converger aquí o
        // desaparecer. Nótese que se redondea DESPUÉS de aplicar la tarifa: el
        // IVA que se cobra es el de la base gravada impresa.
        expect(totals.vat).toBe(2_148_004);

        // total = subtotal + vat = 13 121 793 + 2 148 004 = 15 269 797
        expect(totals.total).toBe(15_269_797);

        // totalCost = Σ effectiveLanded x cantidad sobre los items normales, a
        // PRECISIÓN COMPLETA (nunca se imprime, solo alimenta el porcentaje):
        //   A: 4 282 113.5029... x q2 =  8 564 227.0058...
        //   B:   514 677.1037... x q3 =  1 544 031.3111...
        //   D:   411 741.6829... x q1 =    411 741.6829...
        //   = 10 520 000  (= 10 220 000 de landed + los 300 000 diluidos)
        // El TOTAL de costo no se movió con ADR-115 —los 300 000 se reparten
        // distinto, no cambian de tamaño— pero ahora sus 10 220 000 de landed
        // son literalmente totalNormalSubtotal. Es la conservación en el libro.
        // globalMarginPct = ((13 121 793 - 10 520 000)/13 121 793) x 100
        //                 = (2 601 793/13 121 793) x 100 = 19.8280295...%
        expect(totals.globalMarginPct).toBeCloseTo(19.82802960, 6);
    });

    it('returns every money total as a whole peso in the COP scenario', () => {
        // Corolario directo de la política en COP: no existe un total con
        // decimales que un documento tenga que truncar por su cuenta.
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);

        for (const field of MONEY_FIELDS_OF_TOTALS) {
            expect(Number.isInteger(totals[field])).toBe(true);
        }
        // Y el porcentaje NO es entero: es el contraste que prueba que la
        // política distingue dinero de porcentaje en vez de redondear todo.
        expect(Number.isInteger(totals.globalMarginPct)).toBe(false);
    });

    it('applies IVA_RATE to the taxable base only', () => {
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);

        // golden H1: única implementación de IVA que debe sobrevivir.
        // Escrito como relación y no como literal, para que siga siendo el
        // testigo si algún día cambia la tarifa: el IVA es beforeVat x IVA_RATE
        // redondeado, nunca subtotal x IVA_RATE.
        // Igualdad EXACTA ahora: los dos lados pasan por el mismo roundMoney.
        expect(totals.vat).toBe(roundMoney(totals.beforeVat * IVA_RATE, SCENARIO_CURRENCY));
        expect(totals.vat).not.toBe(roundMoney(totals.subtotal * IVA_RATE, SCENARIO_CURRENCY));
        // Y el total cierra EXACTO: subtotal + IVA, sin cola que explicar.
        expect(totals.total).toBe(totals.subtotal + totals.vat);
    });

    it('returns all six totals as 0 for an empty scenario', () => {
        const totals = calculateScenarioTotals([], SCENARIO_CURRENCY, TRM);

        expect(totals.beforeVat).toBe(0);
        expect(totals.nonTaxed).toBe(0);
        expect(totals.subtotal).toBe(0);
        // vat = roundMoney(calculateIvaAmount(0, true)) = roundMoney(0) = 0.
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

// ──────────────────────────────────────────────────────────
// Fixture USD — la cadena impresa con CENTAVOS.
//
// Es el caso que el fixture COP no puede producir: precio_redondeado x
// cantidad_entera con ruido IEEE 754, absorbido por el round exterior.
// ──────────────────────────────────────────────────────────

describe('calculateItemDisplayValues in USD (cents)', () => {
    it('absorbs the noise of a rounded price times a quantity (USD item 1)', () => {
        const dv = usdDisplayValuesOf(USD_ITEM_1);

        // ── landed ── misma moneda, sin flete, sin hijos, sin dilución.
        expect(dv.effectiveLandedCost).toBe(0.9);
        // ── precio ── 0.9/(1 - 20/100) = 0.9/0.8 = 1.125 (mitad EXACTA en
        // binario: 9/8). roundMoney USD: 1.125 x 100 = 112.5 -> 113 -> 1.13.
        expect(dv.unitPrice).toBe(1.13);
        // ── línea ── sobre el precio redondeado: 1.13 x 3, que en IEEE 754 da
        // 3.3899999999999997 y NO 3.39. El round exterior lo absorbe.
        expect(dv.lineTotal).toBe(3.39);
        // El testigo del ruido: la multiplicación cruda no es el valor impreso,
        // pero redondeada sí. Es exactamente lo que la política existe para
        // tapar antes de que llegue a un documento.
        expect(dv.unitPrice * USD_ITEM_1.quantity).not.toBe(dv.lineTotal);
        expect(roundMoney(dv.unitPrice * USD_ITEM_1.quantity, USD_CURRENCY)).toBe(dv.lineTotal);
    });

    it('absorbs the noise of an infinite-tail price times a quantity (USD item 2)', () => {
        const dv = usdDisplayValuesOf(USD_ITEM_2);

        // ── precio ── 10/(1 - 33/100) = 10/0.67 = 14.925373134328357
        //   x 100 = 1492.5373... -> 1493 -> 14.93
        expect(dv.unitPrice).toBe(14.93);
        // ── línea ── 14.93 x 7 = 104.50999999999999 en IEEE 754 -> 104.51
        expect(dv.lineTotal).toBe(104.51);
        expect(dv.unitPrice * USD_ITEM_2.quantity).not.toBe(dv.lineTotal);
        expect(roundMoney(dv.unitPrice * USD_ITEM_2.quantity, USD_CURRENCY)).toBe(dv.lineTotal);
    });

    it('rounds a three-decimal override down to cents (USD item 3)', () => {
        const dv = usdDisplayValuesOf(USD_ITEM_3);

        // El override tecleado NO sale verbatim: pasa por el techo (ADR-114).
        // 1234.567 x 100 = 123456.7 (exacto) -> ceil = 123457 -> 1234.57.
        // Un tercer decimal no puede sobrevivir a un documento en USD, y el
        // cliente nunca paga por debajo del valor tecleado.
        expect(dv.unitPrice).toBe(1234.57);
        expect(dv.unitPrice).not.toBe(USD_ITEM_3.unitPriceOverride);
        // lineTotal = 1234.57 x q1 = 1234.57 (sin ruido: cantidad 1)
        expect(dv.lineTotal).toBe(1234.57);
        // margen recalculado sobre los valores redondeados:
        // ((1234.57 - 800)/1234.57) x 100 = (434.57/1234.57) x 100 = 35.2001...%
        expect(dv.margin).toBeCloseTo(35.20011016, 6);
    });
});

describe('calculateScenarioTotals in USD (cents)', () => {
    it('closes the printed chain in cents', () => {
        const totals = calculateScenarioTotals(USD_SCENARIO, USD_CURRENCY, null);

        // Líneas ya redondeadas: 3.39 y 104.51 gravadas, 1234.57 no gravada.
        // beforeVat = 3.39 + 104.51 = 107.9 (suma exacta en doubles, verificada)
        expect(totals.beforeVat).toBe(107.9);
        expect(totals.nonTaxed).toBe(1234.57);
        // subtotal = 107.9 + 1234.57 = 1342.47
        expect(totals.subtotal).toBe(1342.47);
        // vat = roundMoney(107.9 x 0.19) = roundMoney(20.501) = 20.5
        // El tercer decimal del IVA (0.001) se va: no existe medio centavo.
        expect(totals.vat).toBe(20.5);
        // total = 1342.47 + 20.5 = 1362.97
        expect(totals.total).toBe(1362.97);
        // totalCost a precisión completa = 0.9x3 + 10x7 + 800 = 872.7
        // globalMarginPct = ((1342.47 - 872.7)/1342.47) x 100 = 34.9929...%
        expect(totals.globalMarginPct).toBeCloseTo(34.99296074, 6);
    });

    it('rounds every money total to whole cents', () => {
        // El equivalente en USD del test de enteros del fixture COP: cada total
        // sobrevive a su propio roundMoney sin moverse.
        const totals = calculateScenarioTotals(USD_SCENARIO, USD_CURRENCY, null);

        for (const field of MONEY_FIELDS_OF_TOTALS) {
            expect(roundMoney(totals[field], USD_CURRENCY)).toBe(totals[field]);
        }
    });
});

describe('coherence invariants between the two composite functions', () => {
    it('invariant 1: the display line totals sum to the scenario subtotal', () => {
        // Si esto cae, la UI (que pinta calculateItemDisplayValues por fila)
        // muestra números que no suman lo que cobra calculateScenarioTotals.
        // Igualdad EXACTA (antes toBeCloseTo): las dos compuestas redondean en
        // el mismo punto, así que suman los MISMOS enteros de pesos. Ya no hay
        // ninguna cola de precisión que tolerar.
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const sumOfLineTotals = SCENARIO
            .filter((si) => !si.isDiluted)
            .reduce((acc, si) => acc + displayValuesOf(si).lineTotal, 0);

        expect(sumOfLineTotals).toBe(totals.subtotal);
    });

    it('invariant 1 (USD): the display line totals sum to the subtotal in cents', () => {
        // El mismo invariante donde sí podría romperse: sumar centavos en
        // doubles no es asociativo en general. Aquí cuadra EXACTO porque ambos
        // lados acumulan en el mismo orden (gravadas primero, no gravadas
        // después) y los sumandos son valores de 2 decimales pequeños.
        const totals = calculateScenarioTotals(USD_SCENARIO, USD_CURRENCY, null);
        const sumOfLineTotals = USD_SCENARIO
            .filter((si) => !si.isDiluted)
            .reduce((acc, si) => acc + usdDisplayValuesOf(si).lineTotal, 0);

        expect(sumOfLineTotals).toBe(totals.subtotal);
    });

    it('invariant 2: the taxable / non-taxable split agrees item by item', () => {
        // Desglosa el invariante 1 por el mismo criterio que usan los totales
        // (si.item.isTaxable), asi que un unitPrice que difiera en UN item ya no
        // se puede cancelar contra otro: cada mitad tiene que cuadrar sola.
        // También exacto ahora, y en las dos monedas.
        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const normalItems = SCENARIO.filter((si) => !si.isDiluted);

        const taxableSum = normalItems
            .filter((si) => si.item.isTaxable)
            .reduce((acc, si) => acc + displayValuesOf(si).lineTotal, 0);
        const nonTaxableSum = normalItems
            .filter((si) => !si.item.isTaxable)
            .reduce((acc, si) => acc + displayValuesOf(si).lineTotal, 0);

        expect(taxableSum).toBe(totals.beforeVat);
        expect(nonTaxableSum).toBe(totals.nonTaxed);

        const usdTotals = calculateScenarioTotals(USD_SCENARIO, USD_CURRENCY, null);
        const usdTaxable = USD_SCENARIO
            .filter((si) => si.item.isTaxable)
            .reduce((acc, si) => acc + usdDisplayValuesOf(si).lineTotal, 0);
        const usdNonTaxable = USD_SCENARIO
            .filter((si) => !si.item.isTaxable)
            .reduce((acc, si) => acc + usdDisplayValuesOf(si).lineTotal, 0);

        expect(usdTaxable).toBe(usdTotals.beforeVat);
        expect(usdNonTaxable).toBe(usdTotals.nonTaxed);
    });

    it('invariant 4: the printed line total is the printed unit price times the quantity', () => {
        // El cuadre que el cliente puede rehacer con una calculadora. Se asierta
        // con roundMoney encima del producto porque en centavos el producto
        // crudo arrastra ruido (1.13 x 3 = 3.3899999999999997); en pesos
        // enteros el round es identidad y el cuadre es literal.
        for (const si of SCENARIO.filter((s) => !s.isDiluted)) {
            const dv = displayValuesOf(si);
            expect(dv.lineTotal).toBe(roundMoney(dv.unitPrice * si.quantity, SCENARIO_CURRENCY));
            // En COP, además, la multiplicación cruda ya cuadra sin ayuda.
            expect(dv.lineTotal).toBe(dv.unitPrice * si.quantity);
        }

        for (const si of USD_SCENARIO) {
            const dv = usdDisplayValuesOf(si);
            expect(dv.lineTotal).toBe(roundMoney(dv.unitPrice * si.quantity, USD_CURRENCY));
        }
    });

    it('invariant 5: every money field returned is already rounded', () => {
        // Idempotencia como contrato de salida: si roundMoney(x) === x para todo
        // campo de dinero, entonces la capa de display y los generadores de
        // documento no tienen que redondear nada — y si lo hacen, no mueven el
        // número. Es lo que hace segura la regla "todo pasa por roundMoney".
        for (const si of SCENARIO) {
            const dv = displayValuesOf(si);
            for (const field of MONEY_FIELDS_OF_ITEM) {
                expect(roundMoney(dv[field], SCENARIO_CURRENCY)).toBe(dv[field]);
            }
        }

        for (const si of USD_SCENARIO) {
            const dv = usdDisplayValuesOf(si);
            for (const field of MONEY_FIELDS_OF_ITEM) {
                expect(roundMoney(dv[field], USD_CURRENCY)).toBe(dv[field]);
            }
        }

        const totals = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        for (const field of MONEY_FIELDS_OF_TOTALS) {
            expect(roundMoney(totals[field], SCENARIO_CURRENCY)).toBe(totals[field]);
        }
    });

    it('invariant 6: the cost columns may drift by one minor unit between them', () => {
        // CONCESIÓN DELIBERADA de ADR-113, documentada con un caso que la
        // produce: las columnas de costo se redondean a la salida cada una POR
        // SEPARADO, no en cadena. Con parentLanded = 100.5 y childrenCost = 0.5:
        //   parentLandedCost    = roundMoney(100.5) = 101
        //   childrenCostPerUnit = roundMoney(0.5)   = 1
        //   baseLandedCost      = roundMoney(100.5 + 0.5/q1) = roundMoney(101) = 101
        // 101 + 1 = 102 != 101: un peso de deriva entre columnas internas.
        // El fixture principal no la exhibe (sus tres items dan deriva 0), pero
        // existe y es aceptada: la cadena que cuadra exacta es la del cliente
        // (unitPrice -> lineTotal -> subtotal -> vat -> total), no la de las
        // columnas de costo internas.
        const HALF_PESO_ITEM: PricingScenarioItem = {
            quantity: 1,
            item: { unitCost: 100.5, costCurrency: 'COP', marginPct: 0, isTaxable: true },
            children: [
                { quantity: 1, item: { unitCost: 0.5, costCurrency: 'COP', marginPct: 0, isTaxable: true } },
            ],
        };
        const dv = calculateItemDisplayValues(
            HALF_PESO_ITEM, [HALF_PESO_ITEM], SCENARIO_CURRENCY, null,
        );

        expect(dv.parentLandedCost).toBe(101);
        expect(dv.childrenCostPerUnit).toBe(1);
        expect(dv.baseLandedCost).toBe(101);
        expect(dv.parentLandedCost + dv.childrenCostPerUnit - dv.baseLandedCost).toBe(1);

        // Y el fixture principal, en contraste, no deriva en ninguno de sus items.
        for (const si of SCENARIO) {
            const d = displayValuesOf(si);
            expect(d.baseLandedCost + d.dilutionPerUnit).toBe(d.effectiveLandedCost);
        }
    });

    it('invariant 7: the unit price is the ceiling of the exact price (ADR-114)', () => {
        // La garantía del techo, verificada contra el precio EXACTO derivado
        // por las funciones hoja a precisión completa (el mismo pipeline de
        // las compuestas, sin redondear): el unitario cotizado nunca queda por
        // debajo del exacto, y es exactamente roundMoneyUp(exacto).
        const exactUnitPrice = (
            si: PricingScenarioItem,
            items: PricingScenarioItem[],
            currency: string,
            trm: number | null,
        ): number => {
            const cost = convertCost(Number(si.item.unitCost), si.item.costCurrency || 'COP', currency, trm);
            const flete = Number(si.item.internalCosts?.fletePct || 0);
            const parentLanded = calculateParentLandedCost(cost, flete);
            const childrenCost = calculateChildrenCostPerUnit(si.children || [], currency, trm);
            const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);
            // ADR-115: el peso es el landed POR UNIDAD, no el costo crudo.
            const dilution = calculateDilutionPerUnit(
                baseLanded, si.quantity,
                calculateTotalNormalSubtotal(items, currency, trm),
                calculateTotalDilutedCost(items, currency, trm),
            );
            const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
            return calculateUnitPrice(effectiveLanded, resolveMargin(si.marginPctOverride, si.item.marginPct));
        };

        // COP, precios calculados (derivados contra runtime):
        //   A: exacto 5 352 641.8786... -> techo 5 352 642 (coincide con half-up)
        //   B: exacto   605 502.4749... -> techo   605 503 (coincide con half-up)
        for (const si of [ITEM_A, ITEM_B]) {
            const exact = exactUnitPrice(si, SCENARIO, SCENARIO_CURRENCY, TRM);
            const dv = displayValuesOf(si);
            expect(dv.unitPrice).toBeGreaterThanOrEqual(exact);
            expect(dv.unitPrice).toBe(roundMoneyUp(exact, SCENARIO_CURRENCY));
        }
        // D (override): la garantía aplica sobre el valor tecleado, que es el
        // "exacto" de esa rama. 600 000 entero: sale igual.
        const dvD = displayValuesOf(ITEM_D);
        expect(dvD.unitPrice).toBeGreaterThanOrEqual(Number(ITEM_D.unitPriceOverride));
        expect(dvD.unitPrice).toBe(roundMoneyUp(Number(ITEM_D.unitPriceOverride), SCENARIO_CURRENCY));

        // USD: U1 exacto 1.125 -> 1.13; U2 exacto 14.925373134328357 -> 14.93
        // (en ambos el techo coincide con lo que half-up ya daba: por eso el
        // fixture USD no se movió con ADR-114).
        for (const si of [USD_ITEM_1, USD_ITEM_2]) {
            const exact = exactUnitPrice(si, USD_SCENARIO, USD_CURRENCY, null);
            const dv = usdDisplayValuesOf(si);
            expect(dv.unitPrice).toBeGreaterThanOrEqual(exact);
            expect(dv.unitPrice).toBe(roundMoneyUp(exact, USD_CURRENCY));
        }
        // U3 (override 1234.567): techo 1234.57 >= el tecleado — con half-up la
        // garantía también se daba aquí (1234.567 sube), pero un override tipo
        // x.xx1 habría BAJADO; el techo la vuelve incondicional.
        const dvU3 = usdDisplayValuesOf(USD_ITEM_3);
        expect(dvU3.unitPrice).toBeGreaterThanOrEqual(Number(USD_ITEM_3.unitPriceOverride));
        expect(dvU3.unitPrice).toBe(roundMoneyUp(Number(USD_ITEM_3.unitPriceOverride), USD_CURRENCY));
    });

    it('invariant 3: removing the diluted item lowers total cost by exactly its cost', () => {
        // La conservación se cumple sobre el COSTO, no sobre el precio.
        // totalCost no se retorna, pero se recupera de globalMarginPct:
        //   globalMarginPct = ((totalPrice - totalCost)/totalPrice) x 100
        //   => totalCost = totalPrice x (1 - globalMarginPct/100)
        //
        // La política de redondeo NO toca esta cadena: totalCost se acumula a
        // precisión completa y totalPrice es exactamente subtotal, así que la
        // reconstrucción se cancela algebraicamente. Medido contra runtime: la
        // desviación es 0, no ±1 peso — por eso el assert sube a toBe exacto.
        // Es el resultado que importa: redondear precios no mueve el libro de
        // costos ni, por tanto, la conservación de la dilución.
        const withC = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const withoutC = calculateScenarioTotals(
            [ITEM_A, ITEM_B, ITEM_D], SCENARIO_CURRENCY, TRM,
        );

        const costWithC = withC.subtotal * (1 - withC.globalMarginPct / 100);
        const costWithoutC = withoutC.subtotal * (1 - withoutC.globalMarginPct / 100);

        // 10 520 000 - 10 220 000 = 300 000 = el costo de C, ni un peso más.
        // NO se movió con ADR-115: repartir el landed cambia QUIÉN paga cada
        // parte, no cuánto hay que pagar. Y el costo sin C es ahora exactamente
        // el denominador de la dilución, porque los dos son landed.
        expect(costWithC).toBe(10_520_000);
        expect(costWithoutC).toBe(10_220_000);
        expect(costWithoutC).toBe(TOTAL_NORMAL_SUBTOTAL);
        expect(costWithC - costWithoutC).toBe(TOTAL_DILUTED_COST);
    });

    it('invariant 3b: the subtotal rises by the diluted cost MARKED UP, not by the cost', () => {
        // caracterización: la dilución entra como costo y sale marcada por el
        // margen de cada item, asi que el subtotal NO sube los 300 000.
        //   A: 244 227.0058 de costo, marcado /0.8  -> 305 283.7573 de precio
        //   B:  44 031.3111 de costo, marcado /0.85 ->  51 801.5425 de precio
        //   D:  11 741.6829 de costo, precio FIJADO ->       0      de precio
        //   Σ a precisión completa = 357 085.2998 > 300 000
        // Los repartos se movieron con ADR-115 (A pesa su landed), pero el
        // reparto sigue sumando 300 000 de costo: lo que cambia es el mix de
        // márgenes que lo marca, y con él el delta del subtotal.
        //
        // AQUÍ SÍ aparece la deriva del redondeo, porque el lado del PRECIO es
        // el que se redondea: la diferencia se toma entre dos subtotales, cada
        // uno suma de 3 líneas. Con el TECHO del unitario (ADR-114) la deriva
        // deja de ser simétrica: el techo añade hasta 1 peso POR UNIDAD,
        // amplificado por la cantidad -> cota por lado = Σ cantidades de los
        // items con precio calculado (A q2 + B q3 = 5; D no cuenta: override
        // exacto) -> cota del delta ±5.
        //   13 121 793 - 12 764 708 = 357 085  (medido contra runtime; sin C,
        //   B techa 500 000/0.85 = 588 235.294... a 588 236, x3 = 1 764 708.
        //   El subtotal sin C no se movió con ADR-115: sin item diluido la
        //   dilución es 0 y el denominador nuevo no interviene.)
        //   desviación real = -0.30 pesos, dentro de la cota.
        // El assert va exacto porque los dos subtotales son enteros, y la cota
        // queda asertada aparte para que sea la cota —y no el literal— la que
        // documente cuánto puede moverse esto legítimamente.
        const withC = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const withoutC = calculateScenarioTotals(
            [ITEM_A, ITEM_B, ITEM_D], SCENARIO_CURRENCY, TRM,
        );

        const delta = withC.subtotal - withoutC.subtotal;
        const EXACT_MARKED_UP_DELTA = 357_085.299873;
        const ROUNDING_BAND = 5; // techo: hasta 1 peso x unidad (q2 + q3)

        expect(delta).toBe(357_085);
        expect(Math.abs(delta - EXACT_MARKED_UP_DELTA)).toBeLessThanOrEqual(ROUNDING_BAND);
        // Y lo que el invariante afirma de fondo sigue en pie con holgura:
        // el subtotal sube MÁS que el costo diluido, no exactamente el costo.
        expect(delta).toBeGreaterThan(TOTAL_DILUTED_COST);
        expect(delta).not.toBe(TOTAL_DILUTED_COST);
    });

    it('invariant 3c: an overridden price absorbs its dilution share as lost margin', () => {
        // caracterización: el item D no puede repercutir su dilución porque su
        // precio está fijado, asi que absorbe los 11 742 como margen menor.
        //   sin C: margen = ((600 000 - 400 000)/600 000) x 100 = 33.3333...%
        //   con C: margen = ((600 000 - 411 742)/600 000) x 100 = 31.3763333...%
        // Casi dos puntos de margen que se van sin que el precio se mueva. Es el
        // modo de falla que importa en DaaS: diluir un servicio sobre items con
        // precio pactado no encarece la cotización, erosiona el margen en
        // silencio. Con ADR-115 D absorbe algo MENOS (11 742 en vez de 12 121),
        // porque A pesa su landed y se lleva más del reparto; el modo de falla es
        // idéntico. El margen sin C no se mueve: no hay dilución que absorber.
        const withoutC = [ITEM_A, ITEM_B, ITEM_D];

        const marginWithC = displayValuesOf(ITEM_D).margin;
        const marginWithoutC = displayValuesOf(ITEM_D, withoutC).margin;

        expect(marginWithoutC).toBeCloseTo(33.33333333, 6);
        expect(marginWithC).toBeCloseTo(31.37633333, 6);
        expect(marginWithC).toBeLessThan(marginWithoutC);

        // Y el precio no se movió ni un peso.
        expect(displayValuesOf(ITEM_D).unitPrice).toBe(displayValuesOf(ITEM_D, withoutC).unitPrice);
    });
});

// ──────────────────────────────────────────────────────────
// GOLDEN del caso real de ADR-115 — el bug de dilución en producción.
//
// Es el escenario con el que Luis destapó el bug: la herramienta cotizaba
// 65 699,00 USD donde la derivación a mano daba 65 709,80. Los 10,80 de
// diferencia son el flete del item diluido (1% de 1 000 = 10) marcado por el
// margen de los visibles (7%): 10/0.93 = 10.7527, más el redondeo al techo.
//
// Forma: moneda USD sin TRM (convertCost no interviene), nada gravado (el foco
// es el subtotal, no el IVA), margen 7% en los dos visibles. El diluido SÍ
// tiene flete — es justo la parte que el reparto crudo perdía.
//
// Este golden no es caracterización ni fotografía: sus valores están derivados
// A MANO en ADR-114 y verificados contra runtime. Si cae, o la dilución volvió
// al costo crudo o el redondeo cambió de modo.
// ──────────────────────────────────────────────────────────

const REAL_CURRENCY = 'USD';

/** DILUIDO — 100 USD con 1% de flete, x10. Su landed (1 010) es lo que se reparte. */
const REAL_DILUTED: PricingScenarioItem = {
    quantity: 10,
    isDiluted: true,
    item: {
        unitCost: 100,
        costCurrency: 'USD',
        internalCosts: { fletePct: 1 },
        marginPct: 0,
        isTaxable: false,
    },
};

/** VISIBLE 1 — 1 000 USD con 1% de flete, x10, margen 7%. */
const REAL_P2: PricingScenarioItem = {
    quantity: 10,
    item: {
        unitCost: 1000,
        costCurrency: 'USD',
        internalCosts: { fletePct: 1 },
        marginPct: 7,
        isTaxable: false,
    },
};

/** VISIBLE 2 — 5 000 USD sin flete, x10, margen 7%. */
const REAL_P3: PricingScenarioItem = {
    quantity: 10,
    item: {
        unitCost: 5000,
        costCurrency: 'USD',
        marginPct: 7,
        isTaxable: false,
    },
};

const REAL_SCENARIO: PricingScenarioItem[] = [REAL_DILUTED, REAL_P2, REAL_P3];

const realDisplayValuesOf = (si: PricingScenarioItem) =>
    calculateItemDisplayValues(si, REAL_SCENARIO, REAL_CURRENCY, null);

describe('ADR-115 real case (USD, diluted item WITH flete)', () => {
    it('distributes 1 010 — the landed of the diluted item, not its 1 000 of raw cost', () => {
        // diluido: 100 x (1 + 1/100) = 101, x q10 = 1 010
        expect(calculateTotalDilutedCost(REAL_SCENARIO, REAL_CURRENCY, null)).toBe(1010);
        // El valor que se repartía antes del fix: los 10 USD de flete se
        // evaporaban del escenario en vez de recuperarse en el precio.
        expect(calculateTotalDilutedCost(REAL_SCENARIO, REAL_CURRENCY, null)).not.toBe(1000);

        // denominador: P2 1 010 x q10 = 10 100, P3 5 000 x q10 = 50 000
        expect(calculateTotalNormalSubtotal(REAL_SCENARIO, REAL_CURRENCY, null)).toBe(60_100);
    });

    it('splits the 1 010 between the two visible items by landed weight', () => {
        // P2: weight = 10 100/60 100 -> perUnit = (10 100/60 100 x 1 010)/q10
        //            = 10 201 000/601 000 = 16.973377703826955
        // P3: weight = 50 000/60 100 -> perUnit = (50 000/60 100 x 1 010)/q10
        //            = 50 500 000/601 000 = 84.02662229617304
        const dilutionOf = (si: PricingScenarioItem, landedPerUnit: number) =>
            calculateDilutionPerUnit(
                landedPerUnit,
                si.quantity,
                calculateTotalNormalSubtotal(REAL_SCENARIO, REAL_CURRENCY, null),
                calculateTotalDilutedCost(REAL_SCENARIO, REAL_CURRENCY, null),
            );

        const perUnitP2 = dilutionOf(REAL_P2, 1010);
        const perUnitP3 = dilutionOf(REAL_P3, 5000);

        expect(perUnitP2).toBeCloseTo(16.97337770, 6);
        expect(perUnitP3).toBeCloseTo(84.02662230, 6);

        // CONSERVACIÓN: Σ dilutionPerUnit x cantidad = totalDilutedCost, exacto.
        // 169.73377703826955 + 840.2662229617304 = 1 010
        expect(perUnitP2 * REAL_P2.quantity + perUnitP3 * REAL_P3.quantity).toBe(1010);

        // Y es lo que las compuestas ponen en la columna, ya en centavos.
        expect(realDisplayValuesOf(REAL_P2).dilutionPerUnit).toBe(16.97);
        expect(realDisplayValuesOf(REAL_P3).dilutionPerUnit).toBe(84.03);
    });

    it('prices the two visible items at 1 104.28 and 5 466.70', () => {
        const dvP2 = realDisplayValuesOf(REAL_P2);
        const dvP3 = realDisplayValuesOf(REAL_P3);

        // P2: effectiveLanded = 1 010 + 16.973377703826955 = 1 026.9733777038
        //     precio exacto = 1 026.9733777038/(1 - 7/100) = 1 104.2724491439
        //     -> roundMoneyUp USD = 1 104.28 (half-up daba 1 104.27, POR DEBAJO)
        expect(dvP2.baseLandedCost).toBe(1010);
        expect(dvP2.effectiveLandedCost).toBe(1026.97);
        expect(dvP2.unitPrice).toBe(1104.28);
        // línea sobre el precio ya techado: 1 104.28 x q10 = 11 042.80
        expect(dvP2.lineTotal).toBe(11_042.80);

        // P3: effectiveLanded = 5 000 + 84.02662229617304 = 5 084.0266222962
        //     precio exacto = 5 084.0266222962/0.93 = 5 466.6952927916
        //     -> roundMoneyUp USD = 5 466.70
        expect(dvP3.baseLandedCost).toBe(5000);
        expect(dvP3.effectiveLandedCost).toBe(5084.03);
        expect(dvP3.unitPrice).toBe(5466.70);
        expect(dvP3.lineTotal).toBe(54_667.00);

        // El diluido no se cobra: su costo se fue al precio de los otros dos.
        const dvDiluted = realDisplayValuesOf(REAL_DILUTED);
        expect(dvDiluted.parentLandedCost).toBe(101);
        expect(dvDiluted.unitPrice).toBe(0);
        expect(dvDiluted.lineTotal).toBe(0);
    });

    it('closes the scenario at 65 709.80 — and NOT at the 65 699.00 of the bug', () => {
        const totals = calculateScenarioTotals(REAL_SCENARIO, REAL_CURRENCY, null);

        // Nada gravado: todo el subtotal es nonTaxed y el IVA es 0.
        expect(totals.beforeVat).toBe(0);
        expect(totals.nonTaxed).toBe(65_709.80);
        // subtotal = 11 042.80 + 54 667.00 = 65 709.80
        expect(totals.subtotal).toBe(65_709.80);
        expect(totals.vat).toBe(0);
        expect(totals.total).toBe(65_709.80);

        // LA MORALEJA. Con el reparto sobre costo CRUDO este mismo escenario
        // cotizaba 65 699.00: repartía 1 000 en vez de 1 010, así que los precios
        // salían 1 103.95 y 5 465.95 y las líneas 11 039.50 y 54 659.50. Los
        // 10.80 USD de diferencia son el flete del diluido, que se evaporaba de
        // la cotización — marcado por el margen (10/0.93 = 10.7527) y redondeado
        // al techo. No era una concesión de redondeo: era plata regalada, en
        // producción desde el origen y proporcional al flete de lo que se diluya.
        expect(totals.subtotal).not.toBe(65_699.00);
        expect(totals.subtotal - 65_699.00).toBeCloseTo(10.80, 6);

        // El libro de costos cierra exacto sobre el landed: totalCost recuperado
        // de globalMarginPct = 60 100 de los visibles + 1 010 del diluido.
        const totalCost = totals.subtotal * (1 - totals.globalMarginPct / 100);
        expect(totalCost).toBeCloseTo(61_110, 6);
        expect(totals.globalMarginPct).toBeCloseTo(7.00017349, 6);
    });

    it('keeps the invariants of the two composite functions on this scenario', () => {
        const totals = calculateScenarioTotals(REAL_SCENARIO, REAL_CURRENCY, null);

        // invariante 1: las líneas de la UI suman lo que cobran los totales.
        const sumOfLineTotals = REAL_SCENARIO
            .filter((si) => !si.isDiluted)
            .reduce((acc, si) => acc + realDisplayValuesOf(si).lineTotal, 0);
        expect(sumOfLineTotals).toBe(totals.subtotal);

        for (const si of REAL_SCENARIO) {
            const dv = realDisplayValuesOf(si);
            // invariante 4: la línea impresa es el unitario impreso x la cantidad.
            expect(dv.lineTotal).toBe(roundMoney(dv.unitPrice * si.quantity, REAL_CURRENCY));
            // invariante 5: idempotencia de todo campo de dinero.
            for (const field of MONEY_FIELDS_OF_ITEM) {
                expect(roundMoney(dv[field], REAL_CURRENCY)).toBe(dv[field]);
            }
            // invariante 6: las columnas de costo de este fixture no derivan.
            expect(dv.baseLandedCost + dv.dilutionPerUnit).toBe(dv.effectiveLandedCost);
        }
        for (const field of MONEY_FIELDS_OF_TOTALS) {
            expect(roundMoney(totals[field], REAL_CURRENCY)).toBe(totals[field]);
        }

        // invariante 7: el unitario es el techo del precio exacto (ADR-114),
        // derivado por las funciones hoja a precisión completa sobre el landed.
        const exactUnitPrice = (si: PricingScenarioItem): number => {
            const cost = convertCost(
                Number(si.item.unitCost), si.item.costCurrency || 'COP', REAL_CURRENCY, null,
            );
            const flete = Number(si.item.internalCosts?.fletePct || 0);
            const parentLanded = calculateParentLandedCost(cost, flete);
            const childrenCost = calculateChildrenCostPerUnit(si.children || [], REAL_CURRENCY, null);
            const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);
            const dilution = calculateDilutionPerUnit(
                baseLanded, si.quantity,
                calculateTotalNormalSubtotal(REAL_SCENARIO, REAL_CURRENCY, null),
                calculateTotalDilutedCost(REAL_SCENARIO, REAL_CURRENCY, null),
            );
            const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
            return calculateUnitPrice(
                effectiveLanded, resolveMargin(si.marginPctOverride, si.item.marginPct),
            );
        };

        for (const si of [REAL_P2, REAL_P3]) {
            const exact = exactUnitPrice(si);
            const dv = realDisplayValuesOf(si);
            expect(dv.unitPrice).toBeGreaterThanOrEqual(exact);
            expect(dv.unitPrice).toBe(roundMoneyUp(exact, REAL_CURRENCY));
        }
        // El techo se ve: los dos exactos quedan POR DEBAJO del cotizado.
        expect(exactUnitPrice(REAL_P2)).toBeLessThan(realDisplayValuesOf(REAL_P2).unitPrice);
        expect(exactUnitPrice(REAL_P3)).toBeLessThan(realDisplayValuesOf(REAL_P3).unitPrice);

        // Y el landed total de cada item, que es la unidad de cuenta del reparto.
        expect(calculateItemLandedTotal(REAL_DILUTED, REAL_CURRENCY, null)).toBe(1010);
        expect(calculateItemLandedTotal(REAL_P2, REAL_CURRENCY, null)).toBe(10_100);
        expect(calculateItemLandedTotal(REAL_P3, REAL_CURRENCY, null)).toBe(50_000);
    });
});
