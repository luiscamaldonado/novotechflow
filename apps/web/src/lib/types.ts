// ──────────────────────────────────────────────────────────
// Tipos compartidos del dominio NovoTechFlow
// Todas las interfaces que atraviesan múltiples módulos/páginas
// ──────────────────────────────────────────────────────────

/** Roles de usuario en el sistema. */
export type UserRole = 'ADMIN' | 'COMMERCIAL' | 'REPORTER';

/** Posibles estados de una propuesta. */
export type ProposalStatus = 'ELABORACION' | 'PROPUESTA' | 'GANADA' | 'PERDIDA' | 'PENDIENTE_FACTURAR' | 'FACTURADA';

/** Tipos de adquisición. */
export type AcquisitionType = 'VENTA' | 'DAAS';

/** Categorías de ítems permitidas. */
export type ItemType = 'PCS' | 'ACCESSORIES' | 'PC_SERVICES' | 'SOFTWARE' | 'INFRASTRUCTURE' | 'INFRA_SERVICES';

// ──────────────────────────────────────────────────────────
// Entidades del dominio
// ──────────────────────────────────────────────────────────

/** Usuario autenticado (payload mínimo del JWT/store). */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    nomenclature: string;
    signatureUrl?: string;
}

/** Resumen de propuesta (listado / Dashboard). */
export interface ProposalSummary {
    id: string;
    proposalCode: string;
    clientName: string;
    subject: string;
    issueDate: string;
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
    isLocked: boolean;
    closeDate?: string | null;
    billingDate?: string | null;
    manualAmount?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    createdAt: string;
    user?: { name: string; nomenclature: string };
    scenarios?: Array<{
        id: string;
        name: string;
        currency: string;
        conversionTrm?: number | null;
        scenarioItems: Array<{
            id: string;
            itemId: string;
            quantity: number;
            marginPctOverride?: number;
            unitPriceOverride?: number | null;
            item: ProposalItemFromApi;
            children?: Array<{
                id: string;
                itemId: string;
                quantity: number;
                item: ProposalItemFromApi;
            }>;
        }>;
    }>;
}

/** Ficha técnica genérica de un ítem (PCs, Software, Infra, etc.). */
export interface TechnicalSpecs {
    formato?: string;
    fabricante?: string;
    modelo?: string;
    procesador?: string;
    sistemaOperativo?: string;
    graficos?: string;
    memoriaRam?: string;
    almacenamiento?: string;
    pantalla?: string;
    network?: string;
    seguridad?: string;
    garantiaBateria?: string;
    garantiaEquipo?: string;
    estado?: string;
    numeroParte?: string;
    tipo?: string;
    garantia?: string;
    responsable?: string;
    unidadMedida?: string;
}

/** Definición de un campo de ficha técnica (data-driven). */
export interface SpecFieldDef {
    label: string;
    cat: string;
    /** Tipo de input. Si se omite: 'autocomplete' (comportamiento actual). */
    input?: 'autocomplete' | 'select' | 'text';
    /** Opciones cerradas para input 'select'. */
    options?: readonly string[];
    /** Si true, el input lleva el atributo nativo required. */
    required?: boolean;
    /**
     * Visibilidad condicional: el campo solo se muestra si specs[field]
     * está vacío (datos legacy) o es exactamente igual a `equals`.
     */
    visibleWhen?: { field: string; equals: string };
}

/** Costos internos asociados a un ítem. */
export interface InternalCosts {
    proveedor?: string;
    fletePct?: number | string;
}

/** Ítem dentro de una propuesta (edición completa). */
export interface ProposalItem {
    id?: string;
    itemType: ItemType;
    name: string;
    description: string;
    brand: string;
    partNumber: string;
    quantity: number | string;
    unitCost: number | string;
    costCurrency?: string;
    marginPct: number | string;
    unitPrice: number | string;
    technicalSpecs?: TechnicalSpecs;
    isTaxable?: boolean;
    deliveryDays?: number | null;
    internalCosts?: InternalCosts;
}

/** Ítem de propuesta tal como llega del backend (campos numéricos como number). */
export interface ProposalItemFromApi {
    id: string;
    name: string;
    itemType: string;
    brand: string;
    partNumber?: string;
    unitCost: number;
    costCurrency?: string;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    deliveryDays?: number | null;
    internalCosts?: InternalCosts;
    technicalSpecs?: TechnicalSpecs;
}

/** Propuesta completa (detalle / edición). */
export interface ProposalDetail {
    id: string;
    proposalCode: string;
    clientName: string;
    subject: string;
    issueDate: string;
    issueCity?: string;
    manualAmount?: string | null;
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
    isLocked: boolean;
    proposalItems: ProposalItemFromApi[];
    user?: { name: string; nomenclature: string };
}

// ──────────────────────────────────────────────────────────
// Escenarios
// ──────────────────────────────────────────────────────────

/** Ítem vinculado a un escenario con posibles overrides. */
export interface ScenarioItem {
    id?: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    unitPriceOverride?: number | null;
    isDiluted?: boolean;
    item: ProposalItemFromApi;
    children?: ScenarioItem[];
}

/** Escenario de cálculos financieros. */
export interface Scenario {
    id: string;
    name: string;
    currency: string;
    conversionTrm?: number | null;
    description?: string;
    scenarioItems: ScenarioItem[];
}

/** Totales calculados para un escenario. */
export interface ScenarioTotals {
    beforeVat: number;
    nonTaxed: number;
    subtotal: number;
    vat: number;
    total: number;
    globalMarginPct: number;
}

// ──────────────────────────────────────────────────────────
// TRM
// ──────────────────────────────────────────────────────────

/** Datos de la TRM oficial (dolarapi). */
export interface TrmData {
    valor: number;
    fechaActualizacion: string;
}

/** Datos extra de TRM (SET-ICAP / Wilkinson). */
export interface ExtraTrmData {
    setIcapAverage: number | null;
    wilkinsonSpot: number | null;
}

// ──────────────────────────────────────────────────────────
// Proyecciones de Facturación
// ──────────────────────────────────────────────────────────

/** Entrada de proyección de facturación (no es una propuesta completa). */
export interface BillingProjection {
    id: string;
    projectionCode: string;
    clientName: string;
    subtotal: number | string;
    currency?: string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    createdAt: string;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
}

// ──────────────────────────────────────────────────────────
// Validación de consecutivo manual
// ──────────────────────────────────────────────────────────

/** Respuesta del endpoint GET /proposals/validate-manual. */
export type ManualConsecutiveValidation =
    | { ok: true }
    | {
          ok: false;
          reason: 'OUT_OF_RANGE' | 'GTE_AUTO' | 'TAKEN';
          conflict?: string;
          suggestion: number | null;
      };

// ──────────────────────────────────────────────────────────
// Cruce de cuentas
// ──────────────────────────────────────────────────────────

/** Registro de historial para cruce de cuentas. */
export interface ConflictRecord {
    id: string;
    proposalCode: string;
    clientName: string;
    issueDate: string;
    subject: string;
    status: string;
    validityDays: number;
    user?: { name: string };
}

