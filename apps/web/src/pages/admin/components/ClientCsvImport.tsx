import { useState, useRef } from 'react';
import {
    Loader2, CheckCircle2, AlertTriangle, Upload, XCircle,
} from 'lucide-react';
import { readFileWithEncoding, cleanCsvValue } from '../../../lib/csv-utils';
import { validateCsvFile, ACCEPT_CSV } from '../../../lib/file-validation';
import type { ClientBulkImportResult } from '../../../hooks/useClientsAdmin';

// ── CSV helpers ──────────────────────────────────────────────

interface ClientCsvRow { name: string }

/** Known header values that should be skipped if found as the first line. */
const CLIENT_CSV_HEADERS = new Set(['name', 'nombre', 'cliente']);

interface ClientParseResult {
    rows: ClientCsvRow[];
    error: string | null;
}

/**
 * Parses a single-column CSV of client names.
 * Skips the first line if it matches a known header keyword.
 * Ignores empty lines and trims whitespace.
 *
 * For multi-column CSVs, validates that a "name" column exists.
 */
function parseClientCsv(text: string): ClientParseResult {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { rows: [], error: null };

    /* Multi-column format: validate that "name" column exists in the header */
    const firstLineHasComma = lines[0].includes(',');
    if (firstLineHasComma) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const hasName = headers.some(h => h === 'name' || h === 'nombre' || h === 'cliente');
        if (!hasName) {
            return {
                rows: [],
                error: 'El archivo CSV no tiene la columna requerida "name".',
            };
        }
    }

    const startIndex = CLIENT_CSV_HEADERS.has(lines[0].toLowerCase()) ? 1 : 0;

    const rows = lines.slice(startIndex).reduce<ClientCsvRow[]>((acc, line) => {
        /* For multi-column CSVs, take only the first column */
        const name = firstLineHasComma ? line.split(',')[0].trim() : line;
        if (name) acc.push({ name: cleanCsvValue(name).slice(0, 255) });
        return acc;
    }, []);

    if (rows.length === 0) {
        return {
            rows: [],
            error: 'No se encontraron filas v\u00e1lidas. Verifica que el CSV tenga la columna "name" con datos.',
        };
    }

    return { rows, error: null };
}

const CSV_PREVIEW_LIMIT = 5;

// ── Types ────────────────────────────────────────────────────

interface ClientCsvImportProps {
    onBulkImport: (items: ClientCsvRow[]) => Promise<ClientBulkImportResult>;
}

// ── Component ────────────────────────────────────────────────

/**
 * Self-contained CSV import for clients.
 * Single-column CSV with header "name".
 * Renders trigger button + conditional preview/result panels.
 */
export default function ClientCsvImport({ onBulkImport }: ClientCsvImportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [csvRows, setCsvRows] = useState<ClientCsvRow[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ClientBulkImportResult | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

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
            const result = parseClientCsv(text);

            if (result.error) {
                setParseError(result.error);
                setCsvRows([]);
            } else {
                setCsvRows(result.rows);
                setParseError(null);
            }
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

    return (
        <div>
            <input ref={fileInputRef} type="file" accept={ACCEPT_CSV} className="hidden" onChange={handleFileChange} />

            {/* Trigger button */}
            <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
            >
                <Upload className="h-4 w-4" />
                <span>Importar CSV</span>
            </button>

            {/* Parse/validation error toast */}
            {parseError && (
                <div className="fixed top-6 right-6 z-50 bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center space-x-4 shadow-2xl max-w-md">
                    <div className="flex items-center space-x-2">
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <span className="text-sm font-bold text-red-700">{parseError}</span>
                    </div>
                    <button onClick={() => setParseError(null)} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                        <span className="text-xs font-black uppercase tracking-widest">✕</span>
                    </button>
                </div>
            )}

            {/* Preview panel */}
            {csvRows.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 p-4">
                    <div className="max-w-[1400px] mx-auto bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <span className="text-sm font-black text-amber-700">
                                    Vista previa: {csvRows.length} cliente{csvRows.length !== 1 ? 's' : ''} a importar
                                </span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={handleConfirmImport} disabled={isImporting}
                                    className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors disabled:opacity-60">
                                    {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                    <span>Confirmar importación</span>
                                </button>
                                <button onClick={() => { setCsvRows([]); setImportResult(null); }}
                                    className="px-4 py-2 text-amber-500 font-black text-[10px] uppercase tracking-widest hover:text-amber-700 transition-colors">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-amber-50/50 border-b border-amber-100">
                                    <th className="px-4 py-2 text-left text-[10px] font-black text-amber-500 uppercase tracking-widest">Nombre</th>
                                </tr></thead>
                                <tbody>
                                    {csvRows.slice(0, CSV_PREVIEW_LIMIT).map((row, idx) => (
                                        <tr key={idx} className="border-b border-amber-50 last:border-0">
                                            <td className="px-4 py-2 font-bold text-slate-700">{row.name}</td>
                                        </tr>
                                    ))}
                                    {csvRows.length > CSV_PREVIEW_LIMIT && (
                                        <tr><td className="px-4 py-2 text-center text-xs text-amber-500 font-bold">
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
            {importResult !== null && (
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
