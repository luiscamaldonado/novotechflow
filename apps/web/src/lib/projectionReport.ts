import type { BillingProjection } from './types';
import { getSubtotalUsd } from '../hooks/useDashboard';

// ── Exported types ─────────────────────────────────────

export interface ProjectionReportRow {
  nomenclature: string;
  userName: string;
  billedPrevMonthUsd: number;
  billedCurrentMonthUsd: number;
  pendingCurrentMonthUsd: number;
  pendingNextMonthUsd: number;
  pendingCurrentQuarterUsd: number;
  pendingNextQuarterUsd: number;
}

export interface ProjectionReportTable {
  rows: ProjectionReportRow[];
  totals: ProjectionReportRow;
}

export interface ProjectionReport {
  ventas: ProjectionReportTable;
  daas: ProjectionReportTable;
  ventasDaas: ProjectionReportTable;
  referenceDate: Date;
}

// ── Internal types ─────────────────────────────────────

interface YearMonth {
  year: number;
  month: number;
}

interface Periods {
  currentYear: number;
  currentMonth: number;
  currentQuarterIndex: number;
  prevYear: number;
  prevMonth: number;
  nextYear: number;
  nextMonth: number;
  nextQuarterIndex: number;
  nextQuarterYear: number;
}

// ── Parsing ────────────────────────────────────────────

/** Extrae year/month del string sin pasar por new Date (evita shift UTC). */
function parseYearMonth(billingDate: string): YearMonth {
  const [datePart] = billingDate.split('T');
  const [y, m] = datePart.split('-');
  return { year: Number(y), month: Number(m) };
}

// ── Row helpers ────────────────────────────────────────

function createEmptyRow(
  nomenclature: string,
  userName: string,
): ProjectionReportRow {
  return {
    nomenclature,
    userName,
    billedPrevMonthUsd: 0,
    billedCurrentMonthUsd: 0,
    pendingCurrentMonthUsd: 0,
    pendingNextMonthUsd: 0,
    pendingCurrentQuarterUsd: 0,
    pendingNextQuarterUsd: 0,
  };
}

/** Suma los 6 montos campo a campo. Conserva nomenclature/userName de `a`. */
function addRows(
  a: ProjectionReportRow,
  b: ProjectionReportRow,
): ProjectionReportRow {
  return {
    nomenclature: a.nomenclature,
    userName: a.userName,
    billedPrevMonthUsd: a.billedPrevMonthUsd + b.billedPrevMonthUsd,
    billedCurrentMonthUsd: a.billedCurrentMonthUsd + b.billedCurrentMonthUsd,
    pendingCurrentMonthUsd: a.pendingCurrentMonthUsd + b.pendingCurrentMonthUsd,
    pendingNextMonthUsd: a.pendingNextMonthUsd + b.pendingNextMonthUsd,
    pendingCurrentQuarterUsd: a.pendingCurrentQuarterUsd + b.pendingCurrentQuarterUsd,
    pendingNextQuarterUsd: a.pendingNextQuarterUsd + b.pendingNextQuarterUsd,
  };
}

// ── Period derivation ──────────────────────────────────

function derivePeriods(referenceDate: Date): Periods {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const nextQuarterIndex = currentQuarterIndex === 3 ? 0 : currentQuarterIndex + 1;
  const nextQuarterYear =
    currentQuarterIndex === 3 ? currentYear + 1 : currentYear;

  return {
    currentYear,
    currentMonth,
    currentQuarterIndex,
    prevYear,
    prevMonth,
    nextYear,
    nextMonth,
    nextQuarterIndex,
    nextQuarterYear,
  };
}

// ── USD conversion ─────────────────────────────────────

/** Convierte subtotal a USD usando getSubtotalUsd oficial; 0 si no es finito. */
function usdOf(p: BillingProjection, trmRate: number | null): number {
  const currency = p.currency === 'USD' ? 'USD' : 'COP';
  const raw = getSubtotalUsd(Number(p.subtotal), currency, trmRate) ?? 0;
  return Number.isFinite(raw) ? raw : 0;
}

// ── Classification ─────────────────────────────────────

/** Clasifica UNA proyección en los 6 buckets temporales (la mayoría queda en 0). */
function classify(
  p: BillingProjection,
  periods: Periods,
  trmRate: number | null,
): ProjectionReportRow {
  const row = createEmptyRow('', '');
  if (!p.billingDate) return row;

  const { year: py, month: pm } = parseYearMonth(p.billingDate);
  const pQuarterIndex = Math.floor((pm - 1) / 3);
  const usd = usdOf(p, trmRate);

  if (p.status === 'FACTURADA') {
    if (py === periods.prevYear && pm === periods.prevMonth)
      row.billedPrevMonthUsd = usd;
    if (py === periods.currentYear && pm === periods.currentMonth)
      row.billedCurrentMonthUsd = usd;
  }

  if (p.status === 'PENDIENTE_FACTURAR') {
    if (py === periods.currentYear && pm === periods.currentMonth)
      row.pendingCurrentMonthUsd = usd;
    if (py === periods.nextYear && pm === periods.nextMonth)
      row.pendingNextMonthUsd = usd;
    if (py === periods.currentYear && pQuarterIndex === periods.currentQuarterIndex)
      row.pendingCurrentQuarterUsd = usd;
    if (py === periods.nextQuarterYear && pQuarterIndex === periods.nextQuarterIndex)
      row.pendingNextQuarterUsd = usd;
  }

  return row;
}

// ── Table construction ─────────────────────────────────

function initRowMap(
  commercials: Map<string, string>,
): Map<string, ProjectionReportRow> {
  const map = new Map<string, ProjectionReportRow>();
  for (const [nomenclature, userName] of commercials) {
    map.set(nomenclature, createEmptyRow(nomenclature, userName));
  }
  return map;
}

function accumulateRow(
  map: Map<string, ProjectionReportRow>,
  key: string,
  contribution: ProjectionReportRow,
): void {
  const existing = map.get(key);
  if (!existing) return;
  map.set(key, addRows(existing, contribution));
}

function finalizeTable(
  map: Map<string, ProjectionReportRow>,
): ProjectionReportTable {
  const rows = [...map.values()].sort((a, b) =>
    a.userName.localeCompare(b.userName),
  );
  const totals = rows.reduce(
    (acc, r) => addRows(acc, r),
    createEmptyRow('TOTAL', 'TOTAL'),
  );
  return { rows, totals };
}

/** Extrae el universo de comerciales de todas las proyecciones. */
function buildCommercials(
  projections: BillingProjection[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of projections) {
    const nomenclature = p.user?.nomenclature ?? '??';
    const userName = p.user?.name ?? 'Sin asignar';
    if (!map.has(nomenclature)) {
      map.set(nomenclature, userName);
    }
  }
  return map;
}

// ── Main ───────────────────────────────────────────────

export function buildProjectionReport(
  projections: BillingProjection[],
  trmRate: number | null,
  referenceDate: Date = new Date(),
): ProjectionReport {
  const periods = derivePeriods(referenceDate);
  const commercials = buildCommercials(projections);

  const ventasMap = initRowMap(commercials);
  const daasMap = initRowMap(commercials);
  const ventasDaasMap = initRowMap(commercials);

  for (const p of projections) {
    const key = p.user?.nomenclature ?? '??';
    const contribution = classify(p, periods, trmRate);

    if (p.acquisitionType === 'VENTA') {
      accumulateRow(ventasMap, key, contribution);
      accumulateRow(ventasDaasMap, key, contribution);
    } else if (p.acquisitionType === 'DAAS') {
      accumulateRow(daasMap, key, contribution);
      accumulateRow(ventasDaasMap, key, contribution);
    }
    // null/undefined → no suma en ninguna tabla
  }

  return {
    ventas: finalizeTable(ventasMap),
    daas: finalizeTable(daasMap),
    ventasDaas: finalizeTable(ventasDaasMap),
    referenceDate,
  };
}
