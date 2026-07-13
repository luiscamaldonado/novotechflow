import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, CalendarDays, Clock, ArrowRight, Loader2, AlertCircle, DollarSign, CheckCircle2, Hash } from 'lucide-react';
import { api } from '../../lib/api';
import type { ManualConsecutiveValidation } from '../../lib/types';
import { STATUS_CONFIG, ACQUISITION_CONFIG } from '../../lib/constants';
import { ClientAutocomplete } from '../../components/ClientAutocomplete';
import { useAccountConflicts } from '../../hooks/useAccountConflicts';
import ConflictPanel from '../../components/proposals/ConflictPanel';

// ──────────────────────────────────────────────────────────
// Interfaces / Tipos
// ──────────────────────────────────────────────────────────

/** Estado completo del formulario de nueva propuesta. */
interface ProposalFormData {
    clientId: string | null;
    clientName: string;
    subject: string;
    issueDate: string;
    validityDays: string;
    validityDate: string;
    manualAmount: string;
    consecutiveSource: 'AUTO' | 'MANUAL';
    manualConsecutive: string;
    status: 'ELABORACION' | 'PROPUESTA';
    acquisitionType: 'VENTA' | 'DAAS' | '';
    closeDate: string;
}

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

/** Días de validez por defecto para una nueva propuesta. */
const DEFAULT_VALIDITY_DAYS = 15;

/** Tiempo de debounce para validar el consecutivo manual (ms). */
const MANUAL_VALIDATION_DEBOUNCE_MS = 500;

/** Límite superior del consecutivo manual. */
const MAX_MANUAL_CONSECUTIVE = 99999;

// ──────────────────────────────────────────────────────────
// Helpers puros (sin estado)
// ──────────────────────────────────────────────────────────

/** Obtiene la fecha de hoy en formato ISO (YYYY-MM-DD). */
const getTodayDateString = (): string => new Date().toISOString().split('T')[0];

/** Calcula una fecha futura sumando días a una fecha base. */
const getFutureDate = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

/** Calcula la diferencia en días entre dos fechas. */
const getDaysDifference = (startDate: string, endDate: string): number => {
    const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────

/**
 * Página de creación de nueva propuesta comercial (Paso 1).
 *
 * @description
 * Responsabilidades:
 * - Capturar datos del cliente, asunto y fechas.
 * - Mostrar el panel de "Cruce de Cuentas" con búsqueda dinámica.
 * - Crear un borrador (DRAFT) y redirigir al constructor de ítems.
 */
export default function NewProposal() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const cloneFromId = searchParams.get('cloneFrom');
    const isCloneMode = cloneFromId !== null;
    const [cloneDataLoaded, setCloneDataLoaded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const todayDateStr = getTodayDateString();

    const [formData, setFormData] = useState<ProposalFormData>({
        clientId: null,
        clientName: '',
        subject: '',
        issueDate: todayDateStr,
        validityDays: DEFAULT_VALIDITY_DAYS.toString(),
        validityDate: getFutureDate(todayDateStr, DEFAULT_VALIDITY_DAYS),
        manualAmount: '',
        consecutiveSource: 'AUTO',
        manualConsecutive: '',
        status: 'ELABORACION',
        acquisitionType: '',
        closeDate: '',
    });

    const [manualValidation, setManualValidation] = useState<ManualConsecutiveValidation | null>(null);
    const [isValidatingManual, setIsValidatingManual] = useState(false);

    // ── Cruce de cuentas dinámico (debounced) ────────────
    const { conflicts, isClientEmpty, hasNoConflicts } = useAccountConflicts(formData.clientName);

    // ── Validación debounced del consecutivo manual ──────
    useEffect(() => {
        if (formData.consecutiveSource !== 'MANUAL') {
            setManualValidation(null);
            setIsValidatingManual(false);
            return;
        }

        const raw = formData.manualConsecutive.trim();

        if (raw === '') {
            setManualValidation(null);
            return;
        }

        const parsed = parseInt(raw, 10);
        const isOutOfRange = isNaN(parsed) || parsed < 1 || parsed > MAX_MANUAL_CONSECUTIVE || !Number.isInteger(Number(raw));

        if (isOutOfRange) {
            setManualValidation({ ok: false, reason: 'OUT_OF_RANGE', suggestion: null });
            return;
        }

        setIsValidatingManual(true);

        const timer = setTimeout(async () => {
            try {
                const response = await api.get<ManualConsecutiveValidation>(
                    '/proposals/validate-manual',
                    { params: { n: parsed } },
                );
                setManualValidation(response.data);
            } catch {
                setManualValidation({ ok: false, reason: 'OUT_OF_RANGE', suggestion: null });
            } finally {
                setIsValidatingManual(false);
            }
        }, MANUAL_VALIDATION_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [formData.consecutiveSource, formData.manualConsecutive]);

    // ── Handlers ─────────────────────────────────────────

    /** Actualiza el cliente seleccionado desde el autocompletado. */
    const handleClientSelect = (client: { id: string | null; name: string }): void => {
        setFormData(prev => ({
            ...prev,
            clientId: client.id,
            clientName: client.name,
        }));
    };

    /** Maneja cambios en los campos del formulario con lógica de recálculo de fechas. */
    const handleFieldChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ): void => {
        const { name, value } = e.target;

        // Recalcular fecha final cuando cambian los días de validez
        if (name === 'validityDays') {
            const days = parseInt(value, 10);
            setFormData(prev => ({
                ...prev,
                validityDays: value,
                validityDate: !isNaN(days) ? getFutureDate(prev.issueDate, days) : prev.validityDate,
            }));
            return;
        }

        // Recalcular días cuando cambia la fecha final manualmente
        if (name === 'validityDate') {
            const diffDays = getDaysDifference(formData.issueDate, value);
            setFormData(prev => ({
                ...prev,
                validityDate: value,
                validityDays: diffDays > 0 ? diffDays.toString() : '0',
            }));
            return;
        }

        // Recalcular fecha final cuando cambia la fecha de emisión
        if (name === 'issueDate') {
            setFormData(prev => ({
                ...prev,
                issueDate: value,
                validityDate: getFutureDate(value, parseInt(prev.validityDays, 10) || 0),
            }));
            return;
        }

        // Campos genéricos (subject, etc.)
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    /** Envía el formulario y crea la propuesta borrador. */
    const [submitError, setSubmitError] = useState<string | null>(null);

    // ── Precarga en modo clon ─────────────────────────────
    useEffect(() => {
        if (!cloneFromId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get(`/proposals/${cloneFromId}`);
                if (cancelled) return;
                const p = res.data;
                setFormData((prev) => ({
                    ...prev,
                    clientId: p.clientId ?? '',
                    clientName: p.clientName ?? '',
                    subject: p.subject ?? '',
                    issueDate: p.issueDate ? String(p.issueDate).split('T')[0] : prev.issueDate,
                    validityDays: p.validityDays != null ? String(p.validityDays) : '',
                    validityDate: p.validityDate ? String(p.validityDate).split('T')[0] : '',
                    status: p.status ?? 'ELABORACION',
                    acquisitionType: p.acquisitionType ?? '',
                    closeDate: p.closeDate ? String(p.closeDate).split('T')[0] : '',
                    consecutiveSource: 'AUTO',
                    manualAmount: '',
                }));
                setCloneDataLoaded(true);
            } catch (error) {
                if (cancelled) return;
                console.error('Error cargando propuesta base:', error);
                setSubmitError('No se pudo cargar la propuesta base.');
            }
        })();
        return () => { cancelled = true; };
    }, [cloneFromId]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setSubmitError(null);

        if (formData.consecutiveSource === 'MANUAL' && !manualValidation?.ok) {
            setSubmitError('Validá el consecutivo manual antes de continuar.');
            return;
        }

        setIsSubmitting(true);

        try {
            if (isCloneMode) {
                const response = await api.post(`/proposals/${cloneFromId}/clone`, {
                    cloneType: 'NEW_PROPOSAL',
                    clientId: formData.clientId,
                    clientName: formData.clientName,
                    subject: formData.subject,
                    issueDate: formData.issueDate,
                    validityDays: parseInt(formData.validityDays, 10),
                    validityDate: formData.validityDate,
                    status: formData.status,
                    acquisitionType: formData.acquisitionType,
                    closeDate: formData.closeDate,
                });
                navigate(`/proposals/${response.data.id}/builder`);
            } else {
                const payload: Record<string, unknown> = {
                    clientId: formData.clientId,
                    clientName: formData.clientName,
                    subject: formData.subject,
                    issueDate: formData.issueDate,
                    validityDays: parseInt(formData.validityDays, 10),
                    validityDate: formData.validityDate,
                    manualAmount: formData.manualAmount ? parseFloat(formData.manualAmount) : undefined,
                    status: formData.status,
                    acquisitionType: formData.acquisitionType,
                    closeDate: formData.closeDate,
                };

                if (formData.consecutiveSource === 'MANUAL') {
                    payload.manualConsecutive = parseInt(formData.manualConsecutive, 10);
                }

                const response = await api.post('/proposals', payload);
                navigate(`/proposals/${response.data.id}/builder`);
            }
        } catch (error: unknown) {
            const axiosErr = error as { response?: { data?: { message?: string } } };
            const message = axiosErr?.response?.data?.message || 'No se pudo iniciar la propuesta.';
            console.error('Error creando propuesta:', error);
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Condiciones de renderizado ───────────────────────
    const isManualBlocked =
        formData.consecutiveSource === 'MANUAL' &&
        (formData.manualConsecutive === '' || isValidatingManual || manualValidation === null || !manualValidation.ok);

    const isFormValid = formData.clientName.trim().length > 0 && !isManualBlocked && formData.acquisitionType !== '' && formData.closeDate !== '';

    // ── Render ───────────────────────────────────────────
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-novo-primary">{isCloneMode ? 'Clonar como nueva propuesta' : 'Crear Nueva Propuesta'}</h2>
                <p className="text-gray-500 text-sm mt-1">Paso 1: Información General del Cliente y la Oferta</p>
            </div>

            {/* Progreso Visual */}
            <StepIndicator currentStep={1} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario Principal */}
                <motion.div
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-2"
                >
                    <div className="bg-gray-50/50 p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Datos de la Propuesta</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Columna Izquierda */}
                            <div className="space-y-6">
                                <div className="space-y-2 relative">
                                    <label className="text-sm font-medium text-gray-700 ml-1">
                                        Nombre del Cliente o Empresa
                                    </label>
                                    <ClientAutocomplete
                                        key={isCloneMode ? (cloneDataLoaded ? 'clone-loaded' : 'clone-pending') : 'new'}
                                        defaultValue={formData.clientName}
                                        onSelect={handleClientSelect}
                                        placeholder="Buscar entre 10k+ clientes..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Fecha de Emisión</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <CalendarDays className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input
                                            type="date"
                                            name="issueDate"
                                            value={formData.issueDate}
                                            onChange={handleFieldChange}
                                            required
                                            className="block w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm appearance-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Días Validez</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Clock className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                            </div>
                                            <input
                                                type="number"
                                                name="validityDays"
                                                value={formData.validityDays}
                                                onChange={handleFieldChange}
                                                min="1"
                                                required
                                                className="block w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Fecha Final</label>
                                        <input
                                            type="date"
                                            name="validityDate"
                                            value={formData.validityDate}
                                            onChange={handleFieldChange}
                                            required
                                            className="block w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm appearance-none"
                                        />
                                    </div>
                                </div>

                                {/* Estado Inicial y Modo de Adquisición */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Estado Inicial</label>
                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, status: 'ELABORACION' }))}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                    formData.status === 'ELABORACION'
                                                        ? 'bg-novo-primary text-white'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {STATUS_CONFIG.ELABORACION.label}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, status: 'PROPUESTA' }))}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                    formData.status === 'PROPUESTA'
                                                        ? 'bg-novo-primary text-white'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {STATUS_CONFIG.PROPUESTA.label}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Modo de Adquisición</label>
                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, acquisitionType: prev.acquisitionType === 'VENTA' ? '' : 'VENTA' as const }))}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                    formData.acquisitionType === 'VENTA'
                                                        ? 'bg-novo-primary text-white'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {ACQUISITION_CONFIG.VENTA.label}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, acquisitionType: prev.acquisitionType === 'DAAS' ? '' : 'DAAS' as const }))}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                    formData.acquisitionType === 'DAAS'
                                                        ? 'bg-novo-primary text-white'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {ACQUISITION_CONFIG.DAAS.label}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Fecha de Cierre</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <CalendarDays className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input
                                            type="date"
                                            name="closeDate"
                                            value={formData.closeDate}
                                            onChange={handleFieldChange}
                                            required
                                            className="block w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm appearance-none"
                                        />
                                    </div>
                                </div>

                                {!isCloneMode && (
                                <>
                                {/* Consecutivo de la cotización */}
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Consecutivo de la cotización</label>
                                    <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, consecutiveSource: 'AUTO', manualConsecutive: '' }))}
                                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                formData.consecutiveSource === 'AUTO'
                                                    ? 'bg-novo-primary text-white'
                                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            Automático
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, consecutiveSource: 'MANUAL' }))}
                                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                formData.consecutiveSource === 'MANUAL'
                                                    ? 'bg-novo-primary text-white'
                                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            Manual
                                        </button>
                                    </div>

                                    <p className="text-xs text-gray-400 ml-1">
                                        {formData.consecutiveSource === 'AUTO'
                                            ? 'El sistema asignará el siguiente número disponible para tu nomenclatura.'
                                            : 'Escribe SOLO el número. Las letras de tu nomenclatura las pone NovoTechFlow automáticamente.'}
                                    </p>

                                    {formData.consecutiveSource === 'MANUAL' && (
                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <Hash className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                                </div>
                                                <input
                                                    type="number"
                                                    name="manualConsecutive"
                                                    value={formData.manualConsecutive}
                                                    onChange={handleFieldChange}
                                                    min={1}
                                                    max={MAX_MANUAL_CONSECUTIVE}
                                                    step={1}
                                                    placeholder="Ej. 150"
                                                    className="block w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm"
                                                />
                                                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                                                    {isValidatingManual && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                                                    {!isValidatingManual && manualValidation?.ok === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                    {!isValidatingManual && manualValidation !== null && !manualValidation.ok && <AlertCircle className="h-4 w-4 text-red-500" />}
                                                </div>
                                            </div>

                                            {/* Feedback de validación */}
                                            {!isValidatingManual && manualValidation?.ok === true && (
                                                <p className="text-xs text-green-600 ml-1 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Disponible.
                                                </p>
                                            )}
                                            {!isValidatingManual && manualValidation !== null && !manualValidation.ok && (
                                                <div className="text-xs text-red-600 ml-1 flex items-center gap-1 flex-wrap">
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                    {manualValidation.reason === 'OUT_OF_RANGE' && (
                                                        <span>Debe ser un entero entre 1 y {MAX_MANUAL_CONSECUTIVE.toLocaleString()}.</span>
                                                    )}
                                                    {manualValidation.reason === 'GTE_AUTO' && (
                                                        <span>Debe ser menor al próximo número automático del usuario.</span>
                                                    )}
                                                    {manualValidation.reason === 'TAKEN' && (
                                                        <>
                                                            <span>Ya está en uso ({manualValidation.conflict}).</span>
                                                            {manualValidation.suggestion !== null && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, manualConsecutive: String(manualValidation.suggestion) }))}
                                                                    className="ml-1 text-novo-primary hover:underline font-medium"
                                                                >
                                                                    Usar {manualValidation.suggestion}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                </>
                                )}

                                {!isCloneMode && (
                                <>
                                {/* Monto estimado inicial */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Monto estimado inicial</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <DollarSign className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input
                                            type="number"
                                            name="manualAmount"
                                            value={formData.manualAmount}
                                            onChange={handleFieldChange}
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            className="block w-full pl-11 pr-14 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm"
                                        />
                                        <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400 text-sm">
                                            USD
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 ml-1">
                                        Visible en el dashboard hasta agregar ítems con valor a los escenarios.
                                    </p>
                                </div>
                                </>
                                )}
                            </div>

                            {/* Columna Derecha */}
                            <div className="space-y-2 h-full flex flex-col">
                                <label className="text-sm font-medium text-gray-700 ml-1">Asunto o Descripción Corta</label>
                                <div className="relative group flex-1">
                                    <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                                        <FileText className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors mt-0.5" />
                                    </div>
                                    <textarea
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleFieldChange}
                                        placeholder="Ej. Renovación de licenciamiento Microsoft 365 E3 para 50 usuarios corporativos."
                                        required
                                        className="block w-full h-full min-h-[160px] pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 mt-8 border-t border-gray-100 space-y-3">
                            {submitError && (
                                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{submitError}</span>
                                </div>
                            )}
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !isFormValid}
                                    className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent disabled:opacity-70 text-white px-8 py-3.5 rounded-xl transition-all font-medium shadow-lg shadow-novo-primary/30 group"
                                >
                                    {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                                    <span>{isSubmitting ? 'Guardando...' : 'Guardar y Continuar'}</span>
                                    {!isSubmitting && <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>

                {/* Panel de Cruce de Cuentas */}
                <ConflictPanel
                    isClientEmpty={isClientEmpty}
                    hasNoConflicts={hasNoConflicts}
                    conflicts={conflicts}
                />
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// Sub-componentes extraídos (SRP)
// ──────────────────────────────────────────────────────────

/**
 * Indicador visual del progreso del asistente de creación de propuestas.
 * @param {{ currentStep: number }} props - Paso actual (1, 2 o 3).
 */
function StepIndicator({ currentStep }: { currentStep: number }) {
    const steps = [
        { number: 1, label: 'Información General' },
        { number: 2, label: 'Constructor de Artículos' },
        { number: 3, label: 'Generación PDF' },
    ];

    return (
        <div className="flex items-center space-x-4 mb-8">
            {steps.map((step, index) => (
                <div key={step.number} className="contents">
                    <div className={`flex items-center ${step.number <= currentStep ? 'text-novo-primary font-semibold' : 'text-gray-400 font-medium opacity-60'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                            step.number <= currentStep
                                ? 'bg-novo-primary text-white shadow-md shadow-novo-primary/30'
                                : 'border-2 border-gray-300'
                        }`}>
                            {step.number}
                        </div>
                        <span className="hidden sm:inline">{step.label}</span>
                    </div>
                    {index < steps.length - 1 && <div className="h-px bg-gray-300 flex-1" />}
                </div>
            ))}
        </div>
    );
}
