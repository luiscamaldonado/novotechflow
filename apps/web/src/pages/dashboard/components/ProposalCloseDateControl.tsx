/**
 * Tokens de tamaño por variante. `compact` reproduce verbatim las clases que el control
 * tiene hoy en la fila del tablero; `comfortable` es la variante holgada para el modal.
 */
const VARIANT_STYLES = {
    compact: { text: 'text-[11px] font-semibold', box: 'px-2 py-1.5 w-full' },
    comfortable: { text: 'text-sm font-semibold', box: 'px-3 py-2 w-full' },
} as const;

interface ProposalCloseDateControlProps {
    value: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    variant?: keyof typeof VARIANT_STYLES;
}

export default function ProposalCloseDateControl({
    value,
    onChange,
    disabled,
    variant = 'compact',
}: ProposalCloseDateControlProps) {
    const sizing = VARIANT_STYLES[variant];

    return (
        <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-label="Fecha de cierre"
            className={`${sizing.text} text-gray-600 bg-gray-50 border border-gray-200 rounded-lg ${sizing.box} disabled:opacity-50 disabled:cursor-not-allowed`}
        />
    );
}
