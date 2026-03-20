import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Monitor, Package, FileText, Server, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SPEC_FIELDS_BY_ITEM_TYPE } from '../../lib/constants';
import type { TechnicalSpecs } from '../../lib/types';

// ──────────────────────────────────────────────────────────
// Configuración visual por tipo de ítem
// ──────────────────────────────────────────────────────────

interface SectionTheme {
    icon: LucideIcon;
    iconBg: string;
    titleColor: string;
    title: string;
    subtitle: string;
    borderColor: string;
    focusColor: string;
    hoverBg: string;
    hoverText: string;
    /** Cantidad de columnas en el grid (PCS usa 4, el resto 3) */
    cols: number;
}

export const SECTION_THEMES: Record<string, SectionTheme> = {
    PCS: {
        icon: Monitor,
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-600',
        title: 'Ficha Técnica Automatizada',
        subtitle: 'Configure los parámetros del equipo basados en el catálogo maestro.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-indigo-600',
        hoverBg: 'hover:bg-indigo-50',
        hoverText: 'hover:text-indigo-600',
        cols: 4,
    },
    ACCESSORIES: {
        icon: Package,
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-600',
        title: 'Especificaciones de Accesorio',
        subtitle: 'Defina el tipo, marca y respaldo del accesorio u opción.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-indigo-600',
        hoverBg: 'hover:bg-indigo-50',
        hoverText: 'hover:text-indigo-600',
        cols: 3,
    },
    PC_SERVICES: {
        icon: FileText,
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-600',
        title: 'Configuración de Servicio',
        subtitle: 'Defina el alcance, responsable y métricas del servicio.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-indigo-600',
        hoverBg: 'hover:bg-indigo-50',
        hoverText: 'hover:text-indigo-600',
        cols: 3,
    },
    SOFTWARE: {
        icon: Package,
        iconBg: 'bg-purple-600',
        titleColor: 'text-purple-600',
        title: 'Configuración de Software',
        subtitle: 'Defina el tipo de licencia, fabricante y periodicidad.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-purple-600',
        hoverBg: 'hover:bg-purple-50',
        hoverText: 'hover:text-purple-600',
        cols: 3,
    },
    INFRASTRUCTURE: {
        icon: Server,
        iconBg: 'bg-slate-800',
        titleColor: 'text-slate-800',
        title: 'Configuración de Infraestructura',
        subtitle: 'Defina el tipo de equipo, fabricante y periodo de soporte.',
        borderColor: 'border-slate-200',
        focusColor: 'focus:border-slate-800',
        hoverBg: 'hover:bg-slate-50',
        hoverText: 'hover:text-slate-900',
        cols: 3,
    },
    INFRA_SERVICES: {
        icon: Settings,
        iconBg: 'bg-slate-900',
        titleColor: 'text-slate-900',
        title: 'Configuración de Servicios Infra.',
        subtitle: 'Defina el tipo de servicio especializado y responsable.',
        borderColor: 'border-slate-700',
        focusColor: 'focus:border-slate-900',
        hoverBg: 'hover:bg-slate-900 hover:text-white',
        hoverText: 'hover:text-white',
        cols: 3,
    },
};

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────

interface SpecFieldsSectionProps {
    /** Tipo de ítem (PCS, ACCESSORIES, etc.) */
    itemType: string;
    /** Especificaciones técnicas actuales del formulario */
    technicalSpecs: TechnicalSpecs;
    /** Catálogos de autocompletado (`{ FORMATO: ['...'], ... }`) */
    catalogs: Record<string, string[]>;
    /** Callback al cambiar un campo de spec (name="spec.fieldName") */
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Callback al seleccionar una sugerencia de autocompletado */
    onSelectSuggestion: (field: string, value: string) => void;
}

// ──────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────

/**
 * Sección de especificaciones técnicas con autocompletado.
 * Renderiza los campos correctos según el `itemType` usando datos de catálogo.
 *
 * Reemplaza 6 bloques duplicados (~350 líneas) del antiguo `ProposalItemsBuilder`.
 */
export default function SpecFieldsSection({
    itemType,
    technicalSpecs,
    catalogs,
    onChange,
    onSelectSuggestion,
}: SpecFieldsSectionProps) {
    const theme = SECTION_THEMES[itemType];
    const specFields = SPEC_FIELDS_BY_ITEM_TYPE[itemType];

    const [activeField, setActiveField] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(-1);

    if (!theme || !specFields) return null;

    const Icon = theme.icon;

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        field: string,
        suggestions: string[]
    ) => {
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < suggestions.length) {
            e.preventDefault();
            onSelectSuggestion(field, suggestions[activeIndex]);
            setActiveField(null);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'md:col-span-12 grid grid-cols-1 gap-6 p-8 bg-white rounded-[2.5rem] border-2 shadow-inner',
                theme.borderColor,
                theme.cols === 4
                    ? 'md:grid-cols-3 lg:grid-cols-4'
                    : 'md:grid-cols-3'
            )}
        >
            {/* Header */}
            <div className={cn('flex items-center space-x-3 mb-2', theme.cols === 4 ? 'md:col-span-4 lg:col-span-4' : 'md:col-span-3')}>
                <div className={cn('p-2 rounded-xl shadow-md', theme.iconBg)}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h4 className={cn('text-[11px] font-black uppercase tracking-widest', theme.titleColor)}>
                        {theme.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {theme.subtitle}
                    </p>
                </div>
            </div>

            {/* Campos de especificación */}
            {Object.entries(specFields).map(([field, spec]) => {
                const currentVal = (technicalSpecs as Record<string, string>)?.[field] || '';
                const suggestions = currentVal.trim().length > 0
                    ? catalogs[spec.cat]?.filter(v =>
                        v.toLowerCase().includes(currentVal.toLowerCase())
                    ).slice(0, 20) || []
                    : [];

                return (
                    <div key={field} className="space-y-1.5 relative group">
                        <label className={cn(
                            'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors',
                            `group-hover:${theme.titleColor.replace('text-', 'text-')}`
                        )}>
                            {spec.label}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                name={`spec.${field}`}
                                value={currentVal}
                                onChange={onChange}
                                onFocus={() => { setActiveField(field); setActiveIndex(-1); }}
                                onKeyDown={(e) => handleKeyDown(e, field, suggestions)}
                                onBlur={() => setTimeout(() => setActiveField(null), 200)}
                                placeholder={`Escriba ${spec.label}...`}
                                autoComplete="off"
                                className={cn(
                                    'w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white text-[13px] font-bold text-slate-700 transition-all outline-none',
                                    theme.focusColor
                                )}
                            />
                            {suggestions.length > 0 && activeField === field && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => onSelectSuggestion(field, s)}
                                            className={cn(
                                                'w-full px-4 py-2.5 text-left text-[11px] font-bold text-slate-600 transition-colors flex items-center justify-between group',
                                                theme.hoverBg,
                                                theme.hoverText,
                                                activeIndex === i && `${theme.hoverBg.replace('hover:', '')} ${theme.hoverText.replace('hover:', '')}`
                                            )}
                                        >
                                            <span>{s}</span>
                                            <Plus className={cn(
                                                'h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity',
                                                activeIndex === i && 'opacity-100'
                                            )} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </motion.div>
    );
}
