import { useState, useRef, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { COLOMBIAN_CAPITAL_CITIES } from '../../../lib/colombianCities';

function CityCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        if (!query.trim()) return COLOMBIAN_CAPITAL_CITIES;
        const lower = query.toLowerCase();
        return COLOMBIAN_CAPITAL_CITIES.filter(c => c.toLowerCase().includes(lower));
    }, [query]);

    // Sync external value changes
    useEffect(() => { setQuery(value); }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
                // Reset query to current value if nothing selected
                setQuery(value);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [value]);

    const handleSelect = (city: string) => {
        onChange(city);
        setQuery(city);
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                Ciudad de emisión
            </label>
            <div className="flex items-center mt-0.5">
                <input
                    id="city-selector"
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') { setOpen(false); setQuery(value); }
                        if (e.key === 'Enter' && filtered.length > 0) {
                            e.preventDefault();
                            handleSelect(filtered[0]);
                        }
                    }}
                    placeholder="Buscar ciudad..."
                    className="bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 p-0 w-44 placeholder:text-slate-300 placeholder:font-normal"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                </button>
            </div>

            <AnimatePresence>
                {open && filtered.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full left-0 mt-2 w-64 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50"
                    >
                        {filtered.map(city => (
                            <button
                                key={city}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(city)}
                                className={cn(
                                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                                    city === value
                                        ? "bg-indigo-50 text-indigo-700 font-bold"
                                        : "text-slate-700 hover:bg-slate-50 font-medium"
                                )}
                            >
                                {city}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {open && filtered.length === 0 && (
                <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-center">
                    <p className="text-xs text-slate-400 font-medium">No se encontraron ciudades</p>
                </div>
            )}
        </div>
    );
}

export default CityCombobox;
