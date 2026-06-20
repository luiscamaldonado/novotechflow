import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ITEM_TYPE_LABELS, SPEC_FIELDS_BY_ITEM_TYPE } from './constants';
import type { ConsolidatedTechItem } from './consolidateTechnicalItems';
import type { ProcessedScenario } from '../hooks/useProposalScenarios';
import { buildQuickDescription, getUnitOfMeasure } from './itemDescription';

// ── Brand colours (same palette as exportExcel.ts) ──────────
const INDIGO_600 = 'FF4F46E5';
const INDIGO_50 = 'FFEEF2FF';
const SLATE_900 = 'FF0F172A';
const SLATE_50 = 'FFF8FAFC';
const SLATE_400 = 'FF94A3B8';
const EMERALD_600 = 'FF059669';
const EMERALD_50 = 'FFECFDF5';
const AMBER_600 = 'FFD97706';
const WHITE = 'FFFFFFFF';

// ── Tech sheet layout constants ─────────────────────────────
const TECH_SHEET_COL_A_WIDTH = 28;
const TECH_SHEET_COL_B_WIDTH = 60;
const TECH_SHEET_TITLE_FONT_SIZE = 12;
const TECH_SHEET_SUBTITLE_TEXT = 'ESPECIFICACIONES TÉCNICAS';
const TECH_SHEET_NO_SPECS_TEXT = 'Sin especificaciones técnicas';
const TECH_SHEET_LABEL_TIPO = 'Tipo';
const TECH_SHEET_LABEL_NOMBRE = 'Nombre';
const TECH_SHEET_LABEL_CONDICION = 'Condición';
const TECH_SHEET_TAXABLE_TEXT = 'Gravado 19%';
const TECH_SHEET_NON_TAXABLE_TEXT = 'No Gravado';

// ── Sheet names ─────────────────────────────────────────────
const SHEET_TECH = 'Ficha Técnica';
const SHEET_PRICES = 'Precios de Venta';

// ── Excel currency formats ──────────────────────────────────
const COP_NUM_FMT = '"$"#,##0.00';
const USD_NUM_FMT = '"USD $"#,##0.00';

// ── Filename prefix ─────────────────────────────────────────
const FILE_PREFIX = 'Propuesta';

// ── Filename-unsafe characters ──────────────────────────────
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|]/g;

// ── Separator rows between scenarios ────────────────────────
const SCENARIO_SEPARATOR_ROWS = 2;

/** Rows vacías entre bloques de ficha técnica */
const TECH_BLOCK_SEPARATOR_ROWS = 2;

// ── Types ───────────────────────────────────────────────────

interface ExportProposalExcelArgs {
    consolidatedItems: ConsolidatedTechItem[];
    variantLabelByScenarioItemId: Map<string, string | null>;
    processedScenarios: ProcessedScenario[];
    proposalCode: string;
    clientName: string;
}

// ── Helpers ─────────────────────────────────────────────────

/** Sets column widths based on the longest cell content (simplified heuristic) */
function autoFitColumns(ws: ExcelJS.Worksheet): void {
    ws.columns.forEach(col => {
        let maxLen = 10;
        col.eachCell?.({ includeEmpty: false }, cell => {
            const len = String(cell.value ?? '').length;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 4, 50);
    });
}

/** Returns the ExcelJS number format string for a given currency */
function currencyFormat(currency: string): string {
    return currency === 'USD' ? USD_NUM_FMT : COP_NUM_FMT;
}

/** Thin border style reused across spec rows */
const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

/**
 * Builds spec entries for an item — same logic as TechnicalSpecSheet.tsx:
 * Object.entries(SPEC_FIELDS_BY_ITEM_TYPE[itemType]), filtering those with a non-empty value.
 */
function buildSpecEntries(
    itemType: string,
    specs: Record<string, string> | undefined,
): Array<{ label: string; value: string }> {
    if (!specs) return [];
    const specFieldsDef = SPEC_FIELDS_BY_ITEM_TYPE[itemType] || {};
    return Object.entries(specFieldsDef)
        .filter(([key]) => specs[key]?.trim())
        .map(([key, def]) => ({ label: def.label, value: specs[key] }));
}

/** Adds a key-value row (col A = label, col B = value) with styling */
function addMetaRow(
    ws: ExcelJS.Worksheet,
    label: string,
    value: string,
    valueStyle?: Partial<ExcelJS.Font>,
): void {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 10, color: { argb: SLATE_900 } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
    row.getCell(1).alignment = { vertical: 'middle' };
    row.getCell(2).font = { size: 10, color: { argb: SLATE_900 }, ...valueStyle };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
}

// ── Sheet builders ──────────────────────────────────────────

function buildTechSheet(
    wb: ExcelJS.Workbook,
    items: ConsolidatedTechItem[],
    variantMap: Map<string, string | null>,
): void {
    const ws = wb.addWorksheet(SHEET_TECH);
    ws.columns = [
        { width: TECH_SHEET_COL_A_WIDTH },
        { width: TECH_SHEET_COL_B_WIDTH },
    ];

    const totalItems = items.length;

    for (const ci of items) {
        const { item: visibleItem, globalIndex, variantLabel } = ci;
        const proposalItem = visibleItem.scenarioItem.item;
        const label = variantMap.get(visibleItem.scenarioItem.id) ?? variantLabel ?? null;

        // Fila A — Título del item
        const titleText = `Item ${globalIndex} de ${totalItems}${label ? '  ·  ' + label : ''}`;
        const titleRow = ws.addRow([titleText]);
        ws.mergeCells(titleRow.number, 1, titleRow.number, 2);
        titleRow.getCell(1).font = { bold: true, size: TECH_SHEET_TITLE_FONT_SIZE, color: { argb: WHITE } };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_600 } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

        // Fila B — Tipo
        const typeLabel = ITEM_TYPE_LABELS[proposalItem.itemType] ?? proposalItem.itemType;
        addMetaRow(ws, TECH_SHEET_LABEL_TIPO, typeLabel);

        // Fila C — Nombre
        addMetaRow(ws, TECH_SHEET_LABEL_NOMBRE, proposalItem.name, { bold: true });

        // Fila D — Condición tributaria
        const isTaxable = proposalItem.isTaxable;
        const condText = isTaxable ? TECH_SHEET_TAXABLE_TEXT : TECH_SHEET_NON_TAXABLE_TEXT;
        const condColor = isTaxable ? EMERALD_600 : AMBER_600;
        addMetaRow(ws, TECH_SHEET_LABEL_CONDICION, condText, { bold: true, color: { argb: condColor } });

        // Build spec entries (same logic as TechnicalSpecSheet.tsx)
        const specEntries = buildSpecEntries(proposalItem.itemType, proposalItem.technicalSpecs);

        if (specEntries.length > 0) {
            // Fila E — Subtítulo de sección
            const subtitleRow = ws.addRow([TECH_SHEET_SUBTITLE_TEXT]);
            ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, 2);
            subtitleRow.getCell(1).font = { bold: true, size: 10, color: { argb: SLATE_900 } };
            subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_50 } };
            subtitleRow.getCell(1).alignment = { vertical: 'middle' };

            // Filas F+ — Spec rows with alternating backgrounds
            for (let sIdx = 0; sIdx < specEntries.length; sIdx++) {
                const entry = specEntries[sIdx];
                const bgColor = sIdx % 2 === 0 ? SLATE_50 : WHITE;
                const specRow = ws.addRow([entry.label, entry.value]);

                specRow.getCell(1).font = { bold: true, size: 10, color: { argb: SLATE_900 } };
                specRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                specRow.getCell(1).alignment = { vertical: 'middle' };
                specRow.getCell(1).border = THIN_BORDER;

                specRow.getCell(2).font = { size: 10, color: { argb: SLATE_900 } };
                specRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                specRow.getCell(2).alignment = { vertical: 'middle', wrapText: true };
                specRow.getCell(2).border = THIN_BORDER;
            }
        } else {
            // No specs — single italic row
            const noSpecsRow = ws.addRow([TECH_SHEET_NO_SPECS_TEXT]);
            ws.mergeCells(noSpecsRow.number, 1, noSpecsRow.number, 2);
            noSpecsRow.getCell(1).font = { italic: true, size: 10, color: { argb: SLATE_400 } };
            noSpecsRow.getCell(1).alignment = { vertical: 'middle' };
        }

        // Separator between blocks
        for (let s = 0; s < TECH_BLOCK_SEPARATOR_ROWS; s++) ws.addRow([]);
    }
}

function buildPricesSheet(
    wb: ExcelJS.Workbook,
    scenarios: ProcessedScenario[],
    variantMap: Map<string, string | null>,
): void {
    const ws = wb.addWorksheet(SHEET_PRICES);
    const COL_COUNT = 6;

    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
        const scenario = scenarios[sIdx];
        const fmt = currencyFormat(scenario.currency);

        // Scenario title row
        const titleRow = ws.addRow([`${scenario.name} — ${scenario.currency}`]);
        ws.mergeCells(titleRow.number, 1, titleRow.number, COL_COUNT);
        titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: WHITE } };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Column headers
        const colHeaders = ['Item', 'Descripción rápida', 'Unidad', 'Cantidad', 'Vr. Unitario', 'Vr. Total'];
        const hRow = ws.addRow(colHeaders);
        hRow.eachCell(cell => {
            cell.font = { bold: true, size: 10, color: { argb: SLATE_900 } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_50 } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        // Item rows
        for (const vi of scenario.visibleItems) {
            const item = vi.scenarioItem.item;
            const variantLabel = variantMap.get(vi.scenarioItem.id) ?? null;
            const displayName = variantLabel ? `${item.name} — ${variantLabel}` : item.name;
            const desc = buildQuickDescription(item.itemType, item.technicalSpecs);
            const unit = getUnitOfMeasure(item.itemType, item.technicalSpecs);

            const dRow = ws.addRow([displayName, desc, unit, vi.quantity, vi.unitSalePrice, vi.subtotalBeforeVat]);
            // Currency format for price columns
            dRow.getCell(5).numFmt = fmt;
            dRow.getCell(6).numFmt = fmt;
            dRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            dRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
            dRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        }

        // Totals
        const { totals } = scenario;
        const totalRows: Array<{ label: string; value: number; isTotal?: boolean }> = [
            { label: 'Subtotal Gravado', value: totals.subtotalGravado },
            { label: 'Subtotal No Gravado', value: totals.subtotalNoGravado },
            { label: 'IVA', value: totals.iva },
            { label: 'Total', value: totals.total, isTotal: true },
        ];

        for (const tr of totalRows) {
            const row = ws.addRow(['', '', '', '', tr.label, tr.value]);
            row.getCell(5).font = { bold: true, size: 10, color: { argb: SLATE_900 } };
            row.getCell(6).numFmt = fmt;
            row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

            if (tr.isTotal) {
                row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD_50 } };
                row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD_50 } };
                row.getCell(5).font = { bold: true, size: 10, color: { argb: EMERALD_600 } };
                row.getCell(6).font = { bold: true, size: 10, color: { argb: EMERALD_600 } };
            } else {
                row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
                row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
            }
        }

        // Separator before next scenario
        if (sIdx < scenarios.length - 1) {
            for (let s = 0; s < SCENARIO_SEPARATOR_ROWS; s++) ws.addRow([]);
        }
    }

    autoFitColumns(ws);
}

// ── Public API ──────────────────────────────────────────────

export async function exportProposalExcel(args: ExportProposalExcelArgs): Promise<void> {
    const { consolidatedItems, variantLabelByScenarioItemId, processedScenarios, proposalCode, clientName } = args;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NovoTechFlow';
    wb.created = new Date();

    buildTechSheet(wb, consolidatedItems, variantLabelByScenarioItemId);
    buildPricesSheet(wb, processedScenarios, variantLabelByScenarioItemId);

    const safeClient = clientName.replace(UNSAFE_FILENAME_CHARS, '_');
    const fileName = `${FILE_PREFIX}_${proposalCode}_${safeClient}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName,
    );
}
