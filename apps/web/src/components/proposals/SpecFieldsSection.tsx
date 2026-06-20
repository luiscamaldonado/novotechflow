import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { SPEC_FIELDS_BY_ITEM_TYPE, isSpecFieldVisible } from '../../lib/constants';
import type { TechnicalSpecs } from '../../lib/types';
import AutocompleteInput from '../AutocompleteInput';
import type { AutocompleteSuggestion } from '../AutocompleteInput';
import { SECTION_THEMES } from './sectionThemes';

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
// Props
// ──────────────────────────────────────────────────────────

interface SpecFieldsSectionProps {
    /** Tipo de ítem (PCS, ACCESSORIES, etc.) */
    itemType: string;
    /** Especificaciones técnicas actuales del formulario */
    technicalSpecs: TechnicalSpecs;
    /** Callback al cambiar un campo de spec (name="spec.fieldName") */
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    /** Callback al seleccionar una sugerencia de autocompletado */
    onSelectSuggestion: (field: string, value: string) => void;
    /** Fetch de sugerencias desde el backend (fieldName resuelto, query) */
    fetchSuggestions: (fieldName: string, query: string) => Promise<AutocompleteSuggestion[]>;
    /** Si true, todos los campos se renderizan deshabilitados */
    isReadOnly?: boolean;
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
    isReadOnly = false,
}: SpecFieldsSectionProps) {
    const theme = SECTION_THEMES[itemType];
    const specFields = SPEC_FIELDS_BY_ITEM_TYPE[itemType];

    // Memoize one stable fetch-function per field to avoid re-creating on every render
    const fieldFetchFns = useMemo(() => {
        if (!specFields) return {};
        const fns: Record<string, (q: string) => Promise<AutocompleteSuggestion[]>> = {};
        for (const [field, def] of Object.entries(specFields)) {
            if (def.input === 'select' || def.input === 'text') continue;
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

            {/* Campos de especificación */}
            {Object.entries(specFields)
                .filter(([, spec]) => isSpecFieldVisible(spec, technicalSpecs as Record<string, string | undefined>))
                .map(([field, spec]) => {
                const currentVal = (technicalSpecs as Record<string, string>)?.[field] || '';
                const inputClasses = cn(
                    'w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white text-[13px] font-bold text-slate-700 transition-all outline-none',
                    theme.focusColor,
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                );

                return (
                    <div key={field} className="space-y-1.5 group">
                        <label className={cn(
                            'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors',
                            `group-hover:${theme.titleColor.replace('text-', 'text-')}`
                        )}>
                            {spec.label}
                            {spec.required && <span className="text-red-400 ml-0.5">*</span>}
                        </label>

                        {spec.input === 'select' ? (
                            <select
                                name={`spec.${field}`}
                                value={currentVal}
                                onChange={onChange}
                                required={spec.required}
                                disabled={isReadOnly}
                                className={cn(inputClasses, 'appearance-none cursor-pointer')}
                            >
                                <option value="">Seleccione...</option>
                                {spec.options?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : spec.input === 'text' ? (
                            <input
                                type="text"
                                name={`spec.${field}`}
                                value={currentVal}
                                onChange={onChange}
                                required={spec.required}
                                disabled={isReadOnly}
                                placeholder={`Escriba ${spec.label}...`}
                                className={inputClasses}
                            />
                        ) : (
                            <AutocompleteInput
                                name={`spec.${field}`}
                                value={currentVal}
                                onChange={onChange}
                                onSelect={(val) => onSelectSuggestion(field, val)}
                                fetchSuggestions={fieldFetchFns[field]}
                                placeholder={`Escriba ${spec.label}...`}
                                disabled={isReadOnly}
                                className={inputClasses}
                            />
                        )}
                    </div>
                );
            })}
        </motion.div>
    );
}
