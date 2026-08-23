import { describe, it, expect } from 'vitest';
import {
    IVA_RATE,
    MAX_MARGIN,
    applyIva,
    calculateBaseLandedCost,
    calculateChildrenCostPerUnit,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateIvaAmount,
    calculateLineTotal,
    calculateMarginFromPrice,
    calculateParentLandedCost,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    calculateUnitPrice,
    convertCost,
    resolveMargin,
} from './index';
import type { PricingScenarioItem } from './index';

// ──────────────────────────────────────────────────────────
// Suite de CARACTERIZACIÓN de las 12 funciones hoja originales. El bloque H1
// del final del archivo NO es caracterización: ver su propia cabecera.
//
// Rutas normales: el valor esperado se deriva a mano de la fórmula del JSDoc,
// con la aritmética en un comentario, para que el test codifique la regla de
// negocio y no un output pegado.
//
// Bordes: se asierta LO QUE EL CÓDIGO HACE HOY, marcado "caracterización:".
// Ningún assert de este archivo juzga si el comportamiento es correcto; los
// congela para que un cambio futuro sea visible y deliberado.
//
// Matchers: toBe para enteros exactos, constantes, Infinity y los retorno-0 de
// los guards; toBeCloseTo(v, 10) cuando el valor es analíticamente exacto salvo
// ruido IEEE 754; toBeNaN() para NaN.
// ──────────────────────────────────────────────────────────

/** Construye un PricingScenarioItem mínimo para las funciones que reciben listas. */
function makeItem(opts: {
    unitCost: number;
    quantity: number;
    fletePct?: number | string;
    costCurrency?: string;
    isDiluted?: boolean;
    marginPct?: number;
    isTaxable?: boolean;
    children?: PricingScenarioItem[];
}): PricingScenarioItem {
    return {
        quantity: opts.quantity,
        isDiluted: opts.isDiluted,
        children: opts.children,
        item: {
            unitCost: opts.unitCost,
            costCurrency: opts.costCurrency,
            internalCosts: opts.fletePct === undefined ? undefined : { fletePct: opts.fletePct },
            marginPct: opts.marginPct ?? 0,
            isTaxable: opts.isTaxable ?? true,
        },
    };
}

describe('constants', () => {
    it('IVA_RATE is the Colombian 19% VAT rate', () => {
        expect(IVA_RATE).toBe(0.19);
    });

    it('MAX_MARGIN is 100, the asymptote of the price formula', () => {
        expect(MAX_MARGIN).toBe(100);
    });
});

describe('convertCost', () => {
    it('returns the cost untouched when both currencies match', () => {
        expect(convertCost(100, 'USD', 'USD', 4000)).toBe(100);
        expect(convertCost(100, 'COP', 'COP', 4000)).toBe(100);
    });

    it('returns the cost untouched when the TRM is null', () => {
        expect(convertCost(100, 'USD', 'COP', null)).toBe(100);
    });

    it('returns the cost untouched when the TRM is undefined', () => {
        expect(convertCost(100, 'USD', 'COP', undefined)).toBe(100);
    });

    it('returns the cost untouched when the TRM is 0', () => {
        expect(convertCost(100, 'USD', 'COP', 0)).toBe(100);
    });

    it('returns the cost untouched when the TRM is negative', () => {
        // -4000 es truthy, asi que lo atrapa la segunda mitad del guard (trm <= 0).
        expect(convertCost(100, 'USD', 'COP', -4000)).toBe(100);
    });

    it('multiplies by the TRM going USD to COP', () => {
        // 100 USD x 4000 = 400 000 COP
        expect(convertCost(100, 'USD', 'COP', 4000)).toBe(400000);
    });

    it('divides by the TRM going COP to USD', () => {
        // 400 000 COP / 4000 = 100 USD
        expect(convertCost(400000, 'COP', 'USD', 4000)).toBe(100);
    });

    it('returns the cost untouched for an unknown currency pair', () => {
        // caracterización: fallback silencioso. Con una TRM válida, un par que no
        // sea USD/COP cae al return final y devuelve el costo SIN convertir en vez
        // de lanzar. Un item en EUR se cotiza como si sus cifras ya fueran COP.
        expect(convertCost(100, 'EUR', 'COP', 4000)).toBe(100);
        expect(convertCost(100, 'COP', 'EUR', 4000)).toBe(100);
    });

    it('returns the cost untouched when the TRM is NaN', () => {
        // caracterización: !NaN es true, asi que una TRM corrupta se trata igual
        // que una TRM ausente, en silencio y sin señal de que faltó convertir.
        expect(convertCost(100, 'USD', 'COP', NaN)).toBe(100);
    });
});

describe('calculateParentLandedCost', () => {
    it('returns the bare cost when flete is 0', () => {
        // 100 x (1 + 0/100) = 100
        expect(calculateParentLandedCost(100, 0)).toBe(100);
    });

    it('applies the 1.5% MAYORISTA flete', () => {
        // 100 x (1 + 1.5/100) = 100 x 1.015 = 101.5
        expect(calculateParentLandedCost(100, 1.5)).toBeCloseTo(101.5, 10);
    });

    it('discounts the cost when flete is negative', () => {
        // caracterización: no hay guard de signo. Un flete negativo BAJA el landed
        // cost (100 x 0.9 = 90) en vez de rechazarse, asi que un dato mal
        // capturado se vuelve un descuento invisible.
        expect(calculateParentLandedCost(100, -10)).toBe(90);
    });

    it('returns 0 when the cost is 0, whatever the flete', () => {
        // 0 x (1 + 1.5/100) = 0
        expect(calculateParentLandedCost(0, 1.5)).toBe(0);
    });
});

describe('calculateChildrenCostPerUnit', () => {
    it('returns 0 for an empty children list', () => {
        expect(calculateChildrenCostPerUnit([])).toBe(0);
    });

    it('sums childLanded x childQuantity across children', () => {
        // hijo A: 100 x (1 + 10/100) x 2 = 100 x 1.1 x 2 = 220
        // hijo B:  50 x (1 +  0/100) x 3 =  50 x 1   x 3 = 150
        // total = 220 + 150 = 370
        //
        // caracterización: el nombre dice PerUnit pero el retorno es el TOTAL de
        // los hijos, sin dividir por la cantidad del padre. Lo admite su propio
        // JSDoc ("Returns the TOTAL children cost (not per-parent-unit)"); quien
        // lo lea por el nombre y no por el JSDoc se equivoca por un factor igual
        // a la cantidad del padre.
        const children = [
            makeItem({ unitCost: 100, fletePct: 10, quantity: 2 }),
            makeItem({ unitCost: 50, fletePct: 0, quantity: 3 }),
        ];
        expect(calculateChildrenCostPerUnit(children)).toBeCloseTo(370, 10);
    });

    it('treats a missing internalCosts as flete 0', () => {
        // 100 x (1 + 0/100) x 2 = 200
        const children = [makeItem({ unitCost: 100, quantity: 2 })];
        expect(calculateChildrenCostPerUnit(children)).toBe(200);
    });

    it('coerces a string fletePct through Number()', () => {
        // El tipo declara fletePct?: number | string, asi que "10" es una entrada
        // legítima: Number("10") = 10, y 100 x 1.1 x 2 = 220.
        const children = [makeItem({ unitCost: 100, fletePct: '10', quantity: 2 })];
        expect(calculateChildrenCostPerUnit(children)).toBeCloseTo(220, 10);
    });

    it('converts a child in another currency before summing', () => {
        // hijo en USD: 10 x 4000 = 40 000 COP; flete 0; cantidad 1, total 40 000.
        const children = [makeItem({ unitCost: 10, costCurrency: 'USD', quantity: 1 })];
        expect(calculateChildrenCostPerUnit(children, 'COP', 4000)).toBe(40000);
    });

    it('defaults both currencies to COP when they are omitted', () => {
        // Sin costCurrency ni scenarioCurrency ambos caen a COP, asi que son la
        // misma moneda y convertCost no toca el costo: 100 x 1 x 1 = 100.
        const children = [makeItem({ unitCost: 100, quantity: 1 })];
        expect(calculateChildrenCostPerUnit(children, undefined, 4000)).toBe(100);
    });
});

describe('calculateBaseLandedCost', () => {
    it('adds the children total spread over the parent quantity', () => {
        // 110 + (300 / 2) = 110 + 150 = 260
        expect(calculateBaseLandedCost(110, 300, 2)).toBe(260);
    });

    it('returns Infinity when quantity is 0 and there are children', () => {
        // caracterización: la división no tiene guard. 300/0 = Infinity, asi que
        // 110 + Infinity = Infinity y el costo se propaga como Infinity a precio
        // y totales en vez de cortar con un error.
        expect(calculateBaseLandedCost(110, 300, 0)).toBe(Infinity);
    });

    it('returns NaN when quantity is 0 and there are no children', () => {
        // caracterización: mismo hueco, peor síntoma. Sin hijos el numerador es 0,
        // asi que 0/0 = NaN y el resultado es NaN, no Infinity. Un item con
        // cantidad 0 envenena el escenario de forma distinta según tenga hijos.
        expect(calculateBaseLandedCost(110, 0, 0)).toBeNaN();
    });

    it('subtracts the children cost when quantity is negative', () => {
        // caracterización: sin guard de signo, 300/-2 = -150, asi que
        // 110 + (-150) = -40. El costo de los hijos se RESTA del landed cost.
        expect(calculateBaseLandedCost(110, 300, -2)).toBe(-40);
    });
});

describe('calculateTotalDilutedCost', () => {
    it('returns 0 for an empty list', () => {
        expect(calculateTotalDilutedCost([])).toBe(0);
    });

    it('returns 0 when no item is diluted', () => {
        const items = [makeItem({ unitCost: 100, quantity: 2, isDiluted: false })];
        expect(calculateTotalDilutedCost(items)).toBe(0);
    });

    it('sums only the diluted items in a mixed list', () => {
        // diluido:  100 x 2 = 200  <- el único que cuenta
        // normal:   150 x 2 = 300  <- ignorado
        // sin flag:  80 x 1 =  80  <- ignorado (isDiluted undefined)
        const items = [
            makeItem({ unitCost: 100, quantity: 2, isDiluted: true }),
            makeItem({ unitCost: 150, quantity: 2, isDiluted: false }),
            makeItem({ unitCost: 80, quantity: 1 }),
        ];
        expect(calculateTotalDilutedCost(items)).toBe(200);
    });

    it('uses ONLY unitCost x quantity, ignoring flete and children', () => {
        // 100 x 2 = 200. NO 100 x 1.5 x 2 = 300, y sin sumar el hijo de 999 x 5.
        //
        // caracterización: el costo que se reparte por dilución es el costo CRUDO,
        // no el landed cost. El flete y los hijos de un item diluido no entran a
        // ningún total del escenario: se pierden.
        const items = [
            makeItem({
                unitCost: 100,
                quantity: 2,
                isDiluted: true,
                fletePct: 50,
                children: [makeItem({ unitCost: 999, quantity: 5 })],
            }),
        ];
        expect(calculateTotalDilutedCost(items)).toBe(200);
    });

    it('converts a diluted item in another currency', () => {
        // 10 USD x 4000 = 40 000 COP, x 2 = 80 000
        const items = [
            makeItem({ unitCost: 10, costCurrency: 'USD', quantity: 2, isDiluted: true }),
        ];
        expect(calculateTotalDilutedCost(items, 'COP', 4000)).toBe(80000);
    });
});

describe('calculateTotalNormalSubtotal', () => {
    it('returns 0 for an empty list', () => {
        expect(calculateTotalNormalSubtotal([])).toBe(0);
    });

    it('returns 0 when every item is diluted', () => {
        const items = [makeItem({ unitCost: 100, quantity: 2, isDiluted: true })];
        expect(calculateTotalNormalSubtotal(items)).toBe(0);
    });

    it('sums only the non-diluted items in a mixed list', () => {
        // normal:   150 x 2 = 300
        // sin flag:  80 x 1 =  80  <- también cuenta como normal
        // diluido:  100 x 2 = 200  <- ignorado
        // total = 300 + 80 = 380
        const items = [
            makeItem({ unitCost: 100, quantity: 2, isDiluted: true }),
            makeItem({ unitCost: 150, quantity: 2, isDiluted: false }),
            makeItem({ unitCost: 80, quantity: 1 }),
        ];
        expect(calculateTotalNormalSubtotal(items)).toBe(380);
    });

    it('counts an item with isDiluted undefined as normal', () => {
        // caracterización: el filtro es !si.isDiluted, asi que el default de un
        // item sin el flag es NORMAL. Es el default seguro, pero significa que un
        // campo ausente en la base de datos entra al denominador de la dilución
        // sin que nadie lo haya decidido.
        const items = [makeItem({ unitCost: 100, quantity: 3 })];
        expect(calculateTotalNormalSubtotal(items)).toBe(300);
    });

    it('uses ONLY unitCost x quantity, ignoring flete and children', () => {
        // 100 x 2 = 200, igual que el lado diluido: el denominador de la dilución
        // se pesa con costo crudo, no con landed cost.
        const items = [
            makeItem({
                unitCost: 100,
                quantity: 2,
                isDiluted: false,
                fletePct: 50,
                children: [makeItem({ unitCost: 999, quantity: 5 })],
            }),
        ];
        expect(calculateTotalNormalSubtotal(items)).toBe(200);
    });

    it('converts a normal item in another currency', () => {
        // 10 USD x 4000 = 40 000 COP, x 2 = 80 000
        const items = [
            makeItem({ unitCost: 10, costCurrency: 'USD', quantity: 2, isDiluted: false }),
        ];
        expect(calculateTotalNormalSubtotal(items, 'COP', 4000)).toBe(80000);
    });
});

describe('calculateDilutionPerUnit', () => {
    it('distributes the diluted cost proportionally to item weight', () => {
        // weight = (itemCost x itemQuantity) / totalNormalSubtotal
        //        = (100 x 2) / 500 = 200/500 = 0.4
        // dilutionPerUnit = (weight x totalDilutedCost) / itemQuantity
        //                 = (0.4 x 300) / 2 = 120/2 = 60
        expect(calculateDilutionPerUnit(100, 2, 500, 300)).toBeCloseTo(60, 10);
    });

    it('returns 0 when totalNormalSubtotal is 0 (guard)', () => {
        // Sin base normal no hay a quién repartir: evita la división por cero.
        expect(calculateDilutionPerUnit(100, 2, 0, 300)).toBe(0);
    });

    it('returns 0 when totalDilutedCost is 0 (guard)', () => {
        // No hay nada que diluir.
        expect(calculateDilutionPerUnit(100, 2, 500, 0)).toBe(0);
    });

    it('returns 0 when itemQuantity is 0 (guard)', () => {
        // Evita la segunda división por cero, la de itemQuantity.
        expect(calculateDilutionPerUnit(100, 0, 500, 300)).toBe(0);
    });

    it('conserves the diluted cost across the normal items', () => {
        // Invariante de negocio: lo repartido == lo diluido, sin fuga ni invención.
        // normalSubtotal = 100x2 + 150x2 = 200 + 300 = 500; dilutedCost = 300
        //   A: weight 200/500 = 0.4 -> (0.4 x 300)/2 = 60 -> x q2 = 120
        //   B: weight 300/500 = 0.6 -> (0.6 x 300)/2 = 90 -> x q2 = 180
        //   suma = 120 + 180 = 300 = totalDilutedCost
        const totalNormalSubtotal = 500;
        const totalDilutedCost = 300;
        const perUnitA = calculateDilutionPerUnit(100, 2, totalNormalSubtotal, totalDilutedCost);
        const perUnitB = calculateDilutionPerUnit(150, 2, totalNormalSubtotal, totalDilutedCost);

        expect(perUnitA).toBeCloseTo(60, 10);
        expect(perUnitB).toBeCloseTo(90, 10);
        expect(perUnitA * 2 + perUnitB * 2).toBeCloseTo(totalDilutedCost, 10);
    });

    it('returns 0 for a negative totalNormalSubtotal, since the guard is <= 0', () => {
        // caracterización: el guard cubre negativos además del cero, asi que un
        // subtotal normal negativo apaga la dilución en silencio en vez de
        // producir un reparto de signo invertido.
        expect(calculateDilutionPerUnit(100, 2, -500, 300)).toBe(0);
    });
});

describe('calculateEffectiveLandedCost', () => {
    it('adds the dilution share to the base landed cost', () => {
        // 110 + 60 = 170
        expect(calculateEffectiveLandedCost(110, 60)).toBe(170);
    });

    it('returns the base landed cost untouched when there is no dilution', () => {
        // 260 + 0 = 260
        expect(calculateEffectiveLandedCost(260, 0)).toBe(260);
    });
});

describe('resolveMargin', () => {
    it('prefers a numeric override over the item margin', () => {
        expect(resolveMargin(30, 15)).toBe(30);
    });

    it('falls back to the item margin when the override is null', () => {
        expect(resolveMargin(null, 15)).toBe(15);
    });

    it('falls back to the item margin when the override is undefined', () => {
        expect(resolveMargin(undefined, 15)).toBe(15);
    });

    it('honours an override of 0, since 0 is not nullish', () => {
        // Caso de negocio real: margen cero deliberado (venta al costo). El ??
        // solo atrapa null/undefined, asi que el 0 sobrevive y GANA sobre el 15.
        expect(resolveMargin(0, 15)).toBe(0);
    });

    it('coerces a string item margin through Number()', () => {
        // El tipo declara number | string; Number("15") = 15.
        expect(resolveMargin(null, '15')).toBe(15);
    });

    it('coerces a string override through Number()', () => {
        expect(resolveMargin('30', 15)).toBe(30);
    });

    it('returns NaN for a non-numeric string override', () => {
        // caracterización: Number() sin validación. "abc" no es nullish, asi que
        // gana sobre el margen base y produce NaN, que de ahí en adelante se
        // propaga a unitPrice y a los totales sin que nada lo detenga.
        expect(resolveMargin('abc', 15)).toBeNaN();
    });

    it('turns an empty-string override into 0, not into the base margin', () => {
        // caracterización: Number("") = 0 y "" no es nullish, asi que un input de
        // formulario BORRADO no cae al margen del item: se convierte en un margen
        // 0% explícito. Vaciar el campo y no tocarlo dan resultados distintos,
        // que es justo lo contrario de lo que sugiere la UI.
        expect(resolveMargin('', 15)).toBe(0);
    });

    it('returns NaN for a non-numeric item margin', () => {
        // caracterización: el mismo Number() sin validar, del lado del fallback.
        expect(resolveMargin(null, 'abc')).toBeNaN();
    });
});

describe('calculateUnitPrice', () => {
    it('marks the cost up by the margin', () => {
        // 100 / (1 - 25/100) = 100 / 0.75 = 400/3 = 133.333...
        expect(calculateUnitPrice(100, 25)).toBeCloseTo(400 / 3, 10);
    });

    it('prices at cost when the margin is 0', () => {
        // 100 / (1 - 0/100) = 100 / 1 = 100
        expect(calculateUnitPrice(100, 0)).toBe(100);
    });

    it('returns 0 at exactly MAX_MARGIN', () => {
        // caracterización: el guard (margin >= MAX_MARGIN) evita la división por
        // cero, pero el resultado es una línea a $0 EN SILENCIO. Un margen de
        // 100% no se le reporta al usuario como error: es una cotización gratis.
        expect(calculateUnitPrice(100, MAX_MARGIN)).toBe(0);
    });

    it('returns 0 above MAX_MARGIN', () => {
        // caracterización: mismo silencio para un margen imposible de 150%.
        expect(calculateUnitPrice(100, 150)).toBe(0);
    });

    it('prices BELOW cost when the margin is negative', () => {
        // 100 / (1 - (-25)/100) = 100 / 1.25 = 80, y 80 < 100: venta bajo costo.
        //
        // caracterización: no hay guard por abajo, solo por arriba. Un margen
        // negativo produce un precio válido y menor que el costo sin ningún
        // aviso; la pérdida solo se ve en el margen global del escenario.
        const price = calculateUnitPrice(100, -25);
        expect(price).toBe(80);
        expect(price).toBeLessThan(100);
    });

    it('returns NaN for a NaN margin instead of tripping the guard', () => {
        // caracterización: NaN >= 100 es false, asi que el guard NO lo atrapa y la
        // división corre. Es el eslabón que convierte el NaN de resolveMargin en
        // un precio NaN.
        expect(calculateUnitPrice(100, NaN)).toBeNaN();
    });
});

describe('calculateLineTotal', () => {
    it('multiplies unit price by quantity', () => {
        // (400/3) x 3 = 400
        expect(calculateLineTotal(400 / 3, 3)).toBeCloseTo(400, 10);
    });

    it('returns 0 when the quantity is 0', () => {
        expect(calculateLineTotal(100, 0)).toBe(0);
    });

    it('returns 0 when the unit price is 0', () => {
        // Consecuencia del guard de calculateUnitPrice: margen >= 100 da línea $0.
        expect(calculateLineTotal(0, 5)).toBe(0);
    });
});

describe('calculateMarginFromPrice', () => {
    it('round-trips against calculateUnitPrice', () => {
        // margen(precio(costo, m), costo) ~= m. Con costo 100 y m 25:
        //   precio = 100/0.75 = 400/3
        //   margen = ((400/3 - 100) / (400/3)) x 100 = (100/3 / (400/3)) x 100 = 25
        // Analíticamente exacto; la diferencia real (~7e-15) es ruido IEEE 754.
        const cost = 100;
        const margin = 25;
        const price = calculateUnitPrice(cost, margin);
        expect(calculateMarginFromPrice(price, cost)).toBeCloseTo(margin, 10);
    });

    it('returns 0 for a price of 0 (guard)', () => {
        expect(calculateMarginFromPrice(0, 100)).toBe(0);
    });

    it('returns 0 for a negative price (guard)', () => {
        expect(calculateMarginFromPrice(-50, 100)).toBe(0);
    });

    it('returns a negative margin when the price is below cost', () => {
        // ((80 - 100) / 80) x 100 = (-20/80) x 100 = -25
        // Espejo del caso bajo-costo de calculateUnitPrice: la pérdida sí se
        // reporta como margen negativo, no se recorta a 0.
        expect(calculateMarginFromPrice(80, 100)).toBe(-25);
    });

    it('returns a 100% margin when the cost is 0', () => {
        // ((100 - 0) / 100) x 100 = 100
        expect(calculateMarginFromPrice(100, 0)).toBe(100);
    });
});

// ──────────────────────────────────────────────────────────
// Bloque H1 — tests de ESPECIFICACIÓN de los dos helpers de IVA.
//
// A diferencia del resto del archivo, estos NO son caracterización: fijan el
// contrato que los puntos de IVA del repo (el engine, el hook de escenarios de
// web y exportExcel) deben cumplir cuando se reapunten al engine. Cada valor se
// derivó a mano de la fórmula y se verificó contra runtime antes de asertar.
// ──────────────────────────────────────────────────────────

describe('calculateIvaAmount', () => {
    it('applies IVA_RATE to a positive taxable base', () => {
        // 1000 x 0.19 = 190. Exacto: el producto cae justo en un entero
        // representable, sin ruido que absorber.
        expect(calculateIvaAmount(1000, true)).toBe(190);
    });

    it('applies IVA_RATE to a decimal taxable base', () => {
        // 4567.89 x 0.19 = 867.8991
        // El runtime devuelve 867.8991000000001; la diferencia (~1.1e-13) es
        // ruido IEEE 754 del producto, no una tarifa distinta.
        expect(calculateIvaAmount(4567.89, true)).toBeCloseTo(867.8991, 10);
    });

    it('returns exactly 0 when the base is not taxable', () => {
        // La rama no gravada no multiplica: devuelve el literal 0.
        expect(calculateIvaAmount(1000, false)).toBe(0);
    });

    it('returns 0 for a base of 0', () => {
        expect(calculateIvaAmount(0, true)).toBe(0);
        expect(calculateIvaAmount(0, false)).toBe(0);
    });

    it('passes the sign through for a negative taxable base', () => {
        // -1234.56 x 0.19 = -234.5664
        // Especificado, no accidental: no hay guard de signo. Una base negativa
        // (nota crédito, ajuste) produce IVA negativo por el mismo camino.
        expect(calculateIvaAmount(-1234.56, true)).toBeCloseTo(-234.5664, 10);
    });
});

describe('applyIva', () => {
    it('scales a positive taxable base by 1 + IVA_RATE', () => {
        // 1000 x 1.19 = 1190. Exacto: 1 + 0.19 da el double de 1.19 y el
        // producto por 1000 cae en un entero representable.
        expect(applyIva(1000, true)).toBe(1190);
    });

    it('scales a decimal taxable base by 1 + IVA_RATE', () => {
        // 1234.56 x 1.19 = 1469.1264
        // El runtime devuelve 1469.1263999999999: ruido IEEE 754 (~2.3e-13).
        expect(applyIva(1234.56, true)).toBeCloseTo(1469.1264, 10);
    });

    it('returns the base untouched when it is not taxable', () => {
        // La rama no gravada devuelve el mismo número: sin multiplicación,
        // sin redondeo, sin ruido. Por eso el assert es exacto.
        expect(applyIva(1234.56, false)).toBe(1234.56);
        expect(applyIva(1000, false)).toBe(1000);
    });

    it('returns 0 for a base of 0', () => {
        expect(applyIva(0, true)).toBe(0);
        expect(applyIva(0, false)).toBe(0);
    });
});

describe('IVA helpers coherence', () => {
    it('applyIva equals the base plus its calculateIvaAmount', () => {
        // Invariante que amarra las dos funciones: aplicar el IVA y sumarlo son
        // el mismo cálculo. b = 4567.89, decimal no trivial cuyo IVA sí arrastra
        // ruido (867.8991000000001), así que el invariante no se apoya en un
        // caso limpio.
        const base = 4567.89;
        expect(applyIva(base, true)).toBeCloseTo(
            base + calculateIvaAmount(base, true),
            10,
        );
    });

    it('the amount over the base is IVA_RATE', () => {
        // Coherencia con la constante del engine: el helper no introduce una
        // tarifa propia. Todo reapunte de H1 (exportExcel escribe hoy 19 a mano,
        // constants.ts de web declara su propio 0.19) tiene que caer en este
        // mismo cociente.
        const base = 4567.89;
        expect(calculateIvaAmount(base, true) / base).toBeCloseTo(IVA_RATE, 10);
    });
});
