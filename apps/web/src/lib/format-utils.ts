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
