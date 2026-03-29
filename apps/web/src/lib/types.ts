// ──────────────────────────────────────────────────────────
// Tipos compartidos del dominio NovoTechFlow
// Todas las interfaces que atraviesan múltiples módulos/páginas
// ──────────────────────────────────────────────────────────

/** Roles de usuario en el sistema. */
export type UserRole = 'ADMIN' | 'COMMERCIAL';

/** Posibles estados de una propuesta. */
export type ProposalStatus = 'ELABORACION' | 'PROPUESTA' | 'GANADA' | 'PERDIDA' | 'PENDIENTE_FACTURAR' | 'FACTURADA';

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
    closeDate?: string | null;
    billingDate?: string | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    scenarios?: Array<{
        id: string;
        name: string;
        scenarioItems: Array<{
            id: string;
            itemId: string;
            quantity: number;
            marginPctOverride?: number;
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
    tipo?: string;
    garantia?: string;
    responsable?: string;
    unidadMedida?: string;
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
    marginPct: number | string;
    unitPrice: number | string;
    technicalSpecs?: TechnicalSpecs;
    isTaxable?: boolean;
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
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
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
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
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
    quantity: number;
    marginPctOverride?: number;
    item: ProposalItemFromApi;
}

/** Escenario de cálculos financieros. */
export interface Scenario {
    id: string;
    name: string;
    currency: string;
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
