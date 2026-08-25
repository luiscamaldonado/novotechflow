import { describe, it, expect } from 'vitest';
import {
    IVA_RATE,
    calculateBaseLandedCost,
    calculateChildrenCostPerUnit,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateItemDisplayValues,
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
        // Funciones HOJA: siguen a precisión completa, la política no las toca.
        expect(calculateTotalDilutedCost(SCENARIO, SCENARIO_CURRENCY, TRM)).toBe(TOTAL_DILUTED_COST);
        expect(calculateTotalNormalSubtotal(SCENARIO, SCENARIO_CURRENCY, TRM)).toBe(TOTAL_NORMAL_SUBTOTAL);
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

        // ── dilución ──
        // weight = (4 000 000 x q2) / 9 900 000 = 8 000 000/9 900 000 = 80/99
        // perUnit = (80/99 x 300 000) / q2 = 24 000 000/198 = 121 212.1212...
        //   -> roundMoney COP baja a 121 212 (la cola .1212 no llega a medio peso)
        expect(dv.dilutionPerUnit).toBe(121_212);
        // effectiveLanded = 4 160 000 + 121 212.1212... = 4 281 212.1212...
        //   -> 4 281 212
        expect(dv.effectiveLandedCost).toBe(4_281_212);

        // ── precio ──
        // margin = resolveMargin(undefined, 20) = 20. Es PORCENTAJE: no se
        // redondea, sale tal cual.
        expect(dv.margin).toBe(20);
        // El precio se calcula sobre el effective SIN redondear y se TECHA al
        // salir (ADR-114): 4 281 212.1212.../(1 - 20/100) = 5 351 515.1515...
        //   -> roundMoneyUp = 5 351 516 (half-up daba 5 351 515, POR DEBAJO
        //   del exacto: es el peso que el techo recupera).
        expect(dv.unitPrice).toBe(5_351_516);

        // ── línea ── se construye sobre el precio YA TECHADO:
        // 5 351 516 x q2 = 10 703 032 exacto (entero x entero).
        expect(dv.lineTotal).toBe(10_703_032);
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
        //   -> roundMoney COP SUBE a 15 152 (.5151 pasa de medio peso)
        expect(dv.dilutionPerUnit).toBe(15_152);
        // effectiveLanded = 500 000 + 15 151.5151... = 515 151.5151... -> 515 152
        expect(dv.effectiveLandedCost).toBe(515_152);

        // ── precio ──
        expect(dv.margin).toBe(15);
        // 515 151.5151.../0.85 = 606 060.6060... -> techo 606 061 (ADR-114;
        // half-up ya subía aquí, así que B no se mueve con el cambio de modo).
        expect(dv.unitPrice).toBe(606_061);

        // ── línea ── AQUÍ SE VE LA POLÍTICA (ADR-113).
        // La línea se construye sobre el precio REDONDEADO, no sobre el exacto:
        //   606 061         x q3 = 1 818 183           <- lo que se imprime
        //   606 060.6060... x q3 = 1 818 181.8181...   -> redondeado: 1 818 182
        // Se eligen los 1 818 183 A PROPÓSITO: el cliente multiplica el precio
        // que ve por 3 y le tiene que cuadrar. El peso de diferencia contra el
        // cálculo a precisión completa es el precio de esa garantía.
        expect(dv.lineTotal).toBe(1_818_183);
        expect(dv.lineTotal).not.toBe(1_818_182);
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
        // ── dilución ──
        // weight = (400 000 x q1)/9 900 000 = 4/99
        // perUnit = (4/99 x 300 000)/q1 = 1 200 000/99 = 12 121.2121... -> 12 121
        expect(dv.dilutionPerUnit).toBe(12_121);
        // effectiveLanded = 400 000 + 12 121.2121... = 412 121.2121... -> 412 121
        expect(dv.effectiveLandedCost).toBe(412_121);

        // ── margen mostrado ──
        // Se recalcula sobre los valores REDONDEADOS, que son los que el usuario
        // ve en pantalla: calculateMarginFromPrice(600 000, 412 121)
        //   = ((600 000 - 412 121) / 600 000) x 100
        //   = (187 879 / 600 000) x 100 = 31.3131666...%
        // Sobre el effective sin redondear daría 31.31313131%; la diferencia
        // (3.5e-5 puntos) es el precio de que la columna y el margen cuenten la
        // misma historia. Sigue sin ser el marginPct base del item (10).
        expect(dv.margin).toBeCloseTo(31.31316667, 6);
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
        //   A gravado:     10 703 032   (5 351 516 x 2, unitario techado)
        //   D gravado:        600 000
        //   B NO gravado:   1 818 183
        //
        // beforeVat = 10 703 032 + 600 000 = 11 303 032
        // Suma EXACTA de enteros: no hay redondeo adicional que aplicar.
        expect(totals.beforeVat).toBe(11_303_032);
        // nonTaxed = 1 818 183
        expect(totals.nonTaxed).toBe(1_818_183);
        // subtotal = beforeVat + nonTaxed = 13 121 215
        // A precisión completa eran 13 121 212.1212...: un peso de B (half-up
        // de su línea sobre precio redondeado) y dos de A (techo x cantidad 2).
        expect(totals.subtotal).toBe(13_121_215);

        // golden H1: única implementación de IVA que debe sobrevivir.
        // vat = roundMoney(calculateIvaAmount(11 303 032, true))
        //     = roundMoney(11 303 032 x 0.19) = roundMoney(2 147 576.08) = 2 147 576
        // (coincide con el valor pre-techo por aritmética: 2 147 575.7 y
        // 2 147 576.08 redondean al mismo peso).
        // El IVA se aplica SOLO a la base gravada; los 1 818 183 de B no entran.
        // Cualquier otro cálculo de IVA en el repo debe converger aquí o
        // desaparecer. Nótese que se redondea DESPUÉS de aplicar la tarifa: el
        // IVA que se cobra es el de la base gravada impresa.
        expect(totals.vat).toBe(2_147_576);

        // total = subtotal + vat = 13 121 215 + 2 147 576 = 15 268 791
        expect(totals.total).toBe(15_268_791);

        // totalCost = Σ effectiveLanded x cantidad sobre los items normales, a
        // PRECISIÓN COMPLETA (nunca se imprime, solo alimenta el porcentaje):
        //   A: 4 281 212.1212... x q2 =  8 562 424.2424...
        //   B:   515 151.5151... x q3 =  1 545 454.5454...
        //   D:   412 121.2121... x q1 =    412 121.2121...
        //   = 10 520 000  (= 10 220 000 de landed + los 300 000 diluidos)
        // globalMarginPct = ((13 121 215 - 10 520 000)/13 121 215) x 100
        //                 = (2 601 215/13 121 215) x 100 = 19.8244980...%
        // Se movió porque el numerador usa el subtotal con el unitario techado;
        // sigue siendo porcentaje, así que va con toBeCloseTo.
        expect(totals.globalMarginPct).toBeCloseTo(19.82449796, 6);
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
            const dilution = calculateDilutionPerUnit(
                cost, si.quantity,
                calculateTotalNormalSubtotal(items, currency, trm),
                calculateTotalDilutedCost(items, currency, trm),
            );
            const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
            return calculateUnitPrice(effectiveLanded, resolveMargin(si.marginPctOverride, si.item.marginPct));
        };

        // COP, precios calculados (derivados contra runtime):
        //   A: exacto 5 351 515.1515... -> techo 5 351 516 (half-up daba menos)
        //   B: exacto   606 060.6060... -> techo   606 061 (coincide con half-up)
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
        expect(costWithC).toBe(10_520_000);
        expect(costWithoutC).toBe(10_220_000);
        expect(costWithC - costWithoutC).toBe(TOTAL_DILUTED_COST);
    });

    it('invariant 3b: the subtotal rises by the diluted cost MARKED UP, not by the cost', () => {
        // caracterización: la dilución entra como costo y sale marcada por el
        // margen de cada item, asi que el subtotal NO sube los 300 000.
        //   A: 242 424.2424 de costo, marcado /0.8  -> 303 030.3030 de precio
        //   B:  45 454.5454 de costo, marcado /0.85 ->  53 475.9358 de precio
        //   D:  12 121.2121 de costo, precio FIJADO ->       0      de precio
        //   Σ a precisión completa = 356 506.2388 > 300 000
        //
        // AQUÍ SÍ aparece la deriva del redondeo, porque el lado del PRECIO es
        // el que se redondea: la diferencia se toma entre dos subtotales, cada
        // uno suma de 3 líneas. Con el TECHO del unitario (ADR-114) la deriva
        // deja de ser simétrica: el techo añade hasta 1 peso POR UNIDAD,
        // amplificado por la cantidad -> cota por lado = Σ cantidades de los
        // items con precio calculado (A q2 + B q3 = 5; D no cuenta: override
        // exacto) -> cota del delta ±5.
        //   13 121 215 - 12 764 708 = 356 507  (medido contra runtime; sin C,
        //   B techa 500 000/0.85 = 588 235.294... a 588 236, x3 = 1 764 708)
        //   desviación real = +0.76 pesos, dentro de la cota.
        // El assert va exacto porque los dos subtotales son enteros, y la cota
        // queda asertada aparte para que sea la cota —y no el literal— la que
        // documente cuánto puede moverse esto legítimamente.
        const withC = calculateScenarioTotals(SCENARIO, SCENARIO_CURRENCY, TRM);
        const withoutC = calculateScenarioTotals(
            [ITEM_A, ITEM_B, ITEM_D], SCENARIO_CURRENCY, TRM,
        );

        const delta = withC.subtotal - withoutC.subtotal;
        const EXACT_MARKED_UP_DELTA = 356_506.238859;
        const ROUNDING_BAND = 5; // techo: hasta 1 peso x unidad (q2 + q3)

        expect(delta).toBe(356_507);
        expect(Math.abs(delta - EXACT_MARKED_UP_DELTA)).toBeLessThanOrEqual(ROUNDING_BAND);
        // Y lo que el invariante afirma de fondo sigue en pie con holgura:
        // el subtotal sube MÁS que el costo diluido, no exactamente el costo.
        expect(delta).toBeGreaterThan(TOTAL_DILUTED_COST);
        expect(delta).not.toBe(TOTAL_DILUTED_COST);
    });

    it('invariant 3c: an overridden price absorbs its dilution share as lost margin', () => {
        // caracterización: el item D no puede repercutir su dilución porque su
        // precio está fijado, asi que absorbe los 12 121 como margen menor.
        //   sin C: margen = ((600 000 - 400 000)/600 000) x 100 = 33.3333...%
        //   con C: margen = ((600 000 - 412 121)/600 000) x 100 = 31.3131666...%
        // Dos puntos de margen que se van sin que el precio se mueva. Es el modo
        // de falla que importa en DaaS: diluir un servicio sobre items con precio
        // pactado no encarece la cotización, erosiona el margen en silencio.
        // El redondeo del effective mueve el segundo margen 3.5e-5 puntos
        // (31.31313131 -> 31.31316667); el modo de falla es idéntico.
        const withoutC = [ITEM_A, ITEM_B, ITEM_D];

        const marginWithC = displayValuesOf(ITEM_D).margin;
        const marginWithoutC = displayValuesOf(ITEM_D, withoutC).margin;

        expect(marginWithoutC).toBeCloseTo(33.33333333, 6);
        expect(marginWithC).toBeCloseTo(31.31316667, 6);
        expect(marginWithC).toBeLessThan(marginWithoutC);

        // Y el precio no se movió ni un peso.
        expect(displayValuesOf(ITEM_D).unitPrice).toBe(displayValuesOf(ITEM_D, withoutC).unitPrice);
    });
});
