# TRM + Currency Handling in Dashboard

## Summary of Changes

Added multi-currency support to the Dashboard table with TRM conversion, so all billing projection cards reflect USD values and each proposal shows its native currency alongside an estimated USD equivalent.

---

## Files Modified

### 1. `lib/types.ts` — Added `currency` to scenario type
```diff:types.ts
// ──────────────────────────────────────────────────────────
// Tipos compartidos del dominio NovoTechFlow
// Todas las interfaces que atraviesan múltiples módulos/páginas
// ──────────────────────────────────────────────────────────

/** Roles de usuario en el sistema. */
export type UserRole = 'ADMIN' | 'COMMERCIAL';

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
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
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
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: ProposalItemFromApi;
    children?: ScenarioItem[];
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

// ──────────────────────────────────────────────────────────
// Proyecciones de Facturación
// ──────────────────────────────────────────────────────────

/** Entrada de proyección de facturación (no es una propuesta completa). */
export interface BillingProjection {
    id: string;
    projectionCode: string;
    clientName: string;
    subtotal: number | string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    createdAt: string;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
}

===
// ──────────────────────────────────────────────────────────
// Tipos compartidos del dominio NovoTechFlow
// Todas las interfaces que atraviesan múltiples módulos/páginas
// ──────────────────────────────────────────────────────────

/** Roles de usuario en el sistema. */
export type UserRole = 'ADMIN' | 'COMMERCIAL';

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
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    scenarios?: Array<{
        id: string;
        name: string;
        currency: string;
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
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: ProposalItemFromApi;
    children?: ScenarioItem[];
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

// ──────────────────────────────────────────────────────────
// Proyecciones de Facturación
// ──────────────────────────────────────────────────────────

/** Entrada de proyección de facturación (no es una propuesta completa). */
export interface BillingProjection {
    id: string;
    projectionCode: string;
    clientName: string;
    subtotal: number | string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    createdAt: string;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
}

```

> [!NOTE]
> The backend already returns `currency` on each scenario from the `findAll` query. The frontend type just wasn't capturing it.

---

### 2. `lib/constants.ts` — Added `formatUSD` + `TRM_API_URL`
```diff:constants.ts
// ──────────────────────────────────────────────────────────
// Constantes de negocio — NovoTechFlow
// Centralizan magic numbers y strings en un solo lugar.
// ──────────────────────────────────────────────────────────

import {
    FileText, FileSignature, Building2, ListOrdered,
    Cpu, DollarSign,
    Image as ImageIcon,
} from 'lucide-react';
import type { ProposalStatus } from './types';

/** Tasa de IVA colombiano (19%). */
export const IVA_RATE = 0.19;

/** Porcentaje de flete para proveedores mayoristas. */
export const MAYORISTA_FLETE_PCT = 1.5;

/** Nombre del proveedor mayorista. */
export const PROVEEDOR_MAYORISTA = 'MAYORISTA';

/** Debounce para búsquedas de autocompletado (ms). */
export const AUTOCOMPLETE_DEBOUNCE_MS = 200;

/** Debounce para cierre de sugerencias en onBlur (ms). */
export const SUGGESTION_BLUR_DELAY_MS = 200;

/** Máximo de sugerencias a mostrar en autocompletados. */
export const MAX_SUGGESTIONS = 20;

/** Labels legibles para cada tipo de ítem. */
export const ITEM_TYPE_LABELS: Record<string, string> = {
    PCS: 'PCs',
    ACCESSORIES: 'Accesorios y Opciones',
    PC_SERVICES: 'Servicios PCs',
    SOFTWARE: 'Software',
    INFRASTRUCTURE: 'Infraestructura',
    INFRA_SERVICES: 'Servicios de Infraestructura',
} as const;

/** Mapas de especificaciones técnicas por categoría de ítem. */
export const SPEC_FIELDS_BY_ITEM_TYPE: Record<string, Record<string, { label: string; cat: string }>> = {
    PCS: {
        formato: { label: 'Formato', cat: 'FORMATO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        modelo: { label: 'Modelo', cat: 'MODELO' },
        procesador: { label: 'Procesador', cat: 'PROCESADOR' },
        sistemaOperativo: { label: 'Sistema Operativo', cat: 'SISTEMA_OPERATIVO' },
        graficos: { label: 'Gráficos', cat: 'GRAFICOS' },
        memoriaRam: { label: 'Memoria RAM', cat: 'MEMORIA_RAM' },
        almacenamiento: { label: 'Almacenamiento', cat: 'ALMACENAMIENTO' },
        pantalla: { label: 'Pantalla', cat: 'PANTALLA' },
        network: { label: 'Network', cat: 'NETWORK' },
        seguridad: { label: 'Seguridad', cat: 'SEGURIDAD' },
        garantiaBateria: { label: 'Garantía Batería', cat: 'GARANTIA_BATERIA' },
        garantiaEquipo: { label: 'Garantía Equipo', cat: 'GARANTIA_EQUIPO' },
    },
    ACCESSORIES: {
        tipo: { label: 'Tipo', cat: 'ACC_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        garantia: { label: 'Garantía', cat: 'ACC_GARANTIA' },
    },
    PC_SERVICES: {
        tipo: { label: 'Tipo de Servicio', cat: 'SVC_TIPO' },
        responsable: { label: 'Responsable', cat: 'SVC_RESPONSABLE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'SVC_UM' },
    },
    SOFTWARE: {
        tipo: { label: 'Tipo de Software', cat: 'SW_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'SW_UM' },
    },
    INFRASTRUCTURE: {
        tipo: { label: 'Tipo de Infraestructura', cat: 'INFRA_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        garantia: { label: 'Garantía', cat: 'INFRA_GARANTIA' },
    },
    INFRA_SERVICES: {
        tipo: { label: 'Tipo de Servicio', cat: 'INFRA_SVC_TIPO' },
        responsable: { label: 'Responsable', cat: 'INFRA_SVC_RESPONSABLE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'INFRA_SVC_UM' },
    },
} as const;

// ── Proposal Document Builder constants ──────────────────────

/** Page type display labels */
export const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    PRESENTATION: 'Carta de Presentación',
    COMPANY_INFO: 'Info. General',
    INDEX: 'Índice',
    TECH_SPEC: 'Propuesta Técnica',
    ECONOMIC: 'Propuesta Económica',
    TERMS: 'Términos y Condiciones',
    CUSTOM: 'Página Personalizada',
};

/** Page type icons & colors */
export const PAGE_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof FileText }> = {
    COVER: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: ImageIcon },
    PRESENTATION: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', icon: FileSignature },
    COMPANY_INFO: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: Building2 },
    INDEX: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: ListOrdered },
    TECH_SPEC: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', icon: Cpu },
    ECONOMIC: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', icon: DollarSign },
    TERMS: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', icon: FileText },
    CUSTOM: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', icon: FileText },
};

/** Virtual section IDs for the generated sections */
export const VIRTUAL_TECH_SPEC_ID = '__virtual_tech_spec__';
export const VIRTUAL_ECONOMIC_ID = '__virtual_economic__';

// ── Dashboard constants ──────────────────────────────────────


/** Status badge configuration for Dashboard rows. */
export const STATUS_CONFIG: Record<ProposalStatus, { label: string; bg: string; text: string; border: string }> = {
    ELABORACION:        { label: 'Elaboración',    bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    PROPUESTA:          { label: 'Propuesta',      bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
    GANADA:             { label: 'Ganada',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    PERDIDA:            { label: 'Perdida',         bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
    PENDIENTE_FACTURAR: { label: 'Pend. Facturar', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
    FACTURADA:          { label: 'Facturada',       bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
};

/** All proposal statuses in display order. */
export const ALL_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA', 'GANADA', 'PERDIDA', 'PENDIENTE_FACTURAR', 'FACTURADA'];

/** Statuses valid for billing projections. */
export const PROJECTION_STATUSES: ProposalStatus[] = ['PENDIENTE_FACTURAR', 'FACTURADA'];

/** Acquisition type badge configuration. */
export const ACQUISITION_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    VENTA: { label: 'Venta', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    DAAS:  { label: 'DaaS',  bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
};

/** Format a number as Colombian Pesos (COP). */
export function formatCOP(value: number): string {
    return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Proposal Calculations constants ──────────────────────────

/** Acquisition mode for a scenario (Venta vs DaaS). */
export type AcquisitionMode = 'VENTA' | 'DAAS_12' | 'DAAS_24' | 'DAAS_36' | 'DAAS_48' | 'DAAS_60';

/** Dropdown options for acquisition mode selector. */
export const ACQUISITION_OPTIONS: { value: AcquisitionMode; label: string }[] = [
    { value: 'VENTA', label: 'Venta' },
    { value: 'DAAS_12', label: 'DaaS 12 Meses' },
    { value: 'DAAS_24', label: 'DaaS 24 Meses' },
    { value: 'DAAS_36', label: 'DaaS 36 Meses' },
    { value: 'DAAS_48', label: 'DaaS 48 Meses' },
    { value: 'DAAS_60', label: 'DaaS 60 Meses' },
];
===
// ──────────────────────────────────────────────────────────
// Constantes de negocio — NovoTechFlow
// Centralizan magic numbers y strings en un solo lugar.
// ──────────────────────────────────────────────────────────

import {
    FileText, FileSignature, Building2, ListOrdered,
    Cpu, DollarSign,
    Image as ImageIcon,
} from 'lucide-react';
import type { ProposalStatus } from './types';

/** Tasa de IVA colombiano (19%). */
export const IVA_RATE = 0.19;

/** Porcentaje de flete para proveedores mayoristas. */
export const MAYORISTA_FLETE_PCT = 1.5;

/** Nombre del proveedor mayorista. */
export const PROVEEDOR_MAYORISTA = 'MAYORISTA';

/** Debounce para búsquedas de autocompletado (ms). */
export const AUTOCOMPLETE_DEBOUNCE_MS = 200;

/** Debounce para cierre de sugerencias en onBlur (ms). */
export const SUGGESTION_BLUR_DELAY_MS = 200;

/** Máximo de sugerencias a mostrar en autocompletados. */
export const MAX_SUGGESTIONS = 20;

/** Labels legibles para cada tipo de ítem. */
export const ITEM_TYPE_LABELS: Record<string, string> = {
    PCS: 'PCs',
    ACCESSORIES: 'Accesorios y Opciones',
    PC_SERVICES: 'Servicios PCs',
    SOFTWARE: 'Software',
    INFRASTRUCTURE: 'Infraestructura',
    INFRA_SERVICES: 'Servicios de Infraestructura',
} as const;

/** Mapas de especificaciones técnicas por categoría de ítem. */
export const SPEC_FIELDS_BY_ITEM_TYPE: Record<string, Record<string, { label: string; cat: string }>> = {
    PCS: {
        formato: { label: 'Formato', cat: 'FORMATO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        modelo: { label: 'Modelo', cat: 'MODELO' },
        procesador: { label: 'Procesador', cat: 'PROCESADOR' },
        sistemaOperativo: { label: 'Sistema Operativo', cat: 'SISTEMA_OPERATIVO' },
        graficos: { label: 'Gráficos', cat: 'GRAFICOS' },
        memoriaRam: { label: 'Memoria RAM', cat: 'MEMORIA_RAM' },
        almacenamiento: { label: 'Almacenamiento', cat: 'ALMACENAMIENTO' },
        pantalla: { label: 'Pantalla', cat: 'PANTALLA' },
        network: { label: 'Network', cat: 'NETWORK' },
        seguridad: { label: 'Seguridad', cat: 'SEGURIDAD' },
        garantiaBateria: { label: 'Garantía Batería', cat: 'GARANTIA_BATERIA' },
        garantiaEquipo: { label: 'Garantía Equipo', cat: 'GARANTIA_EQUIPO' },
    },
    ACCESSORIES: {
        tipo: { label: 'Tipo', cat: 'ACC_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        garantia: { label: 'Garantía', cat: 'ACC_GARANTIA' },
    },
    PC_SERVICES: {
        tipo: { label: 'Tipo de Servicio', cat: 'SVC_TIPO' },
        responsable: { label: 'Responsable', cat: 'SVC_RESPONSABLE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'SVC_UM' },
    },
    SOFTWARE: {
        tipo: { label: 'Tipo de Software', cat: 'SW_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'SW_UM' },
    },
    INFRASTRUCTURE: {
        tipo: { label: 'Tipo de Infraestructura', cat: 'INFRA_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        garantia: { label: 'Garantía', cat: 'INFRA_GARANTIA' },
    },
    INFRA_SERVICES: {
        tipo: { label: 'Tipo de Servicio', cat: 'INFRA_SVC_TIPO' },
        responsable: { label: 'Responsable', cat: 'INFRA_SVC_RESPONSABLE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'INFRA_SVC_UM' },
    },
} as const;

// ── Proposal Document Builder constants ──────────────────────

/** Page type display labels */
export const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    PRESENTATION: 'Carta de Presentación',
    COMPANY_INFO: 'Info. General',
    INDEX: 'Índice',
    TECH_SPEC: 'Propuesta Técnica',
    ECONOMIC: 'Propuesta Económica',
    TERMS: 'Términos y Condiciones',
    CUSTOM: 'Página Personalizada',
};

/** Page type icons & colors */
export const PAGE_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof FileText }> = {
    COVER: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: ImageIcon },
    PRESENTATION: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', icon: FileSignature },
    COMPANY_INFO: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: Building2 },
    INDEX: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: ListOrdered },
    TECH_SPEC: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', icon: Cpu },
    ECONOMIC: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', icon: DollarSign },
    TERMS: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', icon: FileText },
    CUSTOM: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', icon: FileText },
};

/** Virtual section IDs for the generated sections */
export const VIRTUAL_TECH_SPEC_ID = '__virtual_tech_spec__';
export const VIRTUAL_ECONOMIC_ID = '__virtual_economic__';

// ── Dashboard constants ──────────────────────────────────────


/** Status badge configuration for Dashboard rows. */
export const STATUS_CONFIG: Record<ProposalStatus, { label: string; bg: string; text: string; border: string }> = {
    ELABORACION:        { label: 'Elaboración',    bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    PROPUESTA:          { label: 'Propuesta',      bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
    GANADA:             { label: 'Ganada',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    PERDIDA:            { label: 'Perdida',         bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
    PENDIENTE_FACTURAR: { label: 'Pend. Facturar', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
    FACTURADA:          { label: 'Facturada',       bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
};

/** All proposal statuses in display order. */
export const ALL_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA', 'GANADA', 'PERDIDA', 'PENDIENTE_FACTURAR', 'FACTURADA'];

/** Statuses valid for billing projections. */
export const PROJECTION_STATUSES: ProposalStatus[] = ['PENDIENTE_FACTURAR', 'FACTURADA'];

/** Acquisition type badge configuration. */
export const ACQUISITION_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    VENTA: { label: 'Venta', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    DAAS:  { label: 'DaaS',  bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
};

/** Format a number as Colombian Pesos (COP). */
export function formatCOP(value: number): string {
    return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Format a number as US Dollars (USD). */
export function formatUSD(value: number): string {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** TRM public API endpoint (Colombian Central Bank rate). */
export const TRM_API_URL = 'https://co.dolarapi.com/v1/trm';

// ── Proposal Calculations constants ──────────────────────────

/** Acquisition mode for a scenario (Venta vs DaaS). */
export type AcquisitionMode = 'VENTA' | 'DAAS_12' | 'DAAS_24' | 'DAAS_36' | 'DAAS_48' | 'DAAS_60';

/** Dropdown options for acquisition mode selector. */
export const ACQUISITION_OPTIONS: { value: AcquisitionMode; label: string }[] = [
    { value: 'VENTA', label: 'Venta' },
    { value: 'DAAS_12', label: 'DaaS 12 Meses' },
    { value: 'DAAS_24', label: 'DaaS 24 Meses' },
    { value: 'DAAS_36', label: 'DaaS 36 Meses' },
    { value: 'DAAS_48', label: 'DaaS 48 Meses' },
    { value: 'DAAS_60', label: 'DaaS 60 Meses' },
];
```

- `formatUSD` mirrors `formatCOP` but uses `en-US` locale with 2 decimal places
- `TRM_API_URL` avoids a magic string for the dolarapi endpoint

---

### 3. `hooks/useDashboard.ts` — Core logic changes
```diff:useDashboard.ts
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType } from '../lib/types';
import { calculateScenarioTotals } from '../lib/pricing-engine';

// ── Utility: compute min-scenario subtotal (via pricing engine) ──
function computeMinSubtotal(proposal: ProposalSummary): number | null {
    if (!proposal.scenarios || proposal.scenarios.length === 0) return null;

    let minSubtotal: number | null = null;

    for (const scenario of proposal.scenarios) {
        // Delegate to centralized engine (includes dilution, children, etc.)
        const totals = calculateScenarioTotals(scenario.scenarioItems);
        const subtotal = totals.subtotal;

        if (minSubtotal === null || subtotal < minSubtotal) {
            minSubtotal = subtotal;
        }
    }

    return minSubtotal;
}

// ── Helper: parse ISO date to { month (0-indexed), year } without timezone shift ──
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

// ── Helper: compute billing cards filtered by acquisition type ──
type ProposalWithSubtotal = ProposalSummary & { minSubtotal: number | null };

function computeBillingCards(
    proposals: ProposalWithSubtotal[],
    projections: BillingProjection[],
    acquisitionFilter: AcquisitionType,
): BillingCards {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const currentQuarter = Math.floor(thisMonth / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    let facturadoMesAnterior = 0;
    let facturadoMesActual = 0;
    let facturadoTrimestreActual = 0;
    let proyeccionTrimestreSiguiente = 0;
    let pendFactMesActual = 0;
    let pendFactMesSiguiente = 0;

    const filteredProposals = proposals.filter(p => p.acquisitionType === acquisitionFilter);
    const filteredProjections = projections.filter(pr => pr.acquisitionType === acquisitionFilter);

    for (const p of filteredProposals) {
        const sub = p.minSubtotal || 0;

        if (p.status === 'FACTURADA' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (p.status === 'GANADA' && p.closeDate) {
            const { month, year } = parseDate(p.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    for (const pr of filteredProjections) {
        const sub = Number(pr.subtotal) || 0;

        if (pr.status === 'FACTURADA' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }
    }

    return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
}

// ── Unified row type ──
export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    // Only for proposals
    originalProposal?: ProposalSummary & { minSubtotal: number | null };
    // Only for projections
    originalProjection?: BillingProjection;
}

export interface BillingCards {
    facturadoMesAnterior: number;
    facturadoMesActual: number;
    facturadoTrimestreActual: number;
    proyeccionTrimestreSiguiente: number;
    pendFactMesActual: number;
    pendFactMesSiguiente: number;
}

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());
    const [subtotalMin, setSubtotalMin] = useState('');
    const [subtotalMax, setSubtotalMax] = useState('');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [proposalsRes, projectionsRes] = await Promise.all([
                api.get('/proposals'),
                api.get('/billing-projections'),
            ]);
            setProposals(proposalsRes.data);
            setProjections(projectionsRes.data);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        }
    };

    // ── Computed values ──
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => ({
            ...p,
            minSubtotal: computeMinSubtotal(p),
        }));
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.minSubtotal,
            status: p.status,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            user: p.user,
            isProjection: false,
            originalProposal: p,
        }));

        const projectionRows: DashboardRow[] = projections.map(pr => ({
            id: pr.id,
            code: pr.projectionCode,
            clientName: pr.clientName,
            subject: '',
            minSubtotal: Number(pr.subtotal),
            status: pr.status as ProposalStatus,
            closeDate: null,
            billingDate: pr.billingDate,
            acquisitionType: pr.acquisitionType,
            updatedAt: pr.updatedAt,
            user: pr.user,
            isProjection: true,
            originalProjection: pr,
        }));

        return [...proposalRows, ...projectionRows];
    }, [proposalsWithSubtotals, projections]);

    const filtered = useMemo(() => {
        return allRows.filter(p => {
            // Text search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = p.code?.toLowerCase().includes(term) ||
                    p.clientName.toLowerCase().includes(term) ||
                    p.subject.toLowerCase().includes(term);
                if (!matches) return false;
            }
            // Status filter
            if (statusFilters.size > 0 && !statusFilters.has(p.status)) return false;
            // Subtotal range
            if (subtotalMin && p.minSubtotal !== null && p.minSubtotal < parseFloat(subtotalMin)) return false;
            if (subtotalMax && p.minSubtotal !== null && p.minSubtotal > parseFloat(subtotalMax)) return false;
            return true;
        });
    }, [allRows, searchTerm, statusFilters, subtotalMin, subtotalMax]);

    // ── Billing summary cards per acquisition type ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'VENTA'),
        [proposalsWithSubtotals, projections],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'DAAS'),
        [proposalsWithSubtotals, projections],
    );

    // ── Actions ──
    const handleStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/proposals/${id}`, { status: newStatus });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = async (id: string, field: 'closeDate' | 'billingDate', value: string) => {
        try {
            await api.patch(`/proposals/${id}`, { [field]: value || null });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => {
        setCloning(id);
        try {
            await api.post(`/proposals/${id}/clone`, { cloneType });
            await loadProposals();
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloning(null);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?\n\nEsta acción no se puede deshacer. Se eliminarán todos los ítems, escenarios y datos asociados.`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    const handleAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/proposals/${id}`, { acquisitionType: value });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, acquisitionType: value } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/billing-projections/${id}`, { acquisitionType: value });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, acquisitionType: value } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/billing-projections/${id}`, { status: newStatus });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, status: newStatus as 'PENDIENTE_FACTURAR' | 'FACTURADA' } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionDateChange = async (id: string, value: string) => {
        try {
            await api.patch(`/billing-projections/${id}`, { billingDate: value || null });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, billingDate: value || null } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatusFilter = (status: ProposalStatus) => {
        setStatusFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters(new Set());
        setSubtotalMin('');
        setSubtotalMax('');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0 || subtotalMin || subtotalMax;

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
        cloning,
        setProjections,

        // Filter state
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        statusFilters,
        subtotalMin,
        setSubtotalMin,
        subtotalMax,
        setSubtotalMax,
        hasActiveFilters,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}
===
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { calculateScenarioTotals } from '../lib/pricing-engine';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType } from '../lib/types';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
}

type ProposalWithSubtotal = ProposalSummary & MinSubtotalResult;

export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    minSubtotalCurrency: CurrencyCode | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    originalProposal?: ProposalWithSubtotal;
    originalProjection?: BillingProjection;
}

export interface BillingCards {
    facturadoMesAnterior: number;
    facturadoMesActual: number;
    facturadoTrimestreActual: number;
    proyeccionTrimestreSiguiente: number;
    pendFactMesActual: number;
    pendFactMesSiguiente: number;
}

// ── Pure helpers ─────────────────────────────────────────────

/** Find the scenario with the minimum subtotal and return its value + currency. */
function computeMinSubtotal(proposal: ProposalSummary): MinSubtotalResult {
    if (!proposal.scenarios || proposal.scenarios.length === 0) {
        return { subtotal: null, currency: null };
    }

    let minSubtotal: number | null = null;
    let minCurrency: CurrencyCode | null = null;

    for (const scenario of proposal.scenarios) {
        const totals = calculateScenarioTotals(scenario.scenarioItems);
        const sub = totals.subtotal;

        if (minSubtotal === null || sub < minSubtotal) {
            minSubtotal = sub;
            minCurrency = (scenario.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode;
        }
    }

    return { subtotal: minSubtotal, currency: minCurrency };
}

/**
 * Convert a subtotal to USD.
 * - If already in USD → return as-is.
 * - If COP and trmRate > 0 → divide.
 * - Otherwise → null.
 */
export function getSubtotalUsd(
    subtotal: number | null,
    currency: CurrencyCode | null,
    trmRate: number | null,
): number | null {
    if (subtotal === null || currency === null) return null;
    if (currency === 'USD') return subtotal;
    if (currency === 'COP' && trmRate && trmRate > 0) return subtotal / trmRate;
    return null;
}

/** Parse ISO date → { month (0-indexed), year } without timezone shift. */
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

/** Compute billing cards for a single acquisition type. All subtotals converted to USD. */
function computeBillingCards(
    proposals: ProposalWithSubtotal[],
    projections: BillingProjection[],
    acquisitionFilter: AcquisitionType,
    trmRate: number | null,
): BillingCards {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const currentQuarter = Math.floor(thisMonth / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    let facturadoMesAnterior = 0;
    let facturadoMesActual = 0;
    let facturadoTrimestreActual = 0;
    let proyeccionTrimestreSiguiente = 0;
    let pendFactMesActual = 0;
    let pendFactMesSiguiente = 0;

    const filteredProposals = proposals.filter(p => p.acquisitionType === acquisitionFilter);
    const filteredProjections = projections.filter(pr => pr.acquisitionType === acquisitionFilter);

    for (const p of filteredProposals) {
        const sub = getSubtotalUsd(p.subtotal, p.currency, trmRate) ?? 0;

        if (p.status === 'FACTURADA' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (p.status === 'GANADA' && p.closeDate) {
            const { month, year } = parseDate(p.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    // Projections: assumed COP if no currency info; convert to USD via TRM
    for (const pr of filteredProjections) {
        const rawSub = Number(pr.subtotal) || 0;
        const sub = getSubtotalUsd(rawSub, 'COP', trmRate) ?? 0;

        if (pr.status === 'FACTURADA' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }
    }

    return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
}

// ── Hook ─────────────────────────────────────────────────────

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // TRM (frontend-only, editable)
    const [trmRate, setTrmRate] = useState<number | null>(null);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());
    const [subtotalMin, setSubtotalMin] = useState('');
    const [subtotalMax, setSubtotalMax] = useState('');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        fetchTrm();
    }, []);

    const loadData = async () => {
        try {
            const [proposalsRes, projectionsRes] = await Promise.all([
                api.get('/proposals'),
                api.get('/billing-projections'),
            ]);
            setProposals(proposalsRes.data);
            setProjections(projectionsRes.data);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    /** Fetch TRM once on mount as suggested default value. */
    const fetchTrm = async () => {
        try {
            const res = await fetch(TRM_API_URL);
            const data = await res.json();
            setTrmRate(data.valor ?? null);
        } catch (error) {
            console.error('Error fetching TRM:', error);
        }
    };

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        }
    };

    // ── Computed values ──
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => {
            const { subtotal, currency } = computeMinSubtotal(p);
            return { ...p, subtotal, currency };
        });
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.subtotal,
            minSubtotalCurrency: p.currency,
            status: p.status,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            user: p.user,
            isProjection: false,
            originalProposal: p,
        }));

        const projectionRows: DashboardRow[] = projections.map(pr => ({
            id: pr.id,
            code: pr.projectionCode,
            clientName: pr.clientName,
            subject: '',
            minSubtotal: Number(pr.subtotal),
            minSubtotalCurrency: 'COP' as CurrencyCode,
            status: pr.status as ProposalStatus,
            closeDate: null,
            billingDate: pr.billingDate,
            acquisitionType: pr.acquisitionType,
            updatedAt: pr.updatedAt,
            user: pr.user,
            isProjection: true,
            originalProjection: pr,
        }));

        return [...proposalRows, ...projectionRows];
    }, [proposalsWithSubtotals, projections]);

    const filtered = useMemo(() => {
        return allRows.filter(p => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = p.code?.toLowerCase().includes(term) ||
                    p.clientName.toLowerCase().includes(term) ||
                    p.subject.toLowerCase().includes(term);
                if (!matches) return false;
            }
            if (statusFilters.size > 0 && !statusFilters.has(p.status)) return false;
            if (subtotalMin && p.minSubtotal !== null && p.minSubtotal < parseFloat(subtotalMin)) return false;
            if (subtotalMax && p.minSubtotal !== null && p.minSubtotal > parseFloat(subtotalMax)) return false;
            return true;
        });
    }, [allRows, searchTerm, statusFilters, subtotalMin, subtotalMax]);

    // ── Billing summary cards per acquisition type (values in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'VENTA', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'DAAS', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    // ── Actions ──
    const handleStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/proposals/${id}`, { status: newStatus });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = async (id: string, field: 'closeDate' | 'billingDate', value: string) => {
        try {
            await api.patch(`/proposals/${id}`, { [field]: value || null });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => {
        setCloning(id);
        try {
            await api.post(`/proposals/${id}/clone`, { cloneType });
            await loadProposals();
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloning(null);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?\n\nEsta acción no se puede deshacer. Se eliminarán todos los ítems, escenarios y datos asociados.`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    const handleAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/proposals/${id}`, { acquisitionType: value });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, acquisitionType: value } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/billing-projections/${id}`, { acquisitionType: value });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, acquisitionType: value } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/billing-projections/${id}`, { status: newStatus });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, status: newStatus as 'PENDIENTE_FACTURAR' | 'FACTURADA' } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionDateChange = async (id: string, value: string) => {
        try {
            await api.patch(`/billing-projections/${id}`, { billingDate: value || null });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, billingDate: value || null } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatusFilter = (status: ProposalStatus) => {
        setStatusFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters(new Set());
        setSubtotalMin('');
        setSubtotalMax('');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0 || subtotalMin || subtotalMax;

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
        cloning,
        setProjections,
        trmRate,
        setTrmRate,

        // Filter state
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        statusFilters,
        subtotalMin,
        setSubtotalMin,
        subtotalMax,
        setSubtotalMax,
        hasActiveFilters,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}

```

Key changes:
| Area | Before | After |
|:--|:--|:--|
| `computeMinSubtotal` | Returns `number \| null` | Returns `{ subtotal, currency }` |
| TRM state | Not present | `trmRate` + `setTrmRate` + auto-fetch on mount |
| `getSubtotalUsd()` | Not present | Pure function: USD→passthrough, COP→divide by TRM |
| `computeBillingCards` | Sums raw subtotals | Converts all subtotals to USD via `getSubtotalUsd` before summing |
| `DashboardRow` | `minSubtotal` only | Added `minSubtotalCurrency: CurrencyCode \| null` |

---

### 4. `pages/Dashboard.tsx` — UI changes
```diff:Dashboard.tsx
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle, Trash2, Edit2, Loader2,
    Copy, Search, Filter, X, Receipt,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDashboard } from '../hooks/useDashboard';
import { useProjections } from '../hooks/useProjections';
import { STATUS_CONFIG, ALL_STATUSES, PROJECTION_STATUSES, ACQUISITION_CONFIG, formatCOP } from '../lib/constants';
import type { ProposalStatus, AcquisitionType } from '../lib/types';
import BillingCards from './dashboard/BillingCards';
import ProjectionModal from './dashboard/ProjectionModal';

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const {
        loading, filtered, billingCardsVenta, billingCardsDaas, cloning, setProjections,
        showFilters, setShowFilters, searchTerm, setSearchTerm,
        statusFilters, subtotalMin, setSubtotalMin, subtotalMax, setSubtotalMax,
        hasActiveFilters,
        handleStatusChange, handleDateChange, handleClone, handleDelete,
        handleAcquisitionChange, handleProjectionAcquisitionChange,
        handleProjectionStatusChange, handleProjectionDateChange,
        toggleStatusFilter, clearFilters,
    } = useDashboard();

    const {
        showProjectionModal, setShowProjectionModal,
        editingProjection, projForm, setProjForm, savingProjection,
        openNewProjectionModal, openEditProjectionModal,
        handleSaveProjection, handleDeleteProjection,
    } = useProjections(setProjections);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {user?.role === 'ADMIN' ? 'Resumen Global de Actividad' : 'Mis Propuestas'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {user?.role === 'ADMIN' ? 'Métricas y propuestas de todo el equipo comercial.' : 'Gestiona tus cotizaciones y cierres.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openNewProjectionModal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-600/25"
                    >
                        <Receipt className="h-5 w-5" />
                        <span>Proyección de Facturación</span>
                    </button>
                    <button
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25"
                    >
                        <PlusCircle className="h-5 w-5" />
                        <span>Nueva Propuesta</span>
                    </button>
                </div>
            </div>

            {/* Financial Cards */}
            <BillingCards billingCardsVenta={billingCardsVenta} billingCardsDaas={billingCardsDaas} />

            {/* Filter Toggle + Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código, cliente o asunto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    <Filter className="h-4 w-4" />
                    <span>Filtros</span>
                    {hasActiveFilters && <span className="h-2 w-2 bg-indigo-500 rounded-full" />}
                </button>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className="p-2.5 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => {
                                const cfg = STATUS_CONFIG[s];
                                const active = statusFilters.has(s);
                                return (
                                    <button
                                        key={s}
                                        onClick={() => toggleStatusFilter(s)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                    >
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Subtotal mín.</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={subtotalMin}
                                onChange={(e) => setSubtotalMin(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Subtotal máx.</label>
                            <input
                                type="number"
                                placeholder="∞"
                                value={subtotalMax}
                                onChange={(e) => setSubtotalMax(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Proposals Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                        {filtered.length} Registro{filtered.length !== 1 ? 's' : ''}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3">Código</th>
                                <th className="px-4 py-3">Cliente / Asunto</th>
                                {user?.role === 'ADMIN' && <th className="px-4 py-3 text-center">Asesor</th>}
                                <th className="px-4 py-3 text-center">F. Cierre</th>
                                <th className="px-4 py-3 text-center">Actualización</th>
                                <th className="px-4 py-3 text-right">Subtotal Min.</th>
                                <th className="px-4 py-3 text-center">Adquisición</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 9 : 8} className="px-6 py-16 text-center text-gray-400">
                                        No hay propuestas que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    if (row.isProjection) {
                                        // ── Projection Row ──
                                        const pr = row.originalProjection!;
                                        const cfg = STATUS_CONFIG[row.status];
                                        return (
                                            <tr key={`proj-${row.id}`} className="hover:bg-violet-50/30 transition-colors group bg-violet-50/10">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-violet-600 text-xs">{row.code}</span>
                                                        <span className="text-[8px] font-bold uppercase bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md border border-violet-200">PROY</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="font-bold text-gray-900 text-sm">{row.clientName}</p>
                                                    <p className="text-[10px] text-violet-400 mt-0.5">Proyección de facturación</p>
                                                </td>
                                                {user?.role === 'ADMIN' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-[10px] font-bold uppercase text-violet-600 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100">
                                                            {pr.user?.nomenclature || '??'} - {pr.user?.name?.split(' ')[0]}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                    {new Date(row.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-mono font-black text-xs text-emerald-700">{formatCOP(Number(pr.subtotal))}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={pr.acquisitionType || ''}
                                                        onChange={(e) => handleProjectionAcquisitionChange(row.id, e.target.value as AcquisitionType)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                            pr.acquisitionType && ACQUISITION_CONFIG[pr.acquisitionType]
                                                                ? `${ACQUISITION_CONFIG[pr.acquisitionType].bg} ${ACQUISITION_CONFIG[pr.acquisitionType].text} ${ACQUISITION_CONFIG[pr.acquisitionType].border}`
                                                                : 'bg-gray-50 text-gray-400 border-gray-200'
                                                        }`}
                                                    >
                                                        <option value="">— Seleccionar —</option>
                                                        <option value="VENTA">Venta</option>
                                                        <option value="DAAS">DaaS</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={row.status}
                                                        onChange={(e) => handleProjectionStatusChange(row.id, e.target.value as ProposalStatus)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-violet-600/20`}
                                                    >
                                                        {PROJECTION_STATUSES.map(s => (
                                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleProjectionDateChange(row.id, e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <button
                                                            onClick={() => openEditProjectionModal(pr)}
                                                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                            title="Editar proyección"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProjection(row.id, row.code)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Eliminar proyección"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // ── Proposal Row (original logic) ──
                                    const p = row.originalProposal!;
                                    const cfg = STATUS_CONFIG[p.status];
                                    const needsBillingDate = p.status === 'PENDIENTE_FACTURAR' || p.status === 'FACTURADA';

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="font-mono font-black text-indigo-600 text-xs">{p.proposalCode}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900 text-sm">{p.clientName}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1" title={p.subject}>{p.subject}</p>
                                            </td>
                                            {user?.role === 'ADMIN' && (
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                                        {p.user?.nomenclature || '??'} - {p.user?.name?.split(' ')[0]}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="date"
                                                    value={p.closeDate ? new Date(p.closeDate).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleDateChange(p.id, 'closeDate', e.target.value)}
                                                    className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 w-[120px]"
                                                />

                                            </td>
                                            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                {new Date(p.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {row.minSubtotal !== null ? (
                                                    <span className="font-mono font-black text-xs text-emerald-700">{formatCOP(row.minSubtotal)}</span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">Sin escenario</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.acquisitionType || ''}
                                                    onChange={(e) => handleAcquisitionChange(p.id, e.target.value as AcquisitionType)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                        p.acquisitionType && ACQUISITION_CONFIG[p.acquisitionType]
                                                            ? `${ACQUISITION_CONFIG[p.acquisitionType].bg} ${ACQUISITION_CONFIG[p.acquisitionType].text} ${ACQUISITION_CONFIG[p.acquisitionType].border}`
                                                            : 'bg-gray-50 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    <option value="">— Seleccionar —</option>
                                                    <option value="VENTA">Venta</option>
                                                    <option value="DAAS">DaaS</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.status}
                                                    onChange={(e) => handleStatusChange(p.id, e.target.value as ProposalStatus)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-indigo-600/20`}
                                                >
                                                    {ALL_STATUSES.map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                                {needsBillingDate && (
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={p.billingDate ? new Date(p.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleDateChange(p.id, 'billingDate', e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button
                                                        onClick={() => navigate(`/proposals/${p.id}/builder`)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_VERSION')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Clonar versión"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_PROPOSAL')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                        title="Clonar como nueva propuesta"
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p.id, p.proposalCode || '')}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Projection Modal */}
            {showProjectionModal && (
                <ProjectionModal
                    editingProjection={editingProjection}
                    projForm={projForm}
                    setProjForm={setProjForm}
                    savingProjection={savingProjection}
                    onSave={handleSaveProjection}
                    onClose={() => setShowProjectionModal(false)}
                />
            )}
        </div>
    );
}
===
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle, Trash2, Edit2, Loader2,
    Copy, Search, Filter, X, Receipt,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDashboard, getSubtotalUsd } from '../hooks/useDashboard';
import { useProjections } from '../hooks/useProjections';
import { STATUS_CONFIG, ALL_STATUSES, PROJECTION_STATUSES, ACQUISITION_CONFIG, formatCOP, formatUSD } from '../lib/constants';
import type { ProposalStatus, AcquisitionType } from '../lib/types';
import BillingCards from './dashboard/BillingCards';
import ProjectionModal from './dashboard/ProjectionModal';

/** Format a subtotal with its currency label (COP or USD). */
function formatSubtotalWithCurrency(value: number, currency: 'COP' | 'USD' | null): string {
    if (currency === 'USD') return `USD ${formatUSD(value)}`;
    return `COP ${formatCOP(value)}`;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const {
        loading, filtered, billingCardsVenta, billingCardsDaas, cloning, setProjections,
        trmRate, setTrmRate,
        showFilters, setShowFilters, searchTerm, setSearchTerm,
        statusFilters, subtotalMin, setSubtotalMin, subtotalMax, setSubtotalMax,
        hasActiveFilters,
        handleStatusChange, handleDateChange, handleClone, handleDelete,
        handleAcquisitionChange, handleProjectionAcquisitionChange,
        handleProjectionStatusChange, handleProjectionDateChange,
        toggleStatusFilter, clearFilters,
    } = useDashboard();

    const {
        showProjectionModal, setShowProjectionModal,
        editingProjection, projForm, setProjForm, savingProjection,
        openNewProjectionModal, openEditProjectionModal,
        handleSaveProjection, handleDeleteProjection,
    } = useProjections(setProjections);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {user?.role === 'ADMIN' ? 'Resumen Global de Actividad' : 'Mis Propuestas'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {user?.role === 'ADMIN' ? 'Métricas y propuestas de todo el equipo comercial.' : 'Gestiona tus cotizaciones y cierres.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* TRM Input */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                        <label htmlFor="trm-input" className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                            TRM (COP/USD)
                        </label>
                        <input
                            id="trm-input"
                            type="number"
                            step="0.01"
                            value={trmRate ?? ''}
                            onChange={(e) => setTrmRate(e.target.value ? Number(e.target.value) : null)}
                            className="w-[100px] text-sm font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-right focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-300"
                            placeholder="—"
                        />
                    </div>
                    <button
                        onClick={openNewProjectionModal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-600/25"
                    >
                        <Receipt className="h-5 w-5" />
                        <span>Proyección de Facturación</span>
                    </button>
                    <button
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25"
                    >
                        <PlusCircle className="h-5 w-5" />
                        <span>Nueva Propuesta</span>
                    </button>
                </div>
            </div>

            {/* Financial Cards */}
            <BillingCards billingCardsVenta={billingCardsVenta} billingCardsDaas={billingCardsDaas} />

            {/* Filter Toggle + Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código, cliente o asunto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    <Filter className="h-4 w-4" />
                    <span>Filtros</span>
                    {hasActiveFilters && <span className="h-2 w-2 bg-indigo-500 rounded-full" />}
                </button>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className="p-2.5 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => {
                                const cfg = STATUS_CONFIG[s];
                                const active = statusFilters.has(s);
                                return (
                                    <button
                                        key={s}
                                        onClick={() => toggleStatusFilter(s)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                    >
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Subtotal mín.</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={subtotalMin}
                                onChange={(e) => setSubtotalMin(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Subtotal máx.</label>
                            <input
                                type="number"
                                placeholder="∞"
                                value={subtotalMax}
                                onChange={(e) => setSubtotalMax(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Proposals Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                        {filtered.length} Registro{filtered.length !== 1 ? 's' : ''}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3">Código</th>
                                <th className="px-4 py-3">Cliente / Asunto</th>
                                {user?.role === 'ADMIN' && <th className="px-4 py-3 text-center">Asesor</th>}
                                <th className="px-4 py-3 text-center">F. Cierre</th>
                                <th className="px-4 py-3 text-center">Actualización</th>
                                <th className="px-4 py-3 text-right">Subtotal Min.</th>
                                <th className="px-4 py-3 text-right">USD Est.</th>
                                <th className="px-4 py-3 text-center">Adquisición</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 10 : 9} className="px-6 py-16 text-center text-gray-400">
                                        No hay propuestas que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);

                                    if (row.isProjection) {
                                        // ── Projection Row ──
                                        const pr = row.originalProjection!;
                                        const cfg = STATUS_CONFIG[row.status];
                                        return (
                                            <tr key={`proj-${row.id}`} className="hover:bg-violet-50/30 transition-colors group bg-violet-50/10">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-violet-600 text-xs">{row.code}</span>
                                                        <span className="text-[8px] font-bold uppercase bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md border border-violet-200">PROY</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="font-bold text-gray-900 text-sm">{row.clientName}</p>
                                                    <p className="text-[10px] text-violet-400 mt-0.5">Proyección de facturación</p>
                                                </td>
                                                {user?.role === 'ADMIN' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-[10px] font-bold uppercase text-violet-600 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100">
                                                            {pr.user?.nomenclature || '??'} - {pr.user?.name?.split(' ')[0]}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                    {new Date(row.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-mono font-black text-xs text-emerald-700">
                                                        {formatSubtotalWithCurrency(Number(pr.subtotal), row.minSubtotalCurrency)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    {usdEst !== null ? (
                                                        <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={pr.acquisitionType || ''}
                                                        onChange={(e) => handleProjectionAcquisitionChange(row.id, e.target.value as AcquisitionType)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                            pr.acquisitionType && ACQUISITION_CONFIG[pr.acquisitionType]
                                                                ? `${ACQUISITION_CONFIG[pr.acquisitionType].bg} ${ACQUISITION_CONFIG[pr.acquisitionType].text} ${ACQUISITION_CONFIG[pr.acquisitionType].border}`
                                                                : 'bg-gray-50 text-gray-400 border-gray-200'
                                                        }`}
                                                    >
                                                        <option value="">— Seleccionar —</option>
                                                        <option value="VENTA">Venta</option>
                                                        <option value="DAAS">DaaS</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={row.status}
                                                        onChange={(e) => handleProjectionStatusChange(row.id, e.target.value as ProposalStatus)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-violet-600/20`}
                                                    >
                                                        {PROJECTION_STATUSES.map(s => (
                                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleProjectionDateChange(row.id, e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <button
                                                            onClick={() => openEditProjectionModal(pr)}
                                                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                            title="Editar proyección"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProjection(row.id, row.code)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Eliminar proyección"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // ── Proposal Row (original logic) ──
                                    const p = row.originalProposal!;
                                    const cfg = STATUS_CONFIG[p.status];
                                    const needsBillingDate = p.status === 'PENDIENTE_FACTURAR' || p.status === 'FACTURADA';

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="font-mono font-black text-indigo-600 text-xs">{p.proposalCode}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900 text-sm">{p.clientName}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1" title={p.subject}>{p.subject}</p>
                                            </td>
                                            {user?.role === 'ADMIN' && (
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                                        {p.user?.nomenclature || '??'} - {p.user?.name?.split(' ')[0]}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="date"
                                                    value={p.closeDate ? new Date(p.closeDate).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleDateChange(p.id, 'closeDate', e.target.value)}
                                                    className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 w-[120px]"
                                                />

                                            </td>
                                            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                {new Date(p.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {row.minSubtotal !== null ? (
                                                    <span className="font-mono font-black text-xs text-emerald-700">
                                                        {formatSubtotalWithCurrency(row.minSubtotal, row.minSubtotalCurrency)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">Sin escenario</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {usdEst !== null ? (
                                                    <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.acquisitionType || ''}
                                                    onChange={(e) => handleAcquisitionChange(p.id, e.target.value as AcquisitionType)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                        p.acquisitionType && ACQUISITION_CONFIG[p.acquisitionType]
                                                            ? `${ACQUISITION_CONFIG[p.acquisitionType].bg} ${ACQUISITION_CONFIG[p.acquisitionType].text} ${ACQUISITION_CONFIG[p.acquisitionType].border}`
                                                            : 'bg-gray-50 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    <option value="">— Seleccionar —</option>
                                                    <option value="VENTA">Venta</option>
                                                    <option value="DAAS">DaaS</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.status}
                                                    onChange={(e) => handleStatusChange(p.id, e.target.value as ProposalStatus)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-indigo-600/20`}
                                                >
                                                    {ALL_STATUSES.map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                                {needsBillingDate && (
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={p.billingDate ? new Date(p.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleDateChange(p.id, 'billingDate', e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button
                                                        onClick={() => navigate(`/proposals/${p.id}/builder`)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_VERSION')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Clonar versión"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_PROPOSAL')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                        title="Clonar como nueva propuesta"
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p.id, p.proposalCode || '')}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Projection Modal */}
            {showProjectionModal && (
                <ProjectionModal
                    editingProjection={editingProjection}
                    projForm={projForm}
                    setProjForm={setProjForm}
                    savingProjection={savingProjection}
                    onSave={handleSaveProjection}
                    onClose={() => setShowProjectionModal(false)}
                />
            )}
        </div>
    );
}

```

- **TRM Input**: Editable number input in the header, pre-populated from dolarapi, labeled "TRM (COP/USD)"
- **Subtotal column**: Now shows currency prefix (`COP $1.420` or `USD $1,420.18`)
- **New "USD Est." column**: After subtotal, shows the USD equivalent. If COP, divides by TRM. If USD, shows same value. If no TRM, shows `—`
- **colSpan** updated for the empty-state row

---

### 5. `pages/dashboard/BillingCards.tsx` — USD formatting
```diff:BillingCards.tsx
import {
    Clock, DollarSign, Calendar, TrendingUp, BarChart3, AlertCircle,
} from 'lucide-react';
import type { BillingCards as BillingCardsType } from '../../hooks/useDashboard';
import { formatCOP, ACQUISITION_CONFIG } from '../../lib/constants';
import type { AcquisitionType } from '../../lib/types';

interface BillingCardsProps {
    billingCardsVenta: BillingCardsType;
    billingCardsDaas: BillingCardsType;
}

/** Color themes per acquisition type for the billing card rows. */
const CARD_THEMES: Record<AcquisitionType, {
    headerBg: string;
    headerText: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
    gradientFrom: string;
}> = {
    VENTA: {
        headerBg: 'bg-sky-50',
        headerText: 'text-sky-700',
        accentBg: 'bg-sky-50',
        accentText: 'text-sky-600',
        accentBorder: 'border-sky-200',
        gradientFrom: 'from-white to-sky-50/30',
    },
    DAAS: {
        headerBg: 'bg-pink-50',
        headerText: 'text-pink-700',
        accentBg: 'bg-pink-50',
        accentText: 'text-pink-600',
        accentBorder: 'border-pink-200',
        gradientFrom: 'from-white to-pink-50/30',
    },
};

const CARD_DEFINITIONS = [
    { key: 'facturadoMesAnterior' as const, label: 'Fact. Mes Anterior', Icon: Clock,        iconBg: 'bg-slate-100', iconText: 'text-slate-500', labelText: 'text-slate-400', valueText: 'text-slate-800' },
    { key: 'facturadoMesActual' as const,   label: 'Fact. Mes Actual',   Icon: DollarSign,    iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', labelText: 'text-emerald-500', valueText: 'text-emerald-700' },
    { key: 'pendFactMesActual' as const,    label: 'Pend. Fact. Mes Actual', Icon: AlertCircle, iconBg: 'bg-orange-50', iconText: 'text-orange-500', labelText: 'text-orange-500', valueText: 'text-orange-700' },
    { key: 'pendFactMesSiguiente' as const, label: 'Pend. Fact. Mes Sig.', Icon: Calendar,    iconBg: 'bg-amber-50', iconText: 'text-amber-500', labelText: 'text-amber-500', valueText: 'text-amber-700' },
    { key: 'facturadoTrimestreActual' as const, label: 'Trimestre Actual', Icon: BarChart3,   iconBg: 'bg-blue-50', iconText: 'text-blue-500', labelText: 'text-blue-500', valueText: 'text-blue-700' },
    { key: 'proyeccionTrimestreSiguiente' as const, label: 'Proy. Trim. Sig.', Icon: TrendingUp, iconBg: 'bg-violet-50', iconText: 'text-violet-500', labelText: 'text-violet-500', valueText: 'text-violet-700' },
];

function isRowEmpty(cards: BillingCardsType): boolean {
    return Object.values(cards).every(v => v === 0);
}

function BillingCardRow({ cards, acquisitionType }: { cards: BillingCardsType; acquisitionType: AcquisitionType }) {
    const theme = CARD_THEMES[acquisitionType];
    const config = ACQUISITION_CONFIG[acquisitionType];

    return (
        <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${theme.headerBg}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.headerText}`}>
                    Proyección {config.label}
                </span>
            </div>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {CARD_DEFINITIONS.map(({ key, label, Icon, iconBg, iconText, labelText, valueText }) => (
                    <div
                        key={key}
                        className={`bg-white rounded-2xl p-5 shadow-sm border ${theme.accentBorder} bg-gradient-to-br ${theme.gradientFrom}`}
                    >
                        <div className="flex items-center space-x-3 mb-3">
                            <div className={`h-10 w-10 ${iconBg} rounded-xl flex items-center justify-center ${iconText}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelText}`}>{label}</span>
                        </div>
                        <p className={`text-lg font-black ${valueText}`}>{formatCOP(cards[key])}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BillingCards({ billingCardsVenta, billingCardsDaas }: BillingCardsProps) {
    const isVentaEmpty = isRowEmpty(billingCardsVenta);
    const isDaasEmpty = isRowEmpty(billingCardsDaas);

    if (isVentaEmpty && isDaasEmpty) return null;

    return (
        <div className="space-y-5">
            {!isVentaEmpty && <BillingCardRow cards={billingCardsVenta} acquisitionType="VENTA" />}
            {!isDaasEmpty && <BillingCardRow cards={billingCardsDaas} acquisitionType="DAAS" />}
        </div>
    );
}
===
import {
    Clock, DollarSign, Calendar, TrendingUp, BarChart3, AlertCircle,
} from 'lucide-react';
import type { BillingCards as BillingCardsType } from '../../hooks/useDashboard';
import { formatUSD, ACQUISITION_CONFIG } from '../../lib/constants';
import type { AcquisitionType } from '../../lib/types';

interface BillingCardsProps {
    billingCardsVenta: BillingCardsType;
    billingCardsDaas: BillingCardsType;
}

/** Color themes per acquisition type for the billing card rows. */
const CARD_THEMES: Record<AcquisitionType, {
    headerBg: string;
    headerText: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
    gradientFrom: string;
}> = {
    VENTA: {
        headerBg: 'bg-sky-50',
        headerText: 'text-sky-700',
        accentBg: 'bg-sky-50',
        accentText: 'text-sky-600',
        accentBorder: 'border-sky-200',
        gradientFrom: 'from-white to-sky-50/30',
    },
    DAAS: {
        headerBg: 'bg-pink-50',
        headerText: 'text-pink-700',
        accentBg: 'bg-pink-50',
        accentText: 'text-pink-600',
        accentBorder: 'border-pink-200',
        gradientFrom: 'from-white to-pink-50/30',
    },
};

const CARD_DEFINITIONS = [
    { key: 'facturadoMesAnterior' as const, label: 'Fact. Mes Anterior', Icon: Clock,        iconBg: 'bg-slate-100', iconText: 'text-slate-500', labelText: 'text-slate-400', valueText: 'text-slate-800' },
    { key: 'facturadoMesActual' as const,   label: 'Fact. Mes Actual',   Icon: DollarSign,    iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', labelText: 'text-emerald-500', valueText: 'text-emerald-700' },
    { key: 'pendFactMesActual' as const,    label: 'Pend. Fact. Mes Actual', Icon: AlertCircle, iconBg: 'bg-orange-50', iconText: 'text-orange-500', labelText: 'text-orange-500', valueText: 'text-orange-700' },
    { key: 'pendFactMesSiguiente' as const, label: 'Pend. Fact. Mes Sig.', Icon: Calendar,    iconBg: 'bg-amber-50', iconText: 'text-amber-500', labelText: 'text-amber-500', valueText: 'text-amber-700' },
    { key: 'facturadoTrimestreActual' as const, label: 'Trimestre Actual', Icon: BarChart3,   iconBg: 'bg-blue-50', iconText: 'text-blue-500', labelText: 'text-blue-500', valueText: 'text-blue-700' },
    { key: 'proyeccionTrimestreSiguiente' as const, label: 'Proy. Trim. Sig.', Icon: TrendingUp, iconBg: 'bg-violet-50', iconText: 'text-violet-500', labelText: 'text-violet-500', valueText: 'text-violet-700' },
];

function isRowEmpty(cards: BillingCardsType): boolean {
    return Object.values(cards).every(v => v === 0);
}

function BillingCardRow({ cards, acquisitionType }: { cards: BillingCardsType; acquisitionType: AcquisitionType }) {
    const theme = CARD_THEMES[acquisitionType];
    const config = ACQUISITION_CONFIG[acquisitionType];

    return (
        <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${theme.headerBg}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.headerText}`}>
                    Proyección {config.label}
                </span>
            </div>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {CARD_DEFINITIONS.map(({ key, label, Icon, iconBg, iconText, labelText, valueText }) => (
                    <div
                        key={key}
                        className={`bg-white rounded-2xl p-5 shadow-sm border ${theme.accentBorder} bg-gradient-to-br ${theme.gradientFrom}`}
                    >
                        <div className="flex items-center space-x-3 mb-3">
                            <div className={`h-10 w-10 ${iconBg} rounded-xl flex items-center justify-center ${iconText}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${labelText}`}>{label}</span>
                        </div>
                        <p className={`text-lg font-black ${valueText}`}>USD {formatUSD(cards[key])}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BillingCards({ billingCardsVenta, billingCardsDaas }: BillingCardsProps) {
    const isVentaEmpty = isRowEmpty(billingCardsVenta);
    const isDaasEmpty = isRowEmpty(billingCardsDaas);

    if (isVentaEmpty && isDaasEmpty) return null;

    return (
        <div className="space-y-5">
            {!isVentaEmpty && <BillingCardRow cards={billingCardsVenta} acquisitionType="VENTA" />}
            {!isDaasEmpty && <BillingCardRow cards={billingCardsDaas} acquisitionType="DAAS" />}
        </div>
    );
}
```

- Changed from `formatCOP` to `formatUSD` since all billing card values are now in USD
- Added `USD` prefix to displayed values

---

## Architecture Decisions

1. **TRM is frontend-only** — not persisted to backend, loaded once on mount
2. **`getSubtotalUsd` is a pure exported function** — used both in the hook (for billing cards) and in Dashboard.tsx (for the table column)
3. **Projections assumed COP** — billing projections don't have a currency field, so they're treated as COP and converted via TRM
4. **No pricing-engine changes** — conversion is a display concern, not a financial calculation

## Verification

- [ ] `tsc --noEmit` (sandbox unavailable during session — please run manually)
- [ ] Visual verification by user in browser
