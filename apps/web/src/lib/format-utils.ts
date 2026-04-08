/**
 * Utility functions for formatting and parsing numeric values in inputs.
 * Uses Colombian format: dot (.) as thousands separator, no decimal separator.
 */

/**
 * Formats a number with thousands separators for display in inputs.
 * Uses Colombian standard: dot as thousands separator.
 * @example formatNumberWithThousands(1234567) → "1.234.567"
 * @example formatNumberWithThousands("1234567") → "1.234.567"
 * @example formatNumberWithThousands("") → ""
 */
export function formatNumberWithThousands(value: number | string): string {
    const cleaned = String(value).replace(/\D/g, '');
    if (!cleaned) return '';

    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses a string formatted with thousands separators back to a number.
 * Strips all non-digit characters before parsing.
 * @example parseFormattedNumber("1.234.567") → 1234567
 * @example parseFormattedNumber("") → 0
 */
export function parseFormattedNumber(formatted: string): number {
    const cleaned = formatted.replace(/\D/g, '');
    return Number(cleaned) || 0;
}

/**
 * Formats a TRM value with thousands separators and 2 decimal places.
 * Uses Colombian standard: dot as thousands separator, comma as decimal separator.
 * @example formatTrmValue(4250.37) → "4.250,37"
 * @example formatTrmValue("4250") → "4.250,00"
 */
export function formatTrmValue(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
    if (isNaN(num) || num === 0) return '';

    const fixed = num.toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedInt},${decPart}`;
}

/**
 * Parses a Colombian-formatted TRM string back to a number.
 * Handles dot as thousands separator and comma as decimal separator.
 * @example parseTrmValue("4.250,37") → 4250.37
 * @example parseTrmValue("4250") → 4250
 */
export function parseTrmValue(formatted: string): number {
    if (!formatted.trim()) return 0;
    const normalized = formatted.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
}
