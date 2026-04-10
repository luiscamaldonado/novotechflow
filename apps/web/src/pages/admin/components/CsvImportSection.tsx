import { useState, useRef } from 'react';
import {
    Loader2, CheckCircle2, AlertTriangle, Upload,
} from 'lucide-react';
import { FIELD_NAME_LABELS } from '../../../hooks/useSpecOptionsAdmin';
import type { SpecFieldName, BulkImportResult } from '../../../hooks/useSpecOptionsAdmin';

// ── CSV helpers ──────────────────────────────────────────────

interface CsvRow { fieldName: string; value: string }

function parseCsv(text: string): CsvRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    return lines.slice(1).reduce<CsvRow[]>((acc, line) => {
        const [fieldName, value] = line.split(',').map(s => s.trim());
        if (fieldName && value) {
            acc.push({ fieldName, value });
        }
        return acc;
    }, []);
}

const CSV_PREVIEW_LIMIT = 5;

// ── Types ────────────────────────────────────────────────────

interface CsvImportSectionProps {
    onBulkImport: (items: CsvRow[]) => Promise<BulkImportResult>;
}

// ── Component ────────────────────────────────────────────────

/**
 * Self-contained CSV import section.
 * Renders a trigger button + conditional preview/result panels.
 * Place inside a vertical `space-y-*` container so the panels
 * appear below other header elements.
 */
export default function CsvImportSection({ onBulkImport }: CsvImportSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setCsvRows(parseCsv(text));
            setImportResult(null);
        };
        reader.readAsText(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmImport = async () => {
        if (csvRows.length === 0) return;
        setIsImporting(true);
        try {
            const result = await onBulkImport(csvRows);
            setImportResult(result);
            setCsvRows([]);
        } catch (error) {
            console.error('Error importing CSV:', error);
        } finally {
            setIsImporting(false);
        }
    };

    const hasPendingPreview = csvRows.length > 0;
    const hasResult = importResult !== null;

    return (
        <div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

            {/* Trigger button */}
            <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
            >
                <Upload className="h-4 w-4" />
                <span>Importar CSV</span>
            </button>

            {/* Preview panel — renders as a fixed-position overlay to avoid layout disruption */}
            {hasPendingPreview && (
                <div className="fixed inset-x-0 bottom-0 z-40 p-4">
                    <div className="max-w-[1400px] mx-auto bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <span className="text-sm font-black text-amber-700">
                                    Vista previa: {csvRows.length} registro{csvRows.length !== 1 ? 's' : ''} a importar
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
