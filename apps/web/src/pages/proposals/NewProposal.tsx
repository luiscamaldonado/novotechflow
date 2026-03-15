import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, FileText, CalendarDays, Clock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { ClientAutocomplete } from '../../components/ClientAutocomplete';

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
}

/** Registro de historial para cruce de cuentas. */
interface ConflictRecord {
    id: string;
    proposalCode: string;
    issueDate: string;
    subject: string;
    status: string;
    validityDays: number;
    user?: { name: string };
}

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

/** Días de validez por defecto para una nueva propuesta. */
const DEFAULT_VALIDITY_DAYS = 15;

/** Tiempo de debounce para la búsqueda de cruce de cuentas (ms). */
const CONFLICT_SEARCH_DEBOUNCE_MS = 500;

/** Longitud mínima del nombre del cliente para activar la búsqueda de conflictos. */
const MIN_CONFLICT_SEARCH_LENGTH = 3;

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflictHistory, setConflictHistory] = useState<ConflictRecord[]>([]);

    const todayDateStr = getTodayDateString();

    const [formData, setFormData] = useState<ProposalFormData>({
        clientId: null,
        clientName: '',
        subject: '',
        issueDate: todayDateStr,
        validityDays: DEFAULT_VALIDITY_DAYS.toString(),
        validityDate: getFutureDate(todayDateStr, DEFAULT_VALIDITY_DAYS),
    });

    // ── Cruce de cuentas dinámico (debounced) ────────────
    useEffect(() => {
        const trimmedName = formData.clientName.trim();

        if (trimmedName.length < MIN_CONFLICT_SEARCH_LENGTH) {
            setConflictHistory([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const response = await api.get(
                    `/proposals/client-history?clientName=${encodeURIComponent(trimmedName)}`
                );
                setConflictHistory(response.data);
            } catch (error) {
                console.error('Error buscando cruce de cuentas:', error);
            }
        }, CONFLICT_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [formData.clientName]);

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
    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await api.post('/proposals', {
                clientId: formData.clientId,
                clientName: formData.clientName,
                subject: formData.subject,
                issueDate: formData.issueDate,
                validityDays: parseInt(formData.validityDays, 10),
                validityDate: formData.validityDate,
            });

            navigate(`/proposals/${response.data.id}/builder`);
        } catch (error) {
            console.error('Error creando propuesta:', error);
            alert('No se pudo iniciar la propuesta. Verifica la consola.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Condiciones de renderizado ───────────────────────
    const isFormValid = formData.clientName.trim().length > 0;
    const hasNoConflicts = conflictHistory.length === 0;
    const isClientEmpty = formData.clientName.trim() === '';

    // ── Render ───────────────────────────────────────────
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-novo-primary">Crear Nueva Propuesta</h2>
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

                        <div className="pt-8 mt-8 border-t border-gray-100 flex justify-end">
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
                    </form>
                </motion.div>

                {/* Panel de Cruce de Cuentas */}
                <ConflictPanel
                    isClientEmpty={isClientEmpty}
                    hasNoConflicts={hasNoConflicts}
                    conflicts={conflictHistory}
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

/**
 * Panel lateral que muestra propuestas previas para detectar cruces de cuenta.
 *
 * @param {boolean} isClientEmpty - Si el campo de cliente está vacío.
 * @param {boolean} hasNoConflicts - Si no se encontraron propuestas relacionadas.
 * @param {ConflictRecord[]} conflicts - Lista de propuestas candidatas a cruce.
 */
function ConflictPanel({
    isClientEmpty,
    hasNoConflicts,
    conflicts,
}: {
    isClientEmpty: boolean;
    hasNoConflicts: boolean;
    conflicts: ConflictRecord[];
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-1 h-fit"
        >
            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                    <AlertCircle className="h-5 w-5" />
                    <h3 className="text-sm font-bold tracking-wide uppercase">Cruce de Cuentas</h3>
                </div>
                <p className="text-gray-500 text-xs">
                    Oportunidades creadas para este cliente en el último año.
                </p>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {isClientEmpty ? (
                    <div className="text-center py-10 px-4 text-gray-400 text-sm">
                        Escribe el nombre del cliente para buscar proyectos previos y evitar cruces con otros comerciales.
                    </div>
                ) : hasNoConflicts ? (
                    <div className="text-center py-10 px-4">
                        <span className="inline-flex items-center justify-center p-3 bg-green-50 rounded-full mb-3 text-green-600">
                            <Building2 className="h-6 w-6" />
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900">Cliente Libre</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            Nadie del equipo ha cotizado a este cliente en el último año.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {conflicts.map((item) => (
                            <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-gray-900">{item.proposalCode}</span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                        {new Date(item.issueDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-gray-600 text-xs mb-2 line-clamp-2">{item.subject}</p>
                                <div className="flex flex-col space-y-1 mt-2 pt-2 border-t border-gray-200">
                                    <div className="text-xs flex items-center text-gray-500">
                                        <span className="font-medium mr-1">Comercial:</span>
                                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                            {item.user?.name || 'Desconocido'}
                                        </span>
                                    </div>
                                    <div className="text-xs flex items-center text-gray-500">
                                        <span className="font-medium mr-1">Estado:</span>
                                        {item.status} ({item.validityDays} días)
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
