// ──────────────────────────────────────────────────────────
// TRM Historical Service — NovoTechFlow
// Funciones puras para consultar y promediar la TRM histórica
// desde la API de Datos Abiertos Colombia.
// ──────────────────────────────────────────────────────────

import { TRM_HISTORICAL_API_URL } from './constants';

/** Timeout for external API calls (ms). */
const TRM_FETCH_TIMEOUT_MS = 10_000;

// ── Types ────────────────────────────────────────────────────

export interface TrmRecord {
    vigenciadesde: string;
    vigenciahasta: string;
    valor: string;
}

export interface TrmDayEntry {
    date: string;
    valor: number;
}

// ── Pure functions ──────────────────────────────────────────

/**
 * Llama a la API de Datos Abiertos Colombia y retorna los registros TRM
 * para un rango de fechas.
 */
export async function fetchTrmRecords(startDate: string, endDate: string): Promise<TrmRecord[]> {
    const whereClause = `vigenciadesde>='${startDate}T00:00:00' AND vigenciadesde<='${endDate}T23:59:59'`;
    const url = `${TRM_HISTORICAL_API_URL}?$where=${encodeURIComponent(whereClause)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRM_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`TRM API responded with status ${response.status}`);
        }

        const data: TrmRecord[] = await response.json();
        return data;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Expande los registros TRM a días calendario individuales.
 * Cada fila de la API puede cubrir 1 día (día hábil) o 3+ días (fin de semana/festivo).
 * Asigna el mismo valor TRM a cada día calendario dentro del rango
 * [vigenciadesde, vigenciahasta] (inclusive).
 */
export function expandTrmToDays(records: TrmRecord[]): TrmDayEntry[] {
    const days: TrmDayEntry[] = [];

    for (const record of records) {
        const valor = parseFloat(record.valor);
        if (isNaN(valor)) continue;

        const start = new Date(record.vigenciadesde.split('T')[0]);
        const end = new Date(record.vigenciahasta.split('T')[0]);

        const cursor = new Date(start);
        while (cursor <= end) {
            days.push({
                date: cursor.toISOString().split('T')[0],
                valor,
            });
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    return days;
}

/**
 * Calcula el promedio aritmético de la TRM para un conjunto de días expandidos.
 * promedio = Σ(valor de cada día) / número de días
 */
export function calculateTrmAverage(days: TrmDayEntry[]): number {
    if (days.length === 0) return 0;

    const sum = days.reduce((acc, day) => acc + day.valor, 0);
    return sum / days.length;
}

/**
 * Función orquestadora: obtiene el promedio TRM para un mes específico.
 * 1. Calcula el primer y último día del mes
 * 2. Llama a fetchTrmRecords
 * 3. Expande a días calendario con expandTrmToDays
 * 4. Calcula promedio con calculateTrmAverage
 *
 * @param year — Año (ej: 2026)
 * @param month — Mes 1-indexed (ej: 4 = Abril)
 * @returns El promedio TRM del mes, o null si la API falla
 */
export async function getTrmMonthlyAverage(year: number, month: number): Promise<number | null> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
        const records = await fetchTrmRecords(startDate, endDate);

        if (records.length === 0) return null;

        const expandedDays = expandTrmToDays(records);

        if (expandedDays.length === 0) return null;

        return calculateTrmAverage(expandedDays);
    } catch (error) {
        console.error(`Error fetching TRM average for ${year}-${month}:`, error);
        return null;
    }
}
