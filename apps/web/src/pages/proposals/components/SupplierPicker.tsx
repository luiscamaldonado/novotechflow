import { useState, useRef, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { normalizeSupplierName } from '../../../lib/supplierMatch';
import type { SupplierCompany } from '../../../lib/types';

/** Tope de opciones renderizadas del catalogo (~2000 empresas); el resto solo se indica. */
const MAX_VISIBLE_RESULTS = 50;

interface SupplierPickerProps {
    companies: SupplierCompany[];
    value: string | null;
    onChange: (companyId: string | null) => void;
    disabled?: boolean;
    required?: boolean;
    isLoading?: boolean;
    allowCreate?: boolean;
    onCreateRequest?: (name: string) => void;
}

function SupplierPicker({
    companies,
    value,
    onChange,
    disabled = false,
    required = false,
    isLoading = false,
    allowCreate = false,
    onCreateRequest,
}: SupplierPickerProps) {
    const selectedCompany = useMemo(
        () => (value ? companies.find(c => c.id === value) : undefined),
        [value, companies],
    );

    const [query, setQuery] = useState(selectedCompany?.name ?? '');
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const effectiveDisabled = disabled || isLoading;
    const trimmedQuery = query.trim();

    const filtered = useMemo(() => {
        if (!trimmedQuery || (selectedCompany && trimmedQuery === selectedCompany.name)) {
            return companies;
        }
        const normalizedQuery = normalizeSupplierName(trimmedQuery);
        return companies.filter(c =>
            normalizeSupplierName(c.name).includes(normalizedQuery) ||
            (c.nit ? c.nit.includes(normalizedQuery) : false),
        );
    }, [trimmedQuery, companies, selectedCompany]);

    const visibleResults = filtered.slice(0, MAX_VISIBLE_RESULTS);
    const hiddenCount = filtered.length - visibleResults.length;

    const hasExactMatch = useMemo(() => {
        if (!trimmedQuery) return true;
        const normalizedQuery = normalizeSupplierName(trimmedQuery);
        return companies.some(c => normalizeSupplierName(c.name) === normalizedQuery);
    }, [trimmedQuery, companies]);

    // Sync query with the resolved selected company when value/companies change
    useEffect(() => {
        setQuery(selectedCompany ? selectedCompany.name : '');
    }, [selectedCompany]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery(selectedCompany ? selectedCompany.name : '');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [selectedCompany]);

    const handleSelect = (company: SupplierCompany) => {
        onChange(company.id);
        setQuery(company.name);
        setOpen(false);
    };

    const handleCreateRequest = () => {
        if (!onCreateRequest) return;
        onCreateRequest(trimmedQuery);
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Empresa Proveedora
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <div className="relative mt-1.5">
                <input
                    type="text"
                    value={query}
                    disabled={effectiveDisabled}
                    onChange={(e) => { setQuery(e.target.value); if (!effectiveDisabled) setOpen(true); }}
                    onFocus={() => { if (!effectiveDisabled) setOpen(true); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setOpen(false);
                            setQuery(selectedCompany ? selectedCompany.name : '');
                        }
                    }}
                    placeholder={isLoading ? 'Cargando proveedores...' : 'Buscar proveedor...'}
                    className={cn(
                        "w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 placeholder:text-slate-500 placeholder:font-medium focus:ring-2 focus:ring-slate-700 disabled:opacity-60 disabled:cursor-not-allowed",
                    )}
                    autoComplete="off"
                />
                {!effectiveDisabled && (
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-300 transition-colors"
                    >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full left-0 mt-2 w-full max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-2xl shadow-xl"
                    >
                        {visibleResults.length > 0 ? (
                            <>
                                {visibleResults.map(company => (
                                    <button
                                        key={company.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSelect(company)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-3 text-left px-4 py-2.5 text-sm transition-colors",
                                            company.id === value
                                                ? "text-indigo-300 bg-slate-700/50 font-black"
                                                : "text-slate-300 hover:bg-slate-700",
                                        )}
                                    >
                                        <span className="font-black truncate">{company.name}</span>
                                        {company.nit && (
                                            <span className="text-xs text-slate-500 font-medium shrink-0 ml-2">{company.nit}</span>
                                        )}
                                    </button>
                                ))}
                                {hiddenCount > 0 && (
                                    <p className="px-4 py-2 text-xs text-slate-500 font-medium">
                                        Escribe para afinar la búsqueda ({hiddenCount} más)
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="px-4 py-4 text-center">
                                <p className="text-xs text-slate-400 font-medium">No se encontraron proveedores</p>
                            </div>
                        )}
                        {allowCreate && trimmedQuery && !hasExactMatch && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={handleCreateRequest}
                                className="w-full text-left px-4 py-2.5 text-sm font-black text-indigo-300 hover:bg-slate-700 border-t border-slate-700 transition-colors"
                            >
                                + Agregar «{trimmedQuery}»
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default SupplierPicker;
