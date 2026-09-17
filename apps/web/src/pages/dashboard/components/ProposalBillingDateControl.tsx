/**
 * Tokens de tamaño por variante. `compact` reproduce verbatim las clases que el control
 * tiene hoy en la fila del tablero; `comfortable` es la variante holgada para el modal.
 */
const VARIANT_STYLES = {
    compact: { text: 'text-[10px] font-semibold', box: 'px-2 py-1 w-[130px]', label: 'text-[9px]' },
    comfortable: { text: 'text-sm font-semibold', box: 'px-3 py-2 w-full', label: 'text-xs' },
} as const;

interface ProposalBillingDateControlProps {
    value: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    /** Con false omite el rotulo propio; el caller pone el suyo. */
    showLabel?: boolean;
    variant?: keyof typeof VARIANT_STYLES;
}

/**
 * Fecha de facturación con su rotulo. El componente no decide si debe mostrarse:
 * esa condicion (PROJECTION_STATUSES) la evalua el caller.
 */
export default function ProposalBillingDateControl({
    value,
    onChange,
    disabled,
    showLabel = true,
    variant = 'compact',
}: ProposalBillingDateControlProps) {
    const sizing = VARIANT_STYLES[variant];

    return (
        <>
            {showLabel && (
                <span className={`${sizing.label} font-bold text-orange-500 uppercase tracking-wider block mb-0.5`}>Fecha de facturación</span>
            )}
            <input
                type="date"
                value={value ? new Date(value).toISOString().split('T')[0] : ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                aria-label="Fecha de facturación"
                className={`${sizing.text} text-orange-600 bg-orange-50 border border-orange-200 rounded-lg ${sizing.box} disabled:opacity-50 disabled:cursor-not-allowed`}
            />
        </>
    );
}
