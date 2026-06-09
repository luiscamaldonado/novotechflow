import { computeBillingCards, type BillingCards, type DashboardRow } from '../hooks/useDashboard';
import type { AcquisitionType } from './types';

// ── Exported types ─────────────────────────────────────

export interface ProjectionReportRow extends BillingCards {
  nomenclature: string;
  userName: string;
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

// ── Helpers ────────────────────────────────────────────

const EMPTY_CARDS: BillingCards = {
  facturadoMesAnterior: 0,
  facturadoMesActual: 0,
  facturadoTrimestreActual: 0,
  proyeccionTrimestreSiguiente: 0,
  pendFactMesActual: 0,
  pendFactMesSiguiente: 0,
};

/** Suma dos BillingCards campo a campo (para la tabla VENTAS + DaaS y para los totales). */
function addCards(a: BillingCards, b: BillingCards): BillingCards {
  return {
    facturadoMesAnterior: a.facturadoMesAnterior + b.facturadoMesAnterior,
    facturadoMesActual: a.facturadoMesActual + b.facturadoMesActual,
    facturadoTrimestreActual: a.facturadoTrimestreActual + b.facturadoTrimestreActual,
    proyeccionTrimestreSiguiente: a.proyeccionTrimestreSiguiente + b.proyeccionTrimestreSiguiente,
    pendFactMesActual: a.pendFactMesActual + b.pendFactMesActual,
    pendFactMesSiguiente: a.pendFactMesSiguiente + b.pendFactMesSiguiente,
  };
}

/** Universo de comerciales (nomenclature → userName) presentes en las filas. */
function buildCommercials(rows: DashboardRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const nomenclature = row.user?.nomenclature ?? '??';
    const userName = row.user?.name ?? 'Sin asignar';
    if (!map.has(nomenclature)) map.set(nomenclature, userName);
  }
  return map;
}

/** Construye una tabla (una fila por comercial) para una modalidad, o la suma de ambas. */
function buildTable(
  rows: DashboardRow[],
  commercials: Map<string, string>,
  mode: AcquisitionType | 'BOTH',
  trmRate: number | null,
): ProjectionReportTable {
  const reportRows: ProjectionReportRow[] = [];

  for (const [nomenclature, userName] of commercials) {
    const rowsOfCommercial = rows.filter(r => (r.user?.nomenclature ?? '??') === nomenclature);
    const cards: BillingCards =
      mode === 'BOTH'
        ? addCards(
            computeBillingCards(rowsOfCommercial, 'VENTA', trmRate),
            computeBillingCards(rowsOfCommercial, 'DAAS', trmRate),
          )
        : computeBillingCards(rowsOfCommercial, mode, trmRate);

    reportRows.push({ nomenclature, userName, ...cards });
  }

  reportRows.sort((a, b) => a.userName.localeCompare(b.userName));

  const totalsCards = reportRows.reduce<BillingCards>(
    (acc, r) => addCards(acc, r),
    { ...EMPTY_CARDS },
  );

  return {
    rows: reportRows,
    totals: { nomenclature: 'TOTAL', userName: 'TOTAL', ...totalsCards },
  };
}

// ── Main ───────────────────────────────────────────────

export function buildProjectionReport(
  rows: DashboardRow[],
  trmRate: number | null,
  referenceDate: Date = new Date(),
): ProjectionReport {
  const commercials = buildCommercials(rows);

  return {
    ventas: buildTable(rows, commercials, 'VENTA', trmRate),
    daas: buildTable(rows, commercials, 'DAAS', trmRate),
    ventasDaas: buildTable(rows, commercials, 'BOTH', trmRate),
    referenceDate,
  };
}
