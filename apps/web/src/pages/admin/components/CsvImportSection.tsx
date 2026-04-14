import { useState, useRef } from 'react';
import {
    Loader2, CheckCircle2, AlertTriangle, Upload, XCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { FIELD_NAME_LABELS, SPEC_FIELD_NAMES } from '../../../hooks/useSpecOptionsAdmin';
import { readFileWithEncoding, cleanCsvValue } from '../../../lib/csv-utils';
import { validateCsvFile, ACCEPT_CSV } from '../../../lib/file-validation';
import type { SpecFieldName, BulkImportResult } from '../../../hooks/useSpecOptionsAdmin';

// ── Constants ────────────────────────────────────────────────

const CSV_PREVIEW_LIMIT = 5;

/** Set of valid fieldName keys for header-line detection. */
const VALID_FIELD_NAMES = new Set<string>(SPEC_FIELD_NAMES);

// ── CSV helpers ──────────────────────────────────────────────

interface CsvRow { fieldName: string; value: string }

interface ParseResult {
    rows: CsvRow[];
    error: string | null;
    isSingleColumn: boolean;
}

/**
 * Detects and parses CSV in two formats:
 * - Two-column: `fieldName,value` (first line = header, skipped)
 * - Single-column: one value per line (requires `selectedField`)
 */
function parseCsv(text: string, selectedField: SpecFieldName | ''): ParseResult {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { rows: [], error: null, isSingleColumn: false };

    const firstLineHasComma = lines[0].includes(',');

    if (firstLineHasComma) {
        return parseTwoColumnCsv(lines);
    }

    return parseSingleColumnCsv(lines, selectedField);
}

function parseTwoColumnCsv(lines: string[]): ParseResult {
    /* Skip header row (first line) */
    const dataLines = lines.slice(1);

    const rows = dataLines.reduce<CsvRow[]>((acc, line) => {
        const [fieldName, value] = line.split(',').map(s => s.trim());
        if (fieldName && value) acc.push({ fieldName, value: cleanCsvValue(value).slice(0, 255) });
        return acc;
    }, []);

    return { rows, error: null, isSingleColumn: false };
}

function parseSingleColumnCsv(
    lines: string[],
    selectedField: SpecFieldName | '',
): ParseResult {
    if (!selectedField) {
        return {
            rows: [],
            error: 'Selecciona un campo antes de importar un CSV de una sola columna.',
            isSingleColumn: true,
        };
    }

    /* If first line matches a known fieldName, treat it as header and skip it */
    const startIndex = VALID_FIELD_NAMES.has(lines[0].toLowerCase()) ? 1 : 0;

    const rows = lines.slice(startIndex).reduce<CsvRow[]>((acc, value) => {
        if (value) acc.push({ fieldName: selectedField, value: cleanCsvValue(value).slice(0, 255) });
        return acc;
    }, []);

    return { rows, error: null, isSingleColumn: true };
}

// ── Types ────────────────────────────────────────────────────

interface CsvImportSectionProps {
    onBulkImport: (items: CsvRow[]) => Promise<BulkImportResult>;
    /** Currently selected field in the parent page filter. */
    selectedField: SpecFieldName | '';
    /** When true the import button is visually disabled and non-interactive. */
    disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────

/**
 * Self-contained CSV import section.
 * Supports both single-column (requires `selectedField`) and
 * two-column `fieldName,value` CSV formats.
 */
export default function CsvImportSection({ onBulkImport, selectedField, disabled = false }: CsvImportSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isSingleColumn, setIsSingleColumn] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = await validateCsvFile(file);
        if (!validation.valid) {
            setParseError(validation.error ?? 'Archivo no v\u00e1lido.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            const text = await readFileWithEncoding(file);
            const result = parseCsv(text, selectedField);

            setCsvRows(result.rows);
            setParseError(result.error);
            setIsSingleColumn(result.isSingleColumn);
            setImportResult(null);
        } catch (error) {
            console.error('Error reading CSV file:', error);
            setParseError('Error al leer el archivo CSV.');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmImport = async () => {
        if (csvRows.length === 0) return;
        setIsImporting(true);
        try {
            const result = await onBulkImport(csvRows);
            setImportResult(result);
            setCsvRows([]);
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { message?: string } } };
            const message = axiosError.response?.data?.message || 'Error al importar el archivo CSV.';
            setParseError(message);
            setCsvRows([]);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDismissError = () => setParseError(null);

    const hasPendingPreview = csvRows.length > 0;
    const hasResult = importResult !== null;

    /** Preview label: "4 opciones para Fabricante" or generic count */
    const previewLabel = isSingleColumn && selectedField
        ? `${csvRows.length} opciones para ${FIELD_NAME_LABELS[selectedField]}`
        : `${csvRows.length} registro${csvRows.length !== 1 ? 's' : ''} a importar`;

    return (
        <div>
            <input ref={fileInputRef} type="file" accept={ACCEPT_CSV} className="hidden" onChange={handleFileChange} />

            {/* Trigger button */}
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className={cn(
                    'flex items-center space-x-2 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest',
                    disabled
                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600',
                )}
            >
                <Upload className="h-4 w-4" />
                <span>Importar CSV</span>
            </button>

            {/* Parse error toast */}
            {parseError && (
                <div className="fixed top-6 right-6 z-50 bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center space-x-4 shadow-2xl max-w-md">
                    <div className="flex items-center space-x-2">
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <span className="text-sm font-bold text-red-700">{parseError}</span>
                    </div>
                    <button onClick={handleDismissError} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                        <span className="text-xs font-black uppercase tracking-widest">✕</span>
                    </button>
                </div>
            )}

            {/* Preview panel */}
            {hasPendingPreview && (
                <div className="fixed inset-x-0 bottom-0 z-40 p-4">
                    <div className="max-w-[1400px] mx-auto bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <span className="text-sm font-black text-amber-700">
                                    Vista previa: {previewLabel}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={isImporting}
                                    className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors disabled:opacity-60"
                                >
                                    {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                    <span>Confirmar importación</span>
                                </button>
                                <button
                                    onClick={() => { setCsvRows([]); setImportResult(null); }}
                                    className="px-4 py-2 text-amber-500 font-black text-[10px] uppercase tracking-widest hover:text-amber-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-amber-50/50 border-b border-amber-100">
                                    <th className="px-4 py-2 text-left text-[10px] font-black text-amber-500 uppercase tracking-widest">Campo</th>
                                    <th className="px-4 py-2 text-left text-[10px] font-black text-amber-500 uppercase tracking-widest">Valor</th>
                                </tr></thead>
                                <tbody>
                                    {csvRows.slice(0, CSV_PREVIEW_LIMIT).map((row, idx) => (
                                        <tr key={idx} className="border-b border-amber-50 last:border-0">
                                            <td className="px-4 py-2 font-bold text-slate-700">
                                                {FIELD_NAME_LABELS[row.fieldName as SpecFieldName] || row.fieldName}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600">{row.value}</td>
                                        </tr>
                                    ))}
                                    {csvRows.length > CSV_PREVIEW_LIMIT && (
                                        <tr><td colSpan={2} className="px-4 py-2 text-center text-xs text-amber-500 font-bold">
                                            … y {csvRows.length - CSV_PREVIEW_LIMIT} más
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Import result toast */}
            {hasResult && (
                <div className="fixed top-6 right-6 z-50 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center space-x-4 shadow-2xl max-w-md">
                    <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        <span className="text-sm font-bold text-emerald-700">
                            {importResult.created} creados, {importResult.duplicates} duplicados omitidos.
                        </span>
                    </div>
                    <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600 transition-colors shrink-0">
                        <span className="text-xs font-black uppercase tracking-widest">✕</span>
                    </button>
                </div>
            )}
        </div>
    );
}
