import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Package, FileText, Server, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SPEC_FIELDS_BY_ITEM_TYPE } from '../../lib/constants';
import type { TechnicalSpecs } from '../../lib/types';
import AutocompleteInput from '../AutocompleteInput';
import type { AutocompleteSuggestion } from '../AutocompleteInput';

// ──────────────────────────────────────────────────────────
// Alias de fieldName para la API de sugerencias
// ──────────────────────────────────────────────────────────

/**
 * Mapeo por categoría: key en SPEC_FIELDS → fieldName real en BD.
 * Solo se declaran los keys que DIFIEREN del fieldName de la BD.
 * Los 17 fieldNames válidos en BD son:
 *   fabricante, formato, modelo, procesador, sistemaOperativo,
 *   graficos, memoriaRam, almacenamiento, pantalla, network,
 *   seguridad, garantia, tipo, tipoInfraestructura, tipoServicio,
 *   tipoSoftware, unidadMedida, cliente.
 */
const FIELD_NAME_ALIAS: Record<string, Record<string, string>> = {
    PCS: {
        garantiaBateria: 'garantia',
        garantiaEquipo: 'garantia',
    },
    PC_SERVICES: {
        tipo: 'tipoServicio',
        responsable: 'fabricante',
    },
    SOFTWARE: {
        tipo: 'tipoSoftware',
    },
    INFRASTRUCTURE: {
        tipo: 'tipoInfraestructura',
    },
    INFRA_SERVICES: {
        tipo: 'tipoServicio',
        responsable: 'fabricante',
    },
};

function resolveFieldName(itemType: string, key: string): string {
    return FIELD_NAME_ALIAS[itemType]?.[key] ?? key;
}

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
    /** Callback al cambiar un campo de spec (name="spec.fieldName") */
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Callback al seleccionar una sugerencia de autocompletado */
    onSelectSuggestion: (field: string, value: string) => void;
    /** Fetch de sugerencias desde el backend (fieldName resuelto, query) */
    fetchSuggestions: (fieldName: string, query: string) => Promise<AutocompleteSuggestion[]>;
}

// ──────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────

/**
 * Sección de especificaciones técnicas con autocompletado server-side.
 * Renderiza los campos correctos según el `itemType` y busca sugerencias
 * vía GET /spec-options/suggest con debounce de 300ms.
 */
export default function SpecFieldsSection({
    itemType,
    technicalSpecs,
    onChange,
    onSelectSuggestion,
    fetchSuggestions,
}: SpecFieldsSectionProps) {
    const theme = SECTION_THEMES[itemType];
    const specFields = SPEC_FIELDS_BY_ITEM_TYPE[itemType];

    // Memoize one stable fetch-function per field to avoid re-creating on every render
    const fieldFetchFns = useMemo(() => {
        if (!specFields) return {};
        const fns: Record<string, (q: string) => Promise<AutocompleteSuggestion[]>> = {};
        for (const field of Object.keys(specFields)) {
            const resolvedName = resolveFieldName(itemType, field);
            fns[field] = (query: string) => fetchSuggestions(resolvedName, query);
        }
        return fns;
    }, [specFields, itemType, fetchSuggestions]);

    if (!theme || !specFields) return null;

    const Icon = theme.icon;

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

            {/* Campos de especificación con autocompletado */}
            {Object.entries(specFields).map(([field, spec]) => {
                const currentVal = (technicalSpecs as Record<string, string>)?.[field] || '';

                return (
                    <div key={field} className="space-y-1.5 group">
                        <label className={cn(
                            'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors',
                            `group-hover:${theme.titleColor.replace('text-', 'text-')}`
                        )}>
                            {spec.label}
                        </label>
                        <AutocompleteInput
                            name={`spec.${field}`}
                            value={currentVal}
                            onChange={onChange}
                            onSelect={(val) => onSelectSuggestion(field, val)}
                            fetchSuggestions={fieldFetchFns[field]}
                            placeholder={`Escriba ${spec.label}...`}
                            className={cn(
                                'w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white text-[13px] font-bold text-slate-700 transition-all outline-none',
                                theme.focusColor
                            )}
                        />
                    </div>
                );
            })}
        </motion.div>
    );
}
