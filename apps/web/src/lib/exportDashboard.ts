import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { STATUS_CONFIG, ACQUISITION_CONFIG } from './constants';
import { getSubtotalUsd } from '../hooks/useDashboard';
import type { DashboardRow } from '../hooks/useDashboard';

// ── Types ──────────────────────────────────────────────────
export interface DashboardExportOptions {
    rows: DashboardRow[];
    trmRate: number | null;
    userName: string;
    activeFilters?: string;
}

// ── Brand colours (ARGB format: FFrrggbb) ──────────────────
const INDIGO_HEADER = 'FF4F46E5';
const WHITE = 'FFFFFFFF';
const SLATE_50 = 'FFF8FAFC';
const GRAY_BORDER = 'FFE2E8F0';
const GRAY_SUMMARY = 'FFF1F5F9';

/** Status → { fill, font } for Excel cells. */
const STATUS_FILL: Record<string, { bg: string; fg: string }> = {
    ELABORACION:        { bg: 'FFFEF3C7', fg: 'FF92400E' },
    PROPUESTA:          { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
    GANADA:             { bg: 'FFD1FAE5', fg: 'FF065F46' },
    PERDIDA:            { bg: 'FFFEE2E2', fg: 'FF991B1B' },
    PENDIENTE_FACTURAR: { bg: 'FFFFEDD5', fg: 'FF9A3412' },
    FACTURADA:          { bg: 'FFCCFBF1', fg: 'FF134E4A' },
};

/** Acquisition → { fill, font } for Excel cells. */
const ACQ_FILL: Record<string, { bg: string; fg: string }> = {
    VENTA: { bg: 'FFE0F2FE', fg: 'FF0369A1' },
    DAAS:  { bg: 'FFFCE7F3', fg: 'FF9D174D' },
};

// ── Pure helpers ───────────────────────────────────────────

/** Format ISO date → dd/mm/aaaa or empty string. */
function formatDateDDMMYYYY(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const [datePart] = dateStr.split('T');
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
}

/** Zero-padded number for filenames. */
function pad(n: number): string {
    return n.toString().padStart(2, '0');
}

/** Build a filename-safe timestamp: dd-mm-aaaa HH-mm-ss */
function buildTimestamp(): string {
    const now = new Date();
    const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
    const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `${date} ${time}`;
}

/** Apply thin gray border to a cell. */
function applyBorder(cell: ExcelJS.Cell): void {
    cell.border = {
        top:    { style: 'thin', color: { argb: GRAY_BORDER } },
        bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
        left:   { style: 'thin', color: { argb: GRAY_BORDER } },
        right:  { style: 'thin', color: { argb: GRAY_BORDER } },
    };
}

// ── Column definitions ─────────────────────────────────────

const COLUMNS: { header: string; width: number; key: string }[] = [
    { header: 'Usuario',             width: 20, key: 'user' },
    { header: 'C\u00f3digo',              width: 16, key: 'code' },
    { header: 'Cliente',             width: 28, key: 'client' },
    { header: 'Asunto',              width: 34, key: 'subject' },
    { header: 'Estado',              width: 18, key: 'status' },
    { header: 'Adquisici\u00f3n',         width: 14, key: 'acquisition' },
    { header: 'Fecha Cierre',        width: 14, key: 'closeDate' },
    { header: 'Fecha Facturaci\u00f3n',   width: 16, key: 'billingDate' },
    { header: 'Moneda',              width: 10, key: 'currency' },
    { header: 'Subtotal Min.',       width: 20, key: 'subtotal' },
    { header: 'USD Est.',            width: 20, key: 'usdEst' },
    { header: '\u00daltima Actualizaci\u00f3n', width: 18, key: 'updatedAt' },
    { header: 'Tipo',                width: 14, key: 'type' },
];

/** Numeric column indices (1-based) that should be right-aligned with thousands format. */
const NUMERIC_COLUMNS = new Set([10, 11]);

// ── Main export ────────────────────────────────────────────

export async function exportDashboardToExcel(opts: DashboardExportOptions): Promise<void> {
    const { rows, trmRate, userName, activeFilters } = opts;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NovoTechFlow';
    wb.created = new Date();

    const ws = wb.addWorksheet('Forecast');

    // Column widths
    ws.columns = COLUMNS.map(c => ({ width: c.width }));

    // ── Info header (row 1) ──
    const infoRow = ws.addRow([`Informe Forecast — Generado por: ${userName}`]);
    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const infoCell = infoRow.getCell(1);
    infoCell.font = { bold: true, size: 12, color: { argb: WHITE } };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_HEADER } };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    infoRow.height = 30;

    // Optional filter description (row 2)
    if (activeFilters) {
        const filterRow = ws.addRow([`Filtros: ${activeFilters}`]);
        ws.mergeCells(2, 1, 2, COLUMNS.length);
        const fCell = filterRow.getCell(1);
        fCell.font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
        fCell.alignment = { vertical: 'middle', horizontal: 'left' };
    }

    // ── Table header ──
    const headerValues = COLUMNS.map(c => c.header);
    const headerRow = ws.addRow(headerValues);
    headerRow.height = 30;
    headerRow.eachCell(cell => {
        cell.font = { bold: true, size: 9, color: { argb: WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_HEADER } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        applyBorder(cell);
    });

    // ── Data rows ──
    let subtotalSum = 0;
    let usdSum = 0;

    rows.forEach((row, idx) => {
        const statusLabel = STATUS_CONFIG[row.status]?.label ?? row.status;
        const acqLabel = row.acquisitionType && ACQUISITION_CONFIG[row.acquisitionType]
            ? ACQUISITION_CONFIG[row.acquisitionType].label
            : '—';
        const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);

        if (row.minSubtotal !== null) subtotalSum += row.minSubtotal;
        if (usdEst !== null) usdSum += usdEst;

        const dataRow = ws.addRow([
            row.user?.name || '—',
            row.code,
            row.clientName,
            row.subject || '—',
            statusLabel,
            acqLabel,
            formatDateDDMMYYYY(row.closeDate),
            formatDateDDMMYYYY(row.billingDate),
            row.minSubtotalCurrency || '—',
            row.minSubtotal ?? 0,
            usdEst ?? 0,
            formatDateDDMMYYYY(row.updatedAt),
            row.isProjection ? 'Proyecci\u00f3n' : 'Propuesta',
        ]);

        const isAlternate = idx % 2 === 1;

        dataRow.eachCell((cell, colNumber) => {
            cell.font = { size: 10, color: { argb: 'FF1E293B' } };
            cell.alignment = { vertical: 'middle', wrapText: colNumber === 4 };
            applyBorder(cell);

            // Alternating row background
            if (isAlternate) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
            }

            // Numeric columns: right-align + thousands separator
            if (NUMERIC_COLUMNS.has(colNumber)) {
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                cell.numFmt = '#,##0.00';
            }
        });

        // Status cell coloring (column 5)
        const statusColors = STATUS_FILL[row.status];
        if (statusColors) {
            const statusCell = dataRow.getCell(5);
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors.bg } };
            statusCell.font = { size: 10, bold: true, color: { argb: statusColors.fg } };
        }

        // Acquisition cell coloring (column 6)
        if (row.acquisitionType && ACQ_FILL[row.acquisitionType]) {
            const acqColors = ACQ_FILL[row.acquisitionType];
            const acqCell = dataRow.getCell(6);
            acqCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: acqColors.bg } };
            acqCell.font = { size: 10, bold: true, color: { argb: acqColors.fg } };
        }
    });

    // ── Summary row ──
    if (rows.length > 0) {
        const summaryRow = ws.addRow([
            '', '', '', '', '', '', '', '',
            'TOTALES',
            subtotalSum,
            usdSum,
            '', '',
        ]);

        summaryRow.eachCell((cell, colNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_SUMMARY } };
            cell.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
            cell.alignment = { vertical: 'middle' };
            applyBorder(cell);

            if (NUMERIC_COLUMNS.has(colNumber)) {
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                cell.numFmt = '#,##0.00';
            }
        });

        const labelCell = summaryRow.getCell(9);
        labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
        labelCell.font = { bold: true, size: 11, color: { argb: INDIGO_HEADER } };
    }

    // Freeze panes below header
    ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 0 }];

    // ── Generate and download ──
    const fileName = `Informe Forecast ${buildTimestamp()}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName,
    );
}
