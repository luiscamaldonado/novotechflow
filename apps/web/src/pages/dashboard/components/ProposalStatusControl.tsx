import { ALL_STATUSES, STATUS_CONFIG } from '../../../lib/constants';
import type { ProposalStatus } from '../../../lib/types';

/**
 * Tokens de tamaño por variante. `compact` reproduce verbatim las clases que el control
 * tiene hoy en la fila del tablero; `comfortable` es la variante holgada para el modal.
 */
const VARIANT_STYLES = {
    compact: { text: 'text-[10px] font-bold uppercase', box: 'px-2 py-1.5' },
    comfortable: { text: 'text-sm font-semibold', box: 'px-3 py-2 w-full' },
} as const;

interface ProposalStatusControlProps {
    value: ProposalStatus;
    onChange: (status: ProposalStatus) => void;
    disabled?: boolean;
    /** Render de solo lectura (badge) en vez del select; el caller decide segun el rol. */
    readOnly?: boolean;
    variant?: keyof typeof VARIANT_STYLES;
}

export default function ProposalStatusControl({
    value,
    onChange,
    disabled,
    readOnly = false,
    variant = 'compact',
}: ProposalStatusControlProps) {
    const sizing = VARIANT_STYLES[variant];
    const cfg = STATUS_CONFIG[value];

    if (readOnly) {
        return (
            <span className={`${sizing.text} ${sizing.box} rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
        );
    }

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as ProposalStatus)}
            disabled={disabled}
            aria-label="Estado de la propuesta"
            className={`${sizing.text} ${sizing.box} rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
        </select>
    );
}
