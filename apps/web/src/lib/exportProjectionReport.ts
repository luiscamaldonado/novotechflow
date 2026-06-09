import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type {
  ProjectionReport,
  ProjectionReportRow,
  ProjectionReportTable,
} from './projectionReport';
import { MONTH_NAMES_ES } from './constants';

// ── Palette (ARGB) ─────────────────────────────────────

const INDIGO = 'FF4F46E5';
const WHITE = 'FFFFFFFF';
const SLATE_900 = 'FF0F172A';
const SLATE_50 = 'FFF8FAFC';
const GRAY_BORDER = 'FFE2E8F0';
const GRAY_SUMMARY = 'FFF1F5F9';
const SKY_600 = 'FF0284C7';
const PINK_600 = 'FFDB2777';
const GRAY_SUBTITLE = 'FF6B7280';

// ── Column config ──────────────────────────────────────

const COLUMN_COUNT = 7;
const COLUMN_WIDTHS = [30, 22, 22, 24, 24, 24, 24];

const COLUMN_HEADERS = [
  'Comercial',
  'Facturado mes anterior USD Est.',
  'Facturado mes actual USD Est.',
  'Pend. Facturar mes actual USD Est.',
  'Pend. Facturar mes siguiente USD Est.',
  'Pend. Facturar trimestre actual USD Est.',
  'Pend. Facturar trimestre siguiente USD Est.',
] as const;

// ── Helpers ────────────────────────────────────────────

function applyBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: 'thin', color: { argb: GRAY_BORDER } },
    bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
    left: { style: 'thin', color: { argb: GRAY_BORDER } },
    right: { style: 'thin', color: { argb: GRAY_BORDER } },
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function buildTimestamp(): string {
  const now = new Date();
  const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${date} ${time}`;
}

/** Extrae los 7 valores de una fila en el orden de los encabezados. */
function getRowValues(row: ProjectionReportRow): (string | number)[] {
  return [
    row.userName,
    row.facturadoMesAnterior,
    row.facturadoMesActual,
    row.pendFactMesActual,
    row.pendFactMesSiguiente,
    row.facturadoTrimestreActual,
    row.proyeccionTrimestreSiguiente,
  ];
}

// ── Render functions ───────────────────────────────────

function renderInfoHeader(ws: ExcelJS.Worksheet, userName: string): void {
  const row = ws.addRow([`Reporte de Proyección — Generado por: ${userName}`]);
  ws.mergeCells(row.number, 1, row.number, COLUMN_COUNT);
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 12, color: { argb: WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 30;
}

function renderSubtitle(ws: ExcelJS.Worksheet, referenceDate: Date): void {
  const mesActual = referenceDate.getMonth() + 1;
  const añoActual = referenceDate.getFullYear();
  const quarterActual = Math.floor(referenceDate.getMonth() / 3) + 1;

  const text =
    `Mes actual: ${MONTH_NAMES_ES[mesActual]} ${añoActual} · Trim. actual: Q${quarterActual} ${añoActual}`;
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, COLUMN_COUNT);
  const cell = row.getCell(1);
  cell.font = { italic: true, size: 9, color: { argb: GRAY_SUBTITLE } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
}

function renderSectionTitle(
  ws: ExcelJS.Worksheet,
  title: string,
  bgColor: string,
): void {
  const row = ws.addRow([title]);
  ws.mergeCells(row.number, 1, row.number, COLUMN_COUNT);
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 12, color: { argb: WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 30;
}

function renderColumnHeaders(ws: ExcelJS.Worksheet): void {
  const row = ws.addRow([...COLUMN_HEADERS]);
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
}

function renderDataRow(
  ws: ExcelJS.Worksheet,
  dataRow: ProjectionReportRow,
  isOdd: boolean,
): void {
  const row = ws.addRow(getRowValues(dataRow));
  row.getCell(1).alignment = { horizontal: 'left' };

  for (let col = 2; col <= COLUMN_COUNT; col++) {
    const cell = row.getCell(col);
    cell.numFmt = '#,##0.00';
    cell.alignment = { horizontal: 'right' };
  }

  if (isOdd) {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
    });
  }

  row.eachCell((cell) => applyBorder(cell));
}

function renderTotalRow(
  ws: ExcelJS.Worksheet,
  totals: ProjectionReportRow,
): void {
  const row = ws.addRow(getRowValues(totals));
  row.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_SUMMARY } };
    cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'right' };
    if (colNumber > 1) cell.numFmt = '#,##0.00';
    applyBorder(cell);
  });
}

function renderTable(
  ws: ExcelJS.Worksheet,
  table: ProjectionReportTable,
  title: string,
  titleBg: string,
): void {
  renderSectionTitle(ws, title, titleBg);
  renderColumnHeaders(ws);

  table.rows.forEach((row, idx) => {
    renderDataRow(ws, row, idx % 2 === 1);
  });

  renderTotalRow(ws, table.totals);
  ws.addRow([]); // Spacer entre tablas
}

// ── Main export ────────────────────────────────────────

export async function exportProjectionReportToExcel(
  opts: { report: ProjectionReport; userName: string },
): Promise<void> {
  const { report, userName } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'NovoTechFlow';
  const ws = wb.addWorksheet('Proyección');

  COLUMN_WIDTHS.forEach((width, idx) => {
    ws.getColumn(idx + 1).width = width;
  });

  renderInfoHeader(ws, userName);
  renderSubtitle(ws, report.referenceDate);

  renderTable(ws, report.ventas, 'VENTAS', SKY_600);
  renderTable(ws, report.daas, 'DaaS', PINK_600);
  renderTable(ws, report.ventasDaas, 'VENTAS + DaaS', INDIGO);

  ws.views = [{ state: 'frozen' as const, ySplit: 2, xSplit: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Reporte de Proyección ${buildTimestamp()}.xlsx`,
  );
}
