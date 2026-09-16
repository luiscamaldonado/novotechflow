import {
    DASHBOARD_FILTERS_STORAGE_KEY,
    ALL_STATUSES,
    ALL_ITEM_TYPES,
} from './constants';
import type { ProposalStatus, ItemType, AcquisitionType } from './types';
import type { DateRange } from '../pages/dashboard/DashboardFilters';

/** Forma serializable del estado de filtros del tablero: los Set viajan como arrays. */
export interface PersistedDashboardFilters {
    showFilters: boolean;
    codeFilter: string;
    clientFilter: string;
    subjectFilter: string;
    statusFilters: ProposalStatus[];
    closeDateRange: DateRange;
    billingDateRange: DateRange;
    categoryFilter: ItemType[];
    manufacturerFilter: string;
    subtotalUsdMin: string;
    subtotalUsdMax: string;
    acquisitionFilter: AcquisitionType | 'ALL';
    userFilter: string[];
    closeMonthFilter: number[];
    billingMonthFilter: number[];
}

const ACQUISITION_VALUES: (AcquisitionType | 'ALL')[] = ['ALL', 'VENTA', 'DAAS'];

// ── Validadores defensivos ─────────────────────────────

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function asDateRange(value: unknown): DateRange {
    if (typeof value !== 'object' || value === null) return { from: '', to: '' };
    const raw = value as Record<string, unknown>;
    return { from: asString(raw.from), to: asString(raw.to) };
}

/** Filtra un array crudo dejando solo los miembros presentes en el catálogo permitido. */
function asEnumArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v));
}

/** Nomenclaturas de comercial: no hay catálogo cerrado, solo se exige string no vacío. */
function asNonEmptyStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * Los meses del tablero son 1-12: se extraen del segmento MM de un ISO YYYY-MM-DD
 * (ver el useMemo de `filtered` en useDashboard), no del índice 0-11 de Date.
 */
function isValidMonth(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12;
}

function asMonthArray(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value.filter(isValidMonth);
}

function asAcquisition(value: unknown): AcquisitionType | 'ALL' {
    return typeof value === 'string' && (ACQUISITION_VALUES as string[]).includes(value)
        ? (value as AcquisitionType | 'ALL')
        : 'ALL';
}

// ── API pública ──────────────────────────────────

/**
 * Lee el snapshot de filtros de sessionStorage.
 * Devuelve `null` si no hay nada guardado o si el contenido es ilegible;
 * un snapshot parcialmente corrupto se normaliza campo a campo, no se descarta entero.
 */
export function readDashboardFilters(): PersistedDashboardFilters | null {
    try {
        const raw = sessionStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY);
        if (!raw) return null;

        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return null;
        const o = parsed as Record<string, unknown>;

        return {
            showFilters: asBoolean(o.showFilters, false),
            codeFilter: asString(o.codeFilter),
            clientFilter: asString(o.clientFilter),
            subjectFilter: asString(o.subjectFilter),
            statusFilters: asEnumArray<ProposalStatus>(o.statusFilters, ALL_STATUSES),
            closeDateRange: asDateRange(o.closeDateRange),
            billingDateRange: asDateRange(o.billingDateRange),
            categoryFilter: asEnumArray<ItemType>(o.categoryFilter, ALL_ITEM_TYPES),
            manufacturerFilter: asString(o.manufacturerFilter),
            subtotalUsdMin: asString(o.subtotalUsdMin),
            subtotalUsdMax: asString(o.subtotalUsdMax),
            acquisitionFilter: asAcquisition(o.acquisitionFilter),
            userFilter: asNonEmptyStringArray(o.userFilter),
            closeMonthFilter: asMonthArray(o.closeMonthFilter),
            billingMonthFilter: asMonthArray(o.billingMonthFilter),
        };
    } catch {
        return null;
    }
}

/** Guarda el snapshot. Silencioso ante fallos de cuota o modo privado: la persistencia es una conveniencia, no un requisito. */
export function writeDashboardFilters(value: PersistedDashboardFilters): void {
    try {
        sessionStorage.setItem(DASHBOARD_FILTERS_STORAGE_KEY, JSON.stringify(value));
    } catch {
        /* no-op */
    }
}

/** Borra el snapshot. Se invoca en el logout para que otro usuario no herede filtros ajenos. */
export function clearDashboardFilters(): void {
    try {
        sessionStorage.removeItem(DASHBOARD_FILTERS_STORAGE_KEY);
    } catch {
        /* no-op */
    }
}
