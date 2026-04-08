import { Calendar, Tag, Factory, DollarSign, ShoppingCart, X } from 'lucide-react';
import { ITEM_TYPE_LABELS, ACQUISITION_CONFIG } from '../../lib/constants';
import { formatNumberWithThousands, parseFormattedNumber } from '../../lib/format-utils';
import type { ItemType, AcquisitionType } from '../../lib/types';

// ── Types ────────────────────────────────────────────────────

export interface DateRange {
    from: string;
    to: string;
}

export interface DashboardFiltersProps {
    closeDateRange: DateRange;
    onCloseDateRangeChange: (range: DateRange) => void;
    billingDateRange: DateRange;
    onBillingDateRangeChange: (range: DateRange) => void;
    categoryFilter: Set<ItemType>;
    onCategoryFilterChange: (categories: Set<ItemType>) => void;
    manufacturerFilter: string;
    onManufacturerFilterChange: (value: string) => void;
    manufacturerSuggestions: string[];
    subtotalUsdMin: string;
    onSubtotalUsdMinChange: (value: string) => void;
    subtotalUsdMax: string;
    onSubtotalUsdMaxChange: (value: string) => void;
    acquisitionFilter: AcquisitionType | 'ALL';
    onAcquisitionFilterChange: (value: AcquisitionType | 'ALL') => void;
    onClearAll: () => void;
}

// ── Constants ────────────────────────────────────────────────

const ALL_ITEM_TYPES: ItemType[] = ['PCS', 'ACCESSORIES', 'PC_SERVICES', 'SOFTWARE', 'INFRASTRUCTURE', 'INFRA_SERVICES'];

const LABEL_CLASSES = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block';
const INPUT_CLASSES = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300 transition-colors';

// ── Quarter helpers ──────────────────────────────────────────

function getQuarterRange(quarter: number): DateRange {
    const year = new Date().getFullYear();
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth + 1, 0).getDate();

    const pad = (n: number) => String(n + 1).padStart(2, '0');
    return {
        from: `${year}-${pad(startMonth)}-01`,
        to: `${year}-${pad(endMonth)}-${String(lastDay).padStart(2, '0')}`,
    };
}

const QUARTER_BUTTONS = [1, 2, 3, 4] as const;

// ── Sub-components ───────────────────────────────────────────

function DateRangeFilter({ label, icon: Icon, range, onChange }: {
    label: string;
    icon: typeof Calendar;
    range: DateRange;
    onChange: (range: DateRange) => void;
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Icon className="inline h-3 w-3 mr-1 -mt-0.5" />{label}
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={range.from}
                    onChange={(e) => onChange({ ...range, from: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="Desde"
                />
                <span className="text-gray-300 text-xs font-bold">→</span>
                <input
                    type="date"
                    value={range.to}
                    onChange={(e) => onChange({ ...range, to: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="Hasta"
                />
            </div>
            <div className="flex gap-1.5 mt-2">
                {QUARTER_BUTTONS.map(q => (
                    <button
                        key={q}
                        onClick={() => onChange(getQuarterRange(q))}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-gray-50 text-gray-500 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                        Q{q}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CategoryFilter({ selected, onChange }: {
    selected: Set<ItemType>;
    onChange: (categories: Set<ItemType>) => void;
}) {
    const toggleCategory = (type: ItemType) => {
        const next = new Set(selected);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        onChange(next);
    };

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Tag className="inline h-3 w-3 mr-1 -mt-0.5" />Categoría de ítems
            </label>
            <div className="flex flex-wrap gap-1.5">
                {ALL_ITEM_TYPES.map(type => {
                    const isActive = selected.has(type);
                    return (
                        <button
                            key={type}
                            onClick={() => toggleCategory(type)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {ITEM_TYPE_LABELS[type] ?? type}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ManufacturerFilter({ value, onChange, suggestions }: {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Factory className="inline h-3 w-3 mr-1 -mt-0.5" />Fabricante / Responsable
            </label>
            <input
                type="text"
                list="manufacturer-suggestions"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Buscar fabricante o responsable..."
                className={INPUT_CLASSES}
            />
            <datalist id="manufacturer-suggestions">
                {suggestions.map(s => (
                    <option key={s} value={s} />
                ))}
            </datalist>
        </div>
    );
}

function SubtotalUsdFilter({ min, max, onMinChange, onMaxChange }: {
    min: string;
    max: string;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
}) {
    const handleChange = (raw: string, setter: (value: string) => void) => {
        const numeric = parseFormattedNumber(raw);
        setter(numeric ? String(numeric) : '');
    };

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <DollarSign className="inline h-3 w-3 mr-1 -mt-0.5" />Rango USD Est.
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={formatNumberWithThousands(min)}
                    onChange={(e) => handleChange(e.target.value, onMinChange)}
                    onFocus={(e) => e.target.select()}
                    className={INPUT_CLASSES}
                />
                <span className="text-gray-300 text-xs font-bold">→</span>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={formatNumberWithThousands(max)}
                    onChange={(e) => handleChange(e.target.value, onMaxChange)}
                    onFocus={(e) => e.target.select()}
                    className={INPUT_CLASSES}
                />
            </div>
        </div>
    );
}

function AcquisitionFilter({ value, onChange }: {
    value: AcquisitionType | 'ALL';
    onChange: (value: AcquisitionType | 'ALL') => void;
}) {
    const options: { key: AcquisitionType | 'ALL'; label: string }[] = [
        { key: 'ALL', label: 'Todos' },
        { key: 'VENTA', label: ACQUISITION_CONFIG.VENTA.label },
        { key: 'DAAS', label: ACQUISITION_CONFIG.DAAS.label },
    ];

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <ShoppingCart className="inline h-3 w-3 mr-1 -mt-0.5" />Tipo de adquisición
            </label>
            <div className="flex gap-1.5">
                {options.map(opt => {
                    const isActive = value === opt.key;
                    return (
                        <button
                            key={opt.key}
                            onClick={() => onChange(opt.key)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────

export default function DashboardFilters(props: DashboardFiltersProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                    Filtros Avanzados
                </h4>
                <button
                    onClick={props.onClearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                >
                    <X className="h-3 w-3" />
                    Limpiar filtros
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Date Range Filters */}
                <DateRangeFilter
                    label="Fecha de cierre"
                    icon={Calendar}
                    range={props.closeDateRange}
                    onChange={props.onCloseDateRangeChange}
                />
                <DateRangeFilter
                    label="Fecha de facturación"
                    icon={Calendar}
                    range={props.billingDateRange}
                    onChange={props.onBillingDateRangeChange}
                />

                {/* USD Subtotal Range */}
                <SubtotalUsdFilter
                    min={props.subtotalUsdMin}
                    max={props.subtotalUsdMax}
                    onMinChange={props.onSubtotalUsdMinChange}
                    onMaxChange={props.onSubtotalUsdMaxChange}
                />

                {/* Category + Manufacturer + Acquisition */}
                <CategoryFilter
                    selected={props.categoryFilter}
                    onChange={props.onCategoryFilterChange}
                />
                <ManufacturerFilter
                    value={props.manufacturerFilter}
                    onChange={props.onManufacturerFilterChange}
                    suggestions={props.manufacturerSuggestions}
                />
                <AcquisitionFilter
                    value={props.acquisitionFilter}
                    onChange={props.onAcquisitionFilterChange}
                />
            </div>
        </div>
    );
}
