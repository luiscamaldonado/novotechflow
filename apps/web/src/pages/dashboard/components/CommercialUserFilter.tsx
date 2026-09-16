import { User } from 'lucide-react';
import type { CommercialOption } from '../../../hooks/useDashboard';

interface CommercialUserFilterProps {
    options: CommercialOption[];
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
}

export default function CommercialUserFilter({ options, selected, onChange }: CommercialUserFilterProps) {
    if (options.length === 0) return null;

    const toggle = (nomenclature: string) => {
        const next = new Set(selected);
        if (next.has(nomenclature)) next.delete(nomenclature);
        else next.add(nomenclature);
        onChange(next);
    };

    return (
        <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                <User className="inline h-3 w-3 mr-1 -mt-0.5" />Usuario Comercial
            </label>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const active = selected.has(opt.nomenclature);
                    return (
                        <button
                            key={opt.nomenclature}
                            type="button"
                            onClick={() => toggle(opt.nomenclature)}
                            aria-pressed={active}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all focus-visible:ring-2 focus-visible:ring-indigo-600/20 ${
                                active
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {opt.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
