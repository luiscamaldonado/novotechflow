import { describe, it, expect } from 'vitest';
import { IVA_RATE, MAX_MARGIN, calculateLineTotal, calculateParentLandedCost } from './index';

describe('pricing-engine smoke', () => {
    it('exposes business constants', () => {
        expect(IVA_RATE).toBe(0.19);
        expect(MAX_MARGIN).toBe(100);
    });
    it('calculateLineTotal multiplies price by quantity', () => {
        expect(calculateLineTotal(10, 3)).toBe(30);
    });
    it('calculateParentLandedCost applies flete percentage', () => {
        // IEEE 754: 100 * (1 + 1.5/100) === 101.49999999999999, not 101.5.
        expect(calculateParentLandedCost(100, 1.5)).toBeCloseTo(101.5);
    });
});
