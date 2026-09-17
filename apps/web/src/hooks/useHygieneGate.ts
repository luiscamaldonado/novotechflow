import { useState } from 'react';
import type { ProposalHygieneIssues } from '../lib/dashboardValidation';
import type { ProposalStatus, AcquisitionType } from '../lib/types';
import type { DataHygieneModalProps } from '../pages/dashboard/DataHygieneModal';

/** Mensaje unico ante un PATCH fallido dentro de la compuerta. */
const SAVE_ERROR_MESSAGE = 'No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.';

interface UseHygieneGateParams {
    boardHygieneIssues: ProposalHygieneIssues[];
    /** Rol exento de la compuerta; la politica de roles vive en el caller, no aqui. */
    isExempt: boolean;
    onStatusChange: (id: string, status: ProposalStatus) => Promise<boolean>;
    onDateChange: (id: string, field: 'closeDate' | 'billingDate', value: string) => Promise<boolean>;
    onAcquisitionChange: (id: string, value: AcquisitionType) => Promise<boolean>;
}

interface UseHygieneGateResult {
    /** Ejecuta la accion si el tablero esta limpio o el rol esta exento; si no, abre la compuerta. */
    run: (action: () => void) => void;
    modal: DataHygieneModalProps;
}

/**
 * Compuerta de higiene de datos: decide si una accion puede proceder y, cuando no,
 * conduce al comercial por la cola de propuestas incompletas hasta vaciarla.
 *
 * El avance entre vistas NO se encadena tras el guardado: `entry` y `view` se derivan de
 * `boardHygieneIssues` en cada render, asi que cuando el guardado optimista actualiza las
 * propuestas y la cadena de memos recalcula la lista, la propuesta corregida desaparece y la
 * vista pasa sola a 'resolved'. Leer la lista dentro del mismo tick del guardado devolveria
 * todavia la foto previa, porque setProposals no ha comiteado.
 */
export function useHygieneGate({
    boardHygieneIssues,
    isExempt,
    onStatusChange,
    onDateChange,
    onAcquisitionChange,
}: UseHygieneGateParams): UseHygieneGateResult {
    const [isOpen, setIsOpen] = useState(false);
    const [targetId, setTargetId] = useState<string | null>(null);
    // Codigo de la propuesta en foco: sobrevive a que salga de la cola, para poder nombrarla
    // en la vista 'resolved', cuando ya no existe entrada de donde leerlo.
    const [targetCode, setTargetCode] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const entry = boardHygieneIssues.find(e => e.id === targetId) ?? null;
    const view: DataHygieneModalProps['view'] = entry
        ? 'editing'
        : boardHygieneIssues.length > 0 ? 'resolved' : 'done';
    const nextEntry = boardHygieneIssues[0] ?? null;

    const run = (action: () => void) => {
        if (isExempt || boardHygieneIssues.length === 0) {
            action();
            return;
        }
        const first = boardHygieneIssues[0];
        // El envoltorio es obligatorio: useState trata una funcion desnuda como updater y la
        // ejecutaria en vez de guardarla.
        setPendingAction(() => action);
        setTargetId(first.id);
        setTargetCode(first.proposalCode);
        setError(null);
        setIsOpen(true);
    };

    const goToNext = () => {
        setTargetId(nextEntry?.id ?? null);
        setTargetCode(nextEntry?.proposalCode ?? null);
        setError(null);
    };

    const reset = () => {
        setIsOpen(false);
        setTargetId(null);
        setTargetCode(null);
        setError(null);
        setPendingAction(null);
    };

    const continueAction = () => {
        const action = pendingAction;
        reset();
        action?.();
    };

    /** Descarte explicito: cierra sin ejecutar la accion pendiente. */
    const close = () => {
        reset();
    };

    const persist = async (op: (id: string) => Promise<boolean>) => {
        if (!targetId) return;
        setSaving(true);
        try {
            const ok = await op(targetId);
            setError(ok ? null : SAVE_ERROR_MESSAGE);
        } finally {
            setSaving(false);
        }
    };

    const saveStatus = (status: ProposalStatus) => {
        void persist(id => onStatusChange(id, status));
    };

    const saveCloseDate = (value: string) => {
        void persist(id => onDateChange(id, 'closeDate', value));
    };

    const saveBillingDate = (value: string) => {
        void persist(id => onDateChange(id, 'billingDate', value));
    };

    const saveAcquisition = (value: AcquisitionType) => {
        void persist(id => onAcquisitionChange(id, value));
    };

    return {
        run,
        modal: {
            isOpen,
            view,
            proposalCode: entry?.proposalCode ?? targetCode,
            input: entry?.input ?? null,
            issues: entry?.issues ?? [],
            remainingCount: boardHygieneIssues.length,
            nextProposalCode: nextEntry?.proposalCode ?? null,
            saving,
            error,
            onStatusChange: saveStatus,
            onCloseDateChange: saveCloseDate,
            onBillingDateChange: saveBillingDate,
            onAcquisitionChange: saveAcquisition,
            onNext: goToNext,
            onContinue: continueAction,
            onClose: close,
        },
    };
}
