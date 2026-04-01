import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Scenario, ScenarioItem, ProposalCalcItem } from '../hooks/useScenarios';
import { ITEM_TYPE_LABELS } from './constants';

// ── Types ──────────────────────────────────────────────
interface ExportOptions {
    proposalCode: string;
    clientName: string;
    userName: string;
    scenarios: Scenario[];
    proposalItems: ProposalCalcItem[];
    acquisitionModes: Record<string, string>;
}

// ── Brand colours matching the app ──────────────────────
const INDIGO_600 = 'FF4F46E5';
const INDIGO_50 = 'FFEEF2FF';
const SLATE_900 = 'FF0F172A';
const SLATE_50 = 'FFF8FAFC';
const EMERALD_600 = 'FF059669';
const EMERALD_50 = 'FFECFDF5';
const AMBER_600 = 'FFD97706';
const WHITE = 'FFFFFFFF';

// ── Helper: get "formato | tipo" and "fabricante | responsable" ──
function getTypeField(specs?: Record<string, string | undefined>): string {
    if (!specs) return '';
    return specs.formato || specs.tipo || '';
}

function getManufacturerField(specs?: Record<string, string | undefined>): string {
    if (!specs) return '';
    return specs.fabricante || specs.responsable || '';
}

// ── Main export function ──────────────────────────────
export async function exportToExcel(opts: ExportOptions) {
    const { proposalCode, clientName, userName, scenarios, proposalItems, acquisitionModes } = opts;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NovoTechFlow';
    wb.created = new Date();

    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
        const scenario = scenarios[sIdx];
        const sheetName = scenario.name.length > 31 ? scenario.name.substring(0, 31) : scenario.name;
        const ws = wb.addWorksheet(sheetName);

        // ── Column widths ──
        ws.columns = [
            { width: 8 },   // A - ITEM
            { width: 22 },  // B - CATEGORÍA
            { width: 35 },  // C - NOMBRE
            { width: 18 },  // D - TIPO
            { width: 18 },  // E - FABRICANTE
            { width: 40 },  // F - DESCRIPCIÓN
            { width: 10 },  // G - CANTIDAD
            { width: 18 },  // H - COSTO UNITARIO
            { width: 8 },   // I - IVA
            { width: 18 },  // J - SUBTOTAL COSTO
            { width: 20 },  // K - TOTAL COSTO + IVA
            { width: 16 },  // L - MARGEN UNITARIO
            { width: 18 },  // M - VENTA UNITARIA
            { width: 18 },  // N - SUBTOTAL VENTA
            { width: 20 },  // O - TOTAL VENTA + IVA
        ];

        // ── Acquisition mode ──
        const acqMode = acquisitionModes[scenario.id] || 'VENTA';
        const acqLabel = acqMode === 'VENTA' ? 'VENTA'
            : acqMode === 'DAAS_12' ? 'DaaS 12 Meses'
            : acqMode === 'DAAS_24' ? 'DaaS 24 Meses'
            : acqMode === 'DAAS_36' ? 'DaaS 36 Meses'
            : acqMode === 'DAAS_48' ? 'DaaS 48 Meses'
            : acqMode === 'DAAS_60' ? 'DaaS 60 Meses'
            : 'VENTA';

        // ── Header info rows ──
        const headerRows = [
            [scenario.name.toUpperCase(), ''],
            ['USUARIO', userName],
            ['COTIZACIÓN', proposalCode],
            ['CLIENTE', clientName],
            ['ADQUISICIÓN', acqLabel],
            ['MONEDA', scenario.currency || 'COP'],
        ];

        for (let r = 0; r < headerRows.length; r++) {
            const row = ws.addRow([headerRows[r][0], headerRows[r][1]]);
            const labelCell = row.getCell(1);
            const valueCell = row.getCell(2);

            labelCell.font = { bold: true, size: r === 0 ? 14 : 11, color: { argb: r === 0 ? INDIGO_600 : SLATE_900 } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 0 ? INDIGO_50 : SLATE_50 } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

            valueCell.font = { bold: r === 0, size: r === 0 ? 14 : 11, color: { argb: r === 0 ? INDIGO_600 : SLATE_900 } };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 0 ? INDIGO_50 : WHITE } };
            valueCell.alignment = { vertical: 'middle', horizontal: 'left' };

            if (r === 0) {
                ws.mergeCells(row.number, 1, row.number, 15);
                labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                ws.mergeCells(row.number, 2, row.number, 15);
            }
        }

        // Empty spacer row
        ws.addRow([]);

        // ── Table header ──
        const TABLE_HEADERS = [
            'ITEM', 'CATEGORÍA', 'NOMBRE', 'TIPO', 'FABRICANTE',
            'DESCRIPCIÓN', 'CANT.', 'COSTO UNIT.', 'IVA',
            'SUBTOTAL COSTO', 'TOTAL COSTO + IVA',
            'MARGEN UNIT.', 'VENTA UNIT.',
            'SUBTOTAL VENTA', 'TOTAL VENTA + IVA',
        ];

        const headerRow = ws.addRow(TABLE_HEADERS);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 9, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: INDIGO_600 } },
                bottom: { style: 'thin', color: { argb: INDIGO_600 } },
                left:   { style: 'thin', color: { argb: INDIGO_600 } },
                right:  { style: 'thin', color: { argb: INDIGO_600 } },
            };
        });

        // ── Precompute dilution data ──
        const allItems = scenario.scenarioItems;
        const dilutedItems = allItems.filter(i => i.isDilpidate);
        const normalItems = allItems.filter(i => !i.isDilpidate);

        let totalDilutedCost = 0;
        dilutedItems.forEach(di => {
            totalDilutedCost += Number(di.item.unitCost) * di.quantity;
        });

        let totalNormalSubtotal = 0;
        normalItems.forEach(ni => {
            totalNormalSubtotal += Number(ni.item.unitCost) * ni.quantity;
        });

        // ── Data rows (only visible/normal items) ──
        normalItems
            .sort((a, b) => {
                const aIdx = proposalItems.findIndex(pi => pi.id === a.itemId);
                const bIdx = proposalItems.findIndex(pi => pi.id === b.itemId);
                return aIdx - bIdx;
            })
            .forEach((si, idx) => {
                const item = si.item;
                const piFromArchitect = proposalItems.find(pi => pi.id === si.itemId);
                const globalItemIdx = proposalItems.findIndex(pi => pi.id === si.itemId);
                const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;

                // ── Cost calculations (matching Ventana de Cálculos) ──
                const cost = Number(item.unitCost);
                const flete = Number(item.internalCosts?.fletePct || 0);
                const parentLandedCost = cost * (1 + flete / 100);

                // Children costs
                let childrenCostPerUnit = 0;
                const children = (si as ScenarioItem & { children?: ScenarioItem[] }).children || [];
                children.forEach(child => {
                    const cCost = Number(child.item.unitCost);
                    const cFlete = Number(child.item.internalCosts?.fletePct || 0);
                    childrenCostPerUnit += cCost * (1 + cFlete / 100) * child.quantity;
                });
                const baseLandedCost = parentLandedCost + (childrenCostPerUnit / si.quantity);

                // Dilution share
                let effectiveLandedCost = baseLandedCost;
                if (totalNormalSubtotal > 0 && totalDilutedCost > 0) {
                    const itemWeight = (cost * si.quantity) / totalNormalSubtotal;
                    const dilutionPerUnit = (itemWeight * totalDilutedCost) / si.quantity;
                    effectiveLandedCost = baseLandedCost + dilutionPerUnit;
                }

                const margin = si.marginPctOverride !== undefined && si.marginPctOverride !== null
                    ? Number(si.marginPctOverride)
                    : Number(item.marginPct);
                let unitPrice = 0;
                if (margin < 100) {
                    unitPrice = effectiveLandedCost / (1 - margin / 100);
                }

                const ivaPct = item.isTaxable ? 19 : 0;
                const ivaMultiplier = 1 + ivaPct / 100;
                const subtotalCost = effectiveLandedCost * si.quantity;
                const totalCostConIva = subtotalCost * ivaMultiplier;
                const subtotalVenta = unitPrice * si.quantity;
                const totalVentaConIva = subtotalVenta * ivaMultiplier;

                // Source data from ITEMS_ARCHITECT
                const specs = piFromArchitect?.technicalSpecs || item.technicalSpecs;
                const categoryLabel = ITEM_TYPE_LABELS[item.itemType] || item.itemType;
                const tipoField = getTypeField(specs);
                const fabricanteField = getManufacturerField(specs);
                const descriptionField = piFromArchitect?.description || (item as unknown as { description?: string }).description || '';

                const dataRow = ws.addRow([
                    displayIdx,
                    categoryLabel,
                    item.name,
                    tipoField,
                    fabricanteField,
                    descriptionField,
                    si.quantity,
                    effectiveLandedCost,
                    `${ivaPct}%`,
                    subtotalCost,
                    totalCostConIva,
                    `${margin.toFixed(2)}%`,
                    unitPrice,
                    subtotalVenta,
                    totalVentaConIva,
                ]);

                const isEvenRow = idx % 2 === 0;
                dataRow.eachCell((cell, colNumber) => {
                    cell.font = { size: 10, color: { argb: SLATE_900 } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? WHITE : SLATE_50 } };
                    cell.border = {
                        top:    { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        left:   { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
                    };
                    cell.alignment = { vertical: 'middle', wrapText: colNumber === 6 };

                    // Numeric columns: right alignment + currency format
                    if ([8, 10, 11, 13, 14, 15].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '"$"#,##0.00';
                    }
                    // Center columns
                    if ([1, 7, 9, 12].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    // Color highlights
                    if (colNumber === 8 || colNumber === 10 || colNumber === 11) {
                        // Cost columns: amber tint
                        cell.font = { size: 10, color: { argb: AMBER_600 }, bold: colNumber === 11 };
                    }
                    if (colNumber === 13 || colNumber === 14 || colNumber === 15) {
                        // Sales columns: emerald tint
                        cell.font = { size: 10, color: { argb: EMERALD_600 }, bold: colNumber === 15 };
                    }
                    if (colNumber === 12) {
                        // Margin: indigo
                        cell.font = { size: 10, color: { argb: INDIGO_600 }, bold: true };
                    }
                });
            });

        // ── Totals row ──
        const totalsStartRow = headerRow.number + 1;
        const totalsEndRow = headerRow.number + normalItems.length;

        if (normalItems.length > 0) {
            ws.addRow([]); // spacer
            const sumRow = ws.addRow([
                '', '', '', '', '', 'TOTALES', '', '', '', '',
                '', '', '', '', '',
            ]);

            // Sum formulas for numeric columns
            const sumColumns = [
                { col: 10, letter: 'J' }, // SUBTOTAL COSTO
                { col: 11, letter: 'K' }, // TOTAL COSTO + IVA
                { col: 14, letter: 'N' }, // SUBTOTAL VENTA
                { col: 15, letter: 'O' }, // TOTAL VENTA + IVA
            ];

            const labelCell = sumRow.getCell(6);
            labelCell.font = { bold: true, size: 11, color: { argb: WHITE } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_600 } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

            sumColumns.forEach(({ col, letter }) => {
                const cell = sumRow.getCell(col);
                cell.value = { formula: `SUM(${letter}${totalsStartRow}:${letter}${totalsEndRow})` };
                cell.numFmt = '"$"#,##0.00';
                cell.font = { bold: true, size: 11, color: { argb: col <= 11 ? AMBER_600 : EMERALD_600 } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col <= 11 ? 'FFFFFBEB' : EMERALD_50 } };
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                cell.border = {
                    top:    { style: 'medium', color: { argb: INDIGO_600 } },
                    bottom: { style: 'medium', color: { argb: INDIGO_600 } },
                };
            });

            // Style remaining cells in sum row
            for (let c = 1; c <= 15; c++) {
                if (c !== 6 && ![10, 11, 14, 15].includes(c)) {
                    const cell = sumRow.getCell(c);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_50 } };
                    cell.border = {
                        top:    { style: 'medium', color: { argb: INDIGO_600 } },
                        bottom: { style: 'medium', color: { argb: INDIGO_600 } },
                    };
                }
            }
        }

        // Freeze panes: first row + header
        ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 0 }];
    }

    // ── Generate and download ──
    const fileName = `${proposalCode}_${clientName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
