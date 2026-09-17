import { ACQUISITION_CONFIG } from '../../../lib/constants';
import type { AcquisitionType } from '../../../lib/types';

/**
 * Tokens de tamaño por variante. `compact` reproduce verbatim las clases que el control
 * tiene hoy en la fila del tablero; `comfortable` es la variante holgada para el modal.
 */
const VARIANT_STYLES = {
    compact: { text: 'text-[10px] font-bold uppercase', box: 'px-2 py-1.5' },
    comfortable: { text: 'text-sm font-semibold', box: 'px-3 py-2 w-full' },
} as const;

interface ProposalAcquisitionControlProps {
    value: AcquisitionType | null;
    onChange: (value: AcquisitionType) => void;
    disabled?: boolean;
    /** Render de solo lectura (badge o guion) en vez del select; el caller decide segun el rol. */
    readOnly?: boolean;
    variant?: keyof typeof VARIANT_STYLES;
}

export default function ProposalAcquisitionControl({
    value,
    onChange,
    disabled,
    readOnly = false,
    variant = 'compact',
}: ProposalAcquisitionControlProps) {
    const sizing = VARIANT_STYLES[variant];
    const cfg = value ? ACQUISITION_CONFIG[value] : undefined;

    if (readOnly) {
        return cfg ? (
            <span className={`${sizing.text} ${sizing.box} rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
        ) : (
            <span className="text-[10px] text-gray-300">—</span>
        );
    }

    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value as AcquisitionType)}
            disabled={disabled}
            aria-label="Tipo de adquisición"
            className={`${sizing.text} ${sizing.box} rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed ${
                cfg
                    ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                    : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
        >
            <option value="">— Seleccionar —</option>
            <option value="VENTA">Venta</option>
            <option value="DAAS">DaaS</option>
        </select>
    );
}
