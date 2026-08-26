import { describe, it, expect } from 'vitest';
import {
    IVA_RATE,
    MAX_MARGIN,
    applyIva,
    calculateBaseLandedCost,
    calculateChildrenCostTotal,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateItemLandedTotal,
    calculateIvaAmount,
    calculateLineTotal,
    calculateMarginFromPrice,
    calculateParentLandedCost,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    calculateUnitPrice,
    convertCost,
    resolveMargin,
    roundMoney,
    roundMoneyUp,
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
// EXCEPCIÓN (ADR-115): los bloques marcados "especificación (ADR-115):" en los
// dos agregados de dilución ya NO son caracterización. Congelaban el reparto
// sobre costo CRUDO, que no era una decisión sino un bug comercial vivo en
// producción — el flete y los hijos de un item diluido se evaporaban de la
// cotización. Se movieron a propósito cuando la dilución pasó a operar sobre el
// landed, y ahora dicen lo que el reparto DEBE hacer, no lo que hacía.
//
// EXCEPCIÓN (ADR-116): lo mismo con los bloques marcados "especificación
// (ADR-116):" en resolveMargin, calculateUnitPrice, calculateParentLandedCost y
// calculateBaseLandedCost. Congelaban que un margen inválido ('', "abc",
// negativo) se volviera 0 o NaN, que ese NaN atravesara el guard del precio
// hasta envenenar los totales, que un flete negativo BAJARA el costo aterrizado,
// y que una cantidad <= 0 lo volviera Infinity, NaN o una resta de hijos.
// Tampoco eran decisiones: un campo borrado no es un margen de 0%, un flete
// negativo no es un descuento, y una fila de cero unidades no tiene un costo por
// unidad infinito. Ahora el margen inválido cae al margen base (y la base
// inválida a 0), el guard del precio pregunta por finitud, el flete negativo se
// trata como 0, y con cantidad <= 0 el término de hijos se omite. Y en
// calculateChildrenCostTotal el assert ya no congela un nombre mentiroso: el
// rename convirtió la advertencia en la definición de la función.
//
// Matchers: toBe para enteros exactos, constantes y los retorno-0 de los
// guards; toBeCloseTo(v, 10) cuando el valor es analíticamente exacto salvo
// ruido IEEE 754. Ya no hay toBeNaN() ni toBe(Infinity): ADR-116 cerró los tres
// bordes que los producían, y el NaN/Infinity que queda en el archivo es solo de
// ENTRADA, para probar los guards.
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

    it('treats a negative flete as 0, so the cost does not drop', () => {
        // especificación (ADR-116, B1): no existe flete negativo como caso de
        // negocio; se trata como 0 y el costo no baja. Antes 100 x 0.9 = 90 hacía
        // de un dato mal capturado un descuento invisible.
        expect(calculateParentLandedCost(100, -10)).toBe(100);
    });

    it('returns 0 when the cost is 0, whatever the flete', () => {
        // 0 x (1 + 1.5/100) = 0
        expect(calculateParentLandedCost(0, 1.5)).toBe(0);
    });
});

describe('calculateChildrenCostTotal', () => {
    it('returns 0 for an empty children list', () => {
        expect(calculateChildrenCostTotal([])).toBe(0);
    });

    it('sums childLanded x childQuantity across children', () => {
        // hijo A: 100 x (1 + 10/100) x 2 = 100 x 1.1 x 2 = 220
        // hijo B:  50 x (1 +  0/100) x 3 =  50 x 1   x 3 = 150
        // total = 220 + 150 = 370
        //
        // especificación (ADR-116): el nombre ahora dice lo que la función
        // retorna — el TOTAL de los hijos, sin dividir por la cantidad del padre.
        // La aclaración dejó de ser una advertencia contra el nombre y pasó a ser
        // su definición.
        const children = [
            makeItem({ unitCost: 100, fletePct: 10, quantity: 2 }),
            makeItem({ unitCost: 50, fletePct: 0, quantity: 3 }),
        ];
        expect(calculateChildrenCostTotal(children)).toBeCloseTo(370, 10);
    });

    it('treats a missing internalCosts as flete 0', () => {
        // 100 x (1 + 0/100) x 2 = 200
        const children = [makeItem({ unitCost: 100, quantity: 2 })];
        expect(calculateChildrenCostTotal(children)).toBe(200);
    });

    it('coerces a string fletePct through Number()', () => {
        // El tipo declara fletePct?: number | string, asi que "10" es una entrada
        // legítima: Number("10") = 10, y 100 x 1.1 x 2 = 220.
        const children = [makeItem({ unitCost: 100, fletePct: '10', quantity: 2 })];
        expect(calculateChildrenCostTotal(children)).toBeCloseTo(220, 10);
    });

    it('quotes a child with a negative flete as if the flete were 0', () => {
        // especificación (ADR-116): la vía del hijo pasa por
        // calculateParentLandedCost; el guard de signo cubre el hueco que la
        // fórmula duplicada dejaba abierto.
        // 100 x (1 + 0/100) x 2 = 200, y no 100 x 0.9 x 2 = 180.
        const children = [makeItem({ unitCost: 100, fletePct: -10, quantity: 2 })];
        expect(calculateChildrenCostTotal(children)).toBe(200);
    });

    it('converts a child in another currency before summing', () => {
        // hijo en USD: 10 x 4000 = 40 000 COP; flete 0; cantidad 1, total 40 000.
        const children = [makeItem({ unitCost: 10, costCurrency: 'USD', quantity: 1 })];
        expect(calculateChildrenCostTotal(children, 'COP', 4000)).toBe(40000);
    });

    it('defaults both currencies to COP when they are omitted', () => {
        // Sin costCurrency ni scenarioCurrency ambos caen a COP, asi que son la
        // misma moneda y convertCost no toca el costo: 100 x 1 x 1 = 100.
        const children = [makeItem({ unitCost: 100, quantity: 1 })];
        expect(calculateChildrenCostTotal(children, undefined, 4000)).toBe(100);
    });
});

describe('calculateBaseLandedCost', () => {
    it('adds the children total spread over the parent quantity', () => {
        // 110 + (300 / 2) = 110 + 150 = 260
        expect(calculateBaseLandedCost(110, 300, 2)).toBe(260);
    });

    it('drops the children term when the quantity is 0', () => {
        // especificación (ADR-116): con cantidad 0 el término de hijos se omite;
        // antes 300/0 = Infinity envenenaba precio y totales. Queda el landed del
        // padre solo, el único valor por-unidad que sigue teniendo sentido.
        expect(calculateBaseLandedCost(110, 300, 0)).toBe(110);
    });

    it('drops the children term with quantity 0 even when there are no children', () => {
        // especificación (ADR-116): mismo guard, sin hijos; antes 0/0 = NaN —
        // cantidad 0 ya no envenena distinto según haya hijos.
        expect(calculateBaseLandedCost(110, 0, 0)).toBe(110);
    });

    it('takes a negative quantity through the same guard', () => {
        // especificación (ADR-116): cantidad negativa entra por el mismo guard;
        // antes el costo de los hijos se RESTABA del landed cost (110 - 150 = -40).
        expect(calculateBaseLandedCost(110, 300, -2)).toBe(110);
    });
});

describe('calculateItemLandedTotal', () => {
    it('is the converted unit cost times the quantity with no flete and no children', () => {
        // 100 x (1 + 0/100) x q3 = 300
        expect(calculateItemLandedTotal(makeItem({ unitCost: 100, quantity: 3 }), 'COP', null)).toBe(300);
    });

    it('applies the parent flete before multiplying by the quantity', () => {
        // 100 x (1 + 50/100) = 150, x q2 = 300
        expect(calculateItemLandedTotal(makeItem({ unitCost: 100, quantity: 2, fletePct: 50 }), 'COP', null)).toBe(300);
    });

    it('adds the children cost ONCE, because it is already a total', () => {
        // padre: 100 x q2                 =   200
        // hijos: 999 x (1 + 0/100) x q5   = 4 995   (TOTAL, no por unidad de padre)
        // landed total                    = 5 195
        const si = makeItem({
            unitCost: 100,
            quantity: 2,
            children: [makeItem({ unitCost: 999, quantity: 5 })],
        });
        expect(calculateItemLandedTotal(si, 'COP', null)).toBe(5195);
    });

    it('converts the parent cost to the scenario currency', () => {
        // 10 USD x 4000 = 40 000 COP, x q2 = 80 000
        const si = makeItem({ unitCost: 10, costCurrency: 'USD', quantity: 2 });
        expect(calculateItemLandedTotal(si, 'COP', 4000)).toBe(80000);
    });

    it('equals baseLandedCost x quantity, written without the division', () => {
        // Identidad algebraica: (parentLanded + children/q) x q === parentLanded x q + children.
        // convertCost(1000, USD, COP, 4000)       = 4 000 000
        // parentLanded = 4 000 000 x 1.015        = 4 060 000
        //   (a precisión completa 4 059 999.9999999995: ruido IEEE 754 de 1.015)
        // landed total = 4 060 000 x q2 + 200 000 = 8 320 000
        // La segunda igualdad es EXACTA contra runtime, no solo algebraica.
        const si = makeItem({
            unitCost: 1000,
            costCurrency: 'USD',
            quantity: 2,
            fletePct: 1.5,
            children: [makeItem({ unitCost: 200000, costCurrency: 'COP', quantity: 1 })],
        });
        const parentLanded = calculateParentLandedCost(convertCost(1000, 'USD', 'COP', 4000), 1.5);
        const childrenCost = calculateChildrenCostTotal(si.children ?? [], 'COP', 4000);

        expect(calculateItemLandedTotal(si, 'COP', 4000)).toBeCloseTo(8_320_000, 6);
        expect(calculateItemLandedTotal(si, 'COP', 4000))
            .toBe(calculateBaseLandedCost(parentLanded, childrenCost, 2) * 2);
    });

    it('keeps the children cost when the quantity is 0, instead of NaN', () => {
        // caracterización: la forma sin división es lo que evita el NaN. Con
        // quantity 0 el padre aporta 110 x 0 = 0, pero el total de los hijos
        // sigue entrando entero: 50. La vía baseLandedCost x quantity daría
        // (110 + 50/0) x 0 = Infinity x 0 = NaN y envenenaría el agregado entero.
        // No es un guard explícito: es la razón por la que la fórmula se escribe así.
        const si = makeItem({
            unitCost: 100,
            quantity: 0,
            fletePct: 10,
            children: [makeItem({ unitCost: 50, quantity: 1 })],
        });
        expect(calculateItemLandedTotal(si, 'COP', null)).toBe(50);
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

    it('distributes the LANDED cost: flete and children included', () => {
        // padre:  100 x (1 + 50/100) = 150, x q2 =   300
        // hijos:  999 x (1 + 0/100)  x q5        = 4 995
        // landed total a repartir                = 5 295
        //
        // especificación (ADR-115): el costo que se reparte es el LANDED del item
        // diluido, no su costo crudo. Antes este assert congelaba 200 (100 x q2):
        // el flete del diluido y el costo de sus hijos no entraban a ningún total
        // del escenario y se evaporaban de la cotización — bug comercial vivo en
        // producción desde el origen, de magnitud flete% x costo diluido marcada
        // por el margen.
        const items = [
            makeItem({
                unitCost: 100,
                quantity: 2,
                isDiluted: true,
                fletePct: 50,
                children: [makeItem({ unitCost: 999, quantity: 5 })],
            }),
        ];
        expect(calculateTotalDilutedCost(items)).toBe(5295);
        // El valor que este mismo assert congelaba antes del fix:
        expect(calculateTotalDilutedCost(items)).not.toBe(200);
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

    it('weighs with the LANDED cost: flete and children included', () => {
        // 150 x q2 + 4 995 = 5 295, igual que el lado diluido.
        //
        // especificación (ADR-115): numerador y denominador de la dilución se
        // miden con la MISMA regla. Si el denominador se pesara con costo crudo
        // mientras el numerador reparte landed, los pesos dejarían de sumar 1 y
        // la conservación (Σ dilutionPerUnit x cantidad = totalDilutedCost) se
        // rompería. Antes este assert congelaba 200.
        const items = [
            makeItem({
                unitCost: 100,
                quantity: 2,
                isDiluted: false,
                fletePct: 50,
                children: [makeItem({ unitCost: 999, quantity: 5 })],
            }),
        ];
        expect(calculateTotalNormalSubtotal(items)).toBe(5295);
        expect(calculateTotalNormalSubtotal(items)).not.toBe(200);
    });

    it('converts a normal item in another currency', () => {
        // 10 USD x 4000 = 40 000 COP, x 2 = 80 000
        const items = [
            makeItem({ unitCost: 10, costCurrency: 'USD', quantity: 2, isDiluted: false }),
        ];
        expect(calculateTotalNormalSubtotal(items, 'COP', 4000)).toBe(80000);
    });
});

// La aritmética de calculateDilutionPerUnit NO se movió con ADR-115: la fórmula
// es la misma y sus cuatro parámetros siguen siendo números. Lo que cambió es la
// SEMÁNTICA del primero — ahora es el landed por unidad (baseLandedCost) y no el
// costo crudo — y eso vive en los llamadores, no aquí. Por eso todos los asserts
// de este describe siguen intactos: si alguno se hubiera movido, el fix habría
// tocado una fórmula que no debía tocar.
describe('calculateDilutionPerUnit', () => {
    it('distributes the diluted cost proportionally to item weight', () => {
        // weight = (itemLandedCost x itemQuantity) / totalNormalSubtotal
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

    it('falls back to the base margin for a non-numeric string override', () => {
        // especificación (ADR-116): un override que no es un margen ya no gana
        // sobre el margen base ni produce NaN. "abc" es inválido, asi que cae al
        // 15 del item — el mismo destino que un campo que nadie tocó — y la cadena
        // NaN hacia unitPrice y los totales queda cortada en su origen.
        expect(resolveMargin('abc', 15)).toBe(15);
    });

    it('falls back to the base margin when the override is an empty string', () => {
        // especificación (ADR-116): un campo de formulario BORRADO ya no se
        // convierte en un margen 0% explícito. "" no es un margen, es la ausencia
        // de uno, asi que vaciar el campo y no tocarlo dan el MISMO resultado (15),
        // que es justo lo que sugiere la UI.
        expect(resolveMargin('', 15)).toBe(15);
    });

    it('treats a whitespace-only override as an empty field, not as a 0% margin', () => {
        // especificación (ADR-116): el trim mete los espacios en el mismo saco que
        // el string vacío. Sin él, Number("  ") = 0 daría un margen 0% tan
        // silencioso como el de "".
        expect(resolveMargin('  ', 15)).toBe(15);
    });

    it('falls back to the base margin for a negative numeric override', () => {
        // especificación (ADR-116): un margen negativo no es un margen válido. El
        // -5 se descarta y gana el 15 del item, en vez de llegar a
        // calculateUnitPrice y cotizar bajo costo sin ningún aviso.
        expect(resolveMargin(-5, 15)).toBe(15);
    });

    it('falls back to the base margin for a negative override written as a string', () => {
        // especificación (ADR-116): la validación corre a ambos lados del
        // Number(), asi que "-5" y -5 salen por la misma puerta.
        expect(resolveMargin('-5', 15)).toBe(15);
    });

    it('falls back to 0 for a non-numeric item margin', () => {
        // especificación (ADR-116): del lado del fallback ya no hay Number() sin
        // validar. Sin override utilizable y con una base inválida el margen es 0
        // (venta al costo), nunca NaN.
        expect(resolveMargin(null, 'abc')).toBe(0);
    });

    it('falls back to 0 for a negative item margin', () => {
        // especificación (ADR-116): mismo destino que la base no numérica. Cuando
        // la base tampoco sirve no queda a qué caer, y 0 es el único valor que no
        // envenena el precio ni lo pone bajo costo.
        expect(resolveMargin(null, -10)).toBe(0);
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

    it('returns 0 for a NaN margin: the finite guard catches it', () => {
        // especificación (ADR-116): el guard pregunta primero por finitud, asi que
        // NaN ya no atraviesa la división. La línea a 0 es DEFENSIVA y hoy es
        // inalcanzable vía resolveMargin, que nunca entrega NaN; queda para el
        // consumidor que llame a esta función directamente.
        expect(calculateUnitPrice(100, NaN)).toBe(0);
    });

    it('returns 0 for an infinite margin, on both signs', () => {
        // especificación (ADR-116): cobertura de la mitad !Number.isFinite del
        // guard; Infinity ya daba 0 por el brazo MAX_MARGIN, -Infinity ya daba 0
        // por la división — esto fija que el guard nuevo los corta antes.
        expect(calculateUnitPrice(100, Infinity)).toBe(0);
        expect(calculateUnitPrice(100, -Infinity)).toBe(0);
    });

    it('the NaN chain is dead: an invalid margin prices like the base margin', () => {
        // especificación (ADR-116): la cadena resolveMargin -> calculateUnitPrice
        // que convertía un margen inválido en un precio NaN ya no existe. Con un
        // override inválido el precio es EXACTAMENTE el del margen base: ni NaN,
        // ni 0, ni un precio distinto.
        expect(calculateUnitPrice(100, resolveMargin('abc', 15)))
            .toBe(calculateUnitPrice(100, 15));
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

// ──────────────────────────────────────────────────────────
// Bloque H2 — tests de ESPECIFICACIÓN de roundMoney.
//
// Como H1 y a diferencia del resto del archivo, NO son caracterización: fijan
// por diseño la política ÚNICA de redondeo del sistema (ADR-113). Todo valor de
// dinero que salga del engine o llegue a un documento debe pasar por aquí, así
// que estos asserts son el contrato que los puntos de redondeo del repo tendrán
// que cumplir cuando se reapunten.
//
// Regla: COP redondea a peso entero (factor 1); cualquier otra moneda, a
// centavos (factor 100). Half-up en el sentido de Math.round: las mitades van
// hacia +Infinity, lo que en negativos significa hacia cero.
//
// Cada valor se derivó contra runtime ANTES de asertar y la aritmética queda en
// el comentario. Los asserts son toBe: cada resultado cae exactamente en el
// double del literal decimal (146913 / 100 === 1469.13 es exacto), así que la
// división final NO reintroduce ruido y no hace falta toBeCloseTo.
// ──────────────────────────────────────────────────────────

describe('roundMoney — COP (0 decimals)', () => {
    it('rounds the golden scenario subtotal to whole pesos', () => {
        // factor 1: Math.round(13 121 212.121212) = 13 121 212.
        // Es el subtotal del golden de scenarios.spec (13_121_212.121212, hoy
        // asertado con toBeCloseTo por su cola infinita), ahora en pesos
        // enteros: la cola se va entera, no se propaga al documento.
        expect(roundMoney(13121212.121212, 'COP')).toBe(13121212);
    });

    it('rounds halves up, not to even', () => {
        // 100.5 es el caso que DISCRIMINA la política: half-up da 101,
        // half-even (banker's rounding) daría 100 por ser el par más cercano.
        expect(roundMoney(100.5, 'COP')).toBe(101);
        // 101.5 -> 102 coincide bajo las dos reglas (102 ya es el par), así que
        // el par de asserts junto fija Math.round y descarta half-even: si
        // alguien cambiara la política a banker's, el primero caería.
        expect(roundMoney(101.5, 'COP')).toBe(102);
    });

    it('rounds down below the half', () => {
        // Math.round(99.4) = 99: por debajo de .5 no sube.
        expect(roundMoney(99.4, 'COP')).toBe(99);
    });

    it('leaves whole pesos untouched', () => {
        // factor 1 sobre un entero: Math.round es identidad y la división por 1
        // no altera el double. Exacto, sin ruido: por eso toBe.
        expect(roundMoney(13121212, 'COP')).toBe(13121212);
        expect(roundMoney(1, 'COP')).toBe(1);
        expect(roundMoney(-7, 'COP')).toBe(-7);
    });
});

describe('roundMoney — USD (2 decimals)', () => {
    it('absorbs the applyIva noise into cents', () => {
        // Entrada = el output real de applyIva(1234.56, true) del bloque H1,
        // que devuelve 1469.1263999999999 en vez de 1469.1264.
        // 1469.1263999999999 x 100 = 146912.63999999998 -> Math.round = 146913
        // -> / 100 = 1469.13 exacto. El ruido de ~2.3e-13 muere aquí.
        expect(roundMoney(1469.1263999999999, 'USD')).toBe(1469.13);
    });

    it('absorbs the noise of a rounded price times a quantity', () => {
        // 3.3899999999999997 es la forma en que IEEE 754 representa 1.13 x 3
        // (precio ya redondeado x cantidad).
        // x 100 = 338.99999999999994 -> Math.round = 339 -> / 100 = 3.39.
        expect(roundMoney(3.3899999999999997, 'USD')).toBe(3.39);
    });

    it('rounds the double that exists, not the ideal decimal (2.345 goes up)', () => {
        // ESPECIFICADO, no accidental: la política redondea EL DOUBLE QUE
        // EXISTE, no el decimal ideal que el literal aparenta.
        // El double más cercano a 2.345 está POR ENCIMA del decimal, y al
        // multiplicar: 2.345 x 100 = 234.50000000000003 (verificado contra
        // runtime), que está ARRIBA de la mitad -> Math.round = 235 -> 2.35.
        // Aquí half-up y "el double real" empujan en la misma dirección.
        expect(roundMoney(2.345, 'USD')).toBe(2.35);
    });

    it('rounds the double that exists, not the ideal decimal (1.005 goes down)', () => {
        // El caso clásico, y el que prueba que la regla es sobre el double:
        // 1.005 x 100 = 100.49999999999999 (verificado contra runtime), POR
        // DEBAJO de la mitad -> Math.round = 100 -> / 100 = 1.
        // Un half-up sobre el decimal ideal daría 1.01. La política NO lo hace,
        // y no puede hacerlo sin decimales exactos (BigInt / centavos enteros).
        // Este assert es el testigo de esa frontera.
        expect(roundMoney(1.005, 'USD')).toBe(1);
    });

    it('leaves an exact cent amount untouched', () => {
        // 1469.13 x 100 = 146913 exacto -> round -> / 100 = 1469.13.
        expect(roundMoney(1469.13, 'USD')).toBe(1469.13);
    });
});

describe('roundMoney — borders', () => {
    it('returns 0 for a value of 0 in both currencies', () => {
        expect(roundMoney(0, 'COP')).toBe(0);
        expect(roundMoney(0, 'USD')).toBe(0);
    });

    it('rounds a negative value by magnitude when it is not a half', () => {
        // -234.5664 es el IVA negativo del bloque H1 (nota crédito).
        // Math.round(-234.5664) = -235: la parte fraccionaria .5664 supera la
        // mitad, así que redondea al entero más cercano, que es el más negativo.
        expect(roundMoney(-234.5664, 'COP')).toBe(-235);
    });

    it('rounds negative halves toward +Infinity, i.e. toward zero', () => {
        // ESPECIFICADO: Math.round rompe TODAS las mitades hacia +Infinity, no
        // "hacia arriba en magnitud". En negativos eso es hacia cero:
        // Math.round(-100.5) = -100 (no -101), Math.round(-101.5) = -101.
        // Consecuencia: |roundMoney(-100.5)| < |roundMoney(100.5)|. La política
        // NO es simétrica respecto al signo; queda fijado aquí a propósito.
        expect(roundMoney(-100.5, 'COP')).toBe(-100);
        expect(roundMoney(-101.5, 'COP')).toBe(-101);
        expect(roundMoney(100.5, 'COP')).toBe(101);
    });

    it('produces negative zero for a small negative value', () => {
        // Math.round(-0.4) = -0, y -0 / 1 sigue siendo -0.
        // Numéricamente es cero (-0 === 0 es true), así que ninguna suma
        // posterior cambia; pero Object.is lo distingue y String(-0) da "-0",
        // que es lo que podría llegar a un documento. Queda especificado para
        // que quien formatee sepa que tiene que normalizarlo.
        expect(roundMoney(-0.4, 'COP')).toBe(-0);
        expect(Object.is(roundMoney(-0.4, 'COP'), -0)).toBe(true);
        expect(roundMoney(-0.4, 'COP') === 0).toBe(true);
        expect(Object.is(roundMoney(-0.004, 'USD'), -0)).toBe(true);
    });

    it('defaults an unknown currency to cents', () => {
        // El ternario solo distingue COP; todo lo demás usa factor 100. Es
        // coherente con que COP sea la única moneda entera del dominio: una
        // moneda nueva (EUR) hereda centavos, no pesos enteros.
        // 1.005 x 100 = 100.49999999999999 -> 100 -> 1, igual que en USD.
        expect(roundMoney(1.005, 'EUR')).toBe(roundMoney(1.005, 'USD'));
        expect(roundMoney(1.005, 'EUR')).toBe(1);
        expect(roundMoney(2.345, 'EUR')).toBe(2.35);
        // Y NO se comporta como COP: 2.345 en pesos enteros daría 2.
        expect(roundMoney(2.345, 'EUR')).not.toBe(roundMoney(2.345, 'COP'));
    });

    it('is idempotent: rounding a rounded value changes nothing', () => {
        // Invariante que hace segura la regla "todo valor pasa por aquí":
        // aplicarla dos veces no puede mover el número, así que un valor
        // redondeado en el engine y vuelto a redondear en el documento no
        // deriva. Se prueba con valores CON ruido en ambas monedas, no con
        // casos limpios.
        const noisy: Array<[number, string]> = [
            [13121212.121212, 'COP'],
            [-234.5664, 'COP'],
            [1469.1263999999999, 'USD'],
            [3.3899999999999997, 'USD'],
            [2.345, 'USD'],
            [1.005, 'USD'],
        ];
        for (const [value, currency] of noisy) {
            const once = roundMoney(value, currency);
            expect(roundMoney(once, currency)).toBe(once);
        }
    });
});

// ── ADR-114: roundMoneyUp — techo para el precio unitario de venta ──
//
// Mismo régimen de especificación que roundMoney (cabecera del bloque H2),
// pero con la garantía inversa: el unitario cotizado NUNCA queda por debajo
// de su valor exacto. SOLO el precio unitario de venta usa este modo; todo
// lo demás sigue en roundMoney (half-up).
//
// La pieza delicada es el guard de ruido: un ceiling ingenuo infla el ruido
// de representación (8.2 x 100 = 820.0000000000001 se volvería 8.21). El
// guard trata como entero todo scaled a menos de 1e-9 relativo del entero
// más cercano, en cualquiera de las dos direcciones. Todo valor de abajo se
// derivó contra runtime ANTES de asertar, con el scaled en el comentario.

describe('roundMoneyUp — guarantee: never below the exact value', () => {
    it('ceilings the business unit prices that half-up would cut short', () => {
        // Los dos unitarios del escenario de dilución de Luis (validación
        // runtime del 2026-08-24), donde half-up VIOLA la garantía:
        // 1104.27244914 x 100 = 110427.244913999995 -> ceil = 110428 -> 1104.28
        //   (roundMoney da 1104.27, POR DEBAJO del exacto: ese es el bug de
        //   negocio que este modo elimina).
        expect(roundMoneyUp(1104.27244914, 'USD')).toBe(1104.28);
        expect(roundMoneyUp(1104.27244914, 'USD')).toBeGreaterThanOrEqual(1104.27244914);
        expect(roundMoney(1104.27244914, 'USD')).toBeLessThan(1104.27244914);
        // 5466.69529279 x 100 = 546669.529279000009 -> ceil = 546670 -> 5466.70
        //   (aquí half-up coincide: .53 ya subía).
        expect(roundMoneyUp(5466.69529279, 'USD')).toBe(5466.7);
        expect(roundMoneyUp(5466.69529279, 'USD')).toBeGreaterThanOrEqual(5466.69529279);
    });

    it('does not inflate representation noise above the integer (the trap)', () => {
        // La trampa que motiva el guard: la familia x.x0 cuyo double x 100 cae
        // POR ENCIMA del entero. Un ceil ingenuo los sube un centavo entero.
        // 8.2 x 100 = 819.99999999999988631 (POR DEBAJO) -> guard -> 820 -> 8.2
        expect(roundMoneyUp(8.2, 'USD')).toBe(8.2);
        // 1.1 x 100 = 110.00000000000001421 (POR ENCIMA) -> guard -> 110 -> 1.1
        //   sin guard: ceil(110.000...014) = 111 -> 1.11, un centavo inventado.
        expect(roundMoneyUp(1.1, 'USD')).toBe(1.1);
        // 2.2 x 100 = 220.00000000000002842 (POR ENCIMA) -> guard -> 220 -> 2.2
        expect(roundMoneyUp(2.2, 'USD')).toBe(2.2);
        // 5466.70 x 100 = 546670 exacto: sin ruido que absorber.
        expect(roundMoneyUp(5466.7, 'USD')).toBe(5466.7);
    });

    it('leaves exact values untouched', () => {
        // Enteros COP y centavos exactos USD: scaled cae en el entero, el guard
        // los identifica y la división no altera el double.
        expect(roundMoneyUp(600000, 'COP')).toBe(600000);
        expect(roundMoneyUp(13121212, 'COP')).toBe(13121212);
        expect(roundMoneyUp(1469.13, 'USD')).toBe(1469.13);
        expect(roundMoneyUp(0, 'COP')).toBe(0);
        expect(roundMoneyUp(0, 'USD')).toBe(0);
    });

    it('always goes up on a genuine fraction, however small', () => {
        // El contraste que define el modo frente a roundMoney:
        // 100.0001 x 100(COP: factor 1) = 100.0001 -> ceil = 101
        //   (roundMoney da 100: medio peso de diferencia por 0.0001).
        expect(roundMoneyUp(100.0001, 'COP')).toBe(101);
        expect(roundMoney(100.0001, 'COP')).toBe(100);
        // 2.341 x 100 = 234.10000000000002 -> ceil = 235 -> 2.35
        //   (roundMoney da 2.34: la fracción .1 no llegaba a la mitad).
        expect(roundMoneyUp(2.341, 'USD')).toBe(2.35);
        expect(roundMoney(2.341, 'USD')).toBe(2.34);
    });

    it('is idempotent: ceiling a ceiled value changes nothing', () => {
        // La salida cae en la grilla de la moneda; re-aplicar el techo activa
        // el guard de ruido (8.2 dos veces: su scaled sigue siendo 819.99...)
        // y no mueve el número. Derivado contra runtime en ambas monedas.
        const noisy: Array<[number, string]> = [
            [1104.27244914, 'USD'],
            [2.341, 'USD'],
            [8.2, 'USD'],
            [1.1, 'USD'],
            [100.0001, 'COP'],
            [13121212.121212, 'COP'],
        ];
        for (const [value, currency] of noisy) {
            const once = roundMoneyUp(value, currency);
            expect(roundMoneyUp(once, currency)).toBe(once);
        }
    });

    it('never returns less than roundMoney (coherence between the two modes)', () => {
        // up >= half por construcción (ceil >= round salvo en el guard, donde
        // coinciden). El set incluye los casos frontera de ambos bloques:
        // 1.005 es la divergencia visible — roundMoney baja a 1 (su double cae
        // bajo la mitad), roundMoneyUp sube a 1.01 (fracción genuina).
        const values: Array<[number, string]> = [
            [1104.27244914, 'USD'],
            [5466.69529279, 'USD'],
            [2.341, 'USD'],
            [2.345, 'USD'],
            [1.005, 'USD'],
            [8.2, 'USD'],
            [100.0001, 'COP'],
            [13121212.121212, 'COP'],
            [-100.5, 'COP'],
            [-2.341, 'USD'],
            [0, 'USD'],
            [600000, 'COP'],
        ];
        for (const [value, currency] of values) {
            expect(roundMoneyUp(value, currency)).toBeGreaterThanOrEqual(roundMoney(value, currency));
        }
        expect(roundMoneyUp(1.005, 'USD')).toBe(1.01);
        expect(roundMoney(1.005, 'USD')).toBe(1);
    });

    it('ceilings negatives toward +Infinity, i.e. toward zero', () => {
        // ESPECIFICADO: Math.ceil va hacia +Infinity, igual que las mitades de
        // Math.round — en negativos, hacia cero. Derivado contra runtime:
        // -100.5    -> ceil(-100.5)    = -100 (coincide con roundMoney)
        // -100.0001 -> ceil(-100.0001) = -100 (la fracción genuina negativa
        //              también "sube" hacia cero: -100 > -100.0001, la garantía
        //              resultado >= exacto se sostiene con signo)
        // -2.341    -> ceil(-234.1)/100 = -2.34
        expect(roundMoneyUp(-100.5, 'COP')).toBe(-100);
        expect(roundMoneyUp(-100.0001, 'COP')).toBe(-100);
        expect(roundMoneyUp(-2.341, 'USD')).toBe(-2.34);
        expect(roundMoneyUp(-100.0001, 'COP')).toBeGreaterThanOrEqual(-100.0001);
    });
});
