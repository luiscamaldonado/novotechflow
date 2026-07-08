// ──────────────────────────────────────────────────────────
// Constantes de negocio — NovoTechFlow
// Centralizan magic numbers y strings en un solo lugar.
// ──────────────────────────────────────────────────────────

import {
    FileText, FileSignature, Building2, ListOrdered,
    Cpu, DollarSign,
    Image as ImageIcon,
} from 'lucide-react';
import type { ItemType, ProposalStatus, SpecFieldDef, TechnicalSpecs } from './types';

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

/** Valor de estado que mantiene visibles las garantías de PCS. */
export const ESTADO_NUEVO = 'Nuevo';
/** Opciones cerradas del campo estado en la ficha PCS. */
export const ESTADO_OPTIONS: readonly string[] = [ESTADO_NUEVO, 'Remanufacturado', 'Open Box', 'Usado'];

/** Mapas de especificaciones técnicas por categoría de ítem. */
export const SPEC_FIELDS_BY_ITEM_TYPE: Record<string, Record<string, SpecFieldDef>> = {
    PCS: {
        estado: { label: 'Estado', cat: 'ESTADO', input: 'select', options: ESTADO_OPTIONS, required: true },
        numeroParte: { label: 'N\u00famero de Parte', cat: 'NUMERO_PARTE', input: 'text' },
        formato: { label: 'Formato', cat: 'FORMATO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        modelo: { label: 'Modelo', cat: 'MODELO' },
        procesador: { label: 'Procesador', cat: 'PROCESADOR' },
        sistemaOperativo: { label: 'Sistema Operativo', cat: 'SISTEMA_OPERATIVO' },
        graficos: { label: 'Gr\u00e1ficos', cat: 'GRAFICOS' },
        memoriaRam: { label: 'Memoria RAM', cat: 'MEMORIA_RAM' },
        almacenamiento: { label: 'Almacenamiento', cat: 'ALMACENAMIENTO' },
        pantalla: { label: 'Pantalla', cat: 'PANTALLA' },
        network: { label: 'Network', cat: 'NETWORK' },
        seguridad: { label: 'Seguridad', cat: 'SEGURIDAD' },
        garantiaBateria: { label: 'Garant\u00eda Bater\u00eda', cat: 'GARANTIA_BATERIA', visibleWhen: { field: 'estado', equals: ESTADO_NUEVO } },
        garantiaEquipo: { label: 'Garant\u00eda Equipo', cat: 'GARANTIA_EQUIPO', visibleWhen: { field: 'estado', equals: ESTADO_NUEVO } },
    },
    ACCESSORIES: {
        tipo: { label: 'Tipo', cat: 'ACC_TIPO' },
        fabricante: { label: 'Fabricante', cat: 'FABRICANTE' },
        garantia: { label: 'Garant\u00eda', cat: 'ACC_GARANTIA' },
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
        garantia: { label: 'Garant\u00eda', cat: 'INFRA_GARANTIA' },
    },
    INFRA_SERVICES: {
        tipo: { label: 'Tipo de Servicio', cat: 'INFRA_SVC_TIPO' },
        responsable: { label: 'Responsable', cat: 'INFRA_SVC_RESPONSABLE' },
        unidadMedida: { label: 'Unidad de Medida', cat: 'INFRA_SVC_UM' },
    },
} as const;

/**
 * Campos de "informacion rapida" por tipo de item — el mismo subconjunto de
 * specs que la tabla de Configuracion de Item del Constructor de Propuesta
 * muestra como chips. Subconjunto acotado de SPEC_FIELDS_BY_ITEM_TYPE; se
 * anexa bajo las Notas Tecnicas en la columna DESCRIPCION del Excel.
 */
export const QUICK_SPEC_FIELDS_BY_ITEM_TYPE: Partial<Record<ItemType, (keyof TechnicalSpecs)[]>> = {
    PCS: ['fabricante', 'modelo', 'procesador', 'memoriaRam', 'almacenamiento', 'garantiaEquipo'],
    ACCESSORIES: ['tipo', 'fabricante', 'garantia'],
    PC_SERVICES: ['tipo', 'responsable', 'unidadMedida'],
    SOFTWARE: ['tipo', 'fabricante', 'unidadMedida'],
    INFRASTRUCTURE: ['tipo', 'fabricante', 'garantia'],
    INFRA_SERVICES: ['tipo', 'responsable', 'unidadMedida'],
};

// Formato (detectado por la IA) que dispara garantia de bateria automatica.
// Unico formato inequivocamente movil de FORMATO_VALUES; Workstation es ambiguo
// (escritorio o portatil) y no se incluye para evitar falsos positivos.
export const BATTERY_WARRANTY_FORMAT = 'Laptop';
// Valor por defecto de "Garantia Bateria" para equipos portatiles.
export const DEFAULT_BATTERY_WARRANTY = '1 a\u00f1o';

/**
 * Determina si un spec field es visible según su regla visibleWhen.
 * Campo controlador vacío (legacy) cuenta como visible.
 */
export function isSpecFieldVisible(def: SpecFieldDef, specs: Record<string, string | undefined>): boolean {
    if (!def.visibleWhen) return true;
    const controllerValue = specs[def.visibleWhen.field]?.trim() ?? '';
    return controllerValue === '' || controllerValue === def.visibleWhen.equals;
}

// ── Proposal Document Builder constants ──────────────────────

/** Page type display labels */
export const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    PRESENTATION: 'Carta de Presentaci\u00f3n',
    COMPANY_INFO: 'Info. General',
    INDEX: '\u00cdndice',
    TECH_SPEC: 'Propuesta T\u00e9cnica',
    ECONOMIC: 'Propuesta Econ\u00f3mica',
    TERMS: 'T\u00e9rminos y Condiciones',
    CUSTOM: 'P\u00e1gina Personalizada',
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

/** Separador para inputs de filtro multivalor del dashboard (ej: "SURA; ARGOS"). */
export const MULTI_VALUE_FILTER_SEPARATOR = ';';

/** Status badge configuration for Dashboard rows. */
export const STATUS_CONFIG: Record<ProposalStatus, { label: string; bg: string; text: string; border: string }> = {
    ELABORACION:        { label: 'Elaboraci\u00f3n',    bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
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

/** TRM historical data API endpoint (Datos Abiertos Colombia). */
export const TRM_HISTORICAL_API_URL = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

/** Month names in Spanish (1-indexed: index 0 unused). */
export const MONTH_NAMES_ES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

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

// ── Excel export constants ───────────────────────────────────

/** Maximum characters allowed in an XLSX worksheet name (format limit). */
export const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

/** Characters forbidden in XLSX worksheet names (format limit). */
export const EXCEL_SHEET_NAME_FORBIDDEN_CHARS = /[\\/?*[\]:]/g;

// ── Inactivity timeout constants ─────────────────────────────

/** Minutos de inactividad por defecto si el backend no responde. */
export const INACTIVITY_TIMEOUT_FALLBACK_MINUTES = 5;

/** Aviso al usuario antes del cierre por inactividad (ms). */
export const INACTIVITY_WARNING_BEFORE_MS = 60 * 1000;

/** Clave de localStorage para cachear el timeout entre recargas. */
export const INACTIVITY_TIMEOUT_STORAGE_KEY = 'inactivity_timeout_minutes';


// ── Economic proposal PDF pagination — alturas (height-aware) ─

/**
 * Alturas estimadas (px) para la paginacion height-aware del PDF
 * de la propuesta economica. Las filas <tr> se miden en runtime;
 * estos valores cubren los bloques fijos y el fallback de medicion.
 * Pagina carta a 96dpi: 1056px de alto, padding vertical 64px x2.
 * Valores conservadores — ajustar si se observa corte o desperdicio.
 */
export const ECONOMIC_PDF_HEIGHTS = {
    /** Alto util de la hoja: PAGE_HEIGHT (1056) - padding vertical (64x2) */
    USABLE_HEIGHT: 928,
    /** Header grande indigo de la primera hoja del escenario */
    FIRST_SLICE_HEADER_HEIGHT: 88,
    /** Header reducido de las hojas de continuacion */
    CONTINUATION_HEADER_HEIGHT: 88,
    /** Fila <thead> de la tabla de items + margen inferior de la tabla */
    TABLE_HEAD_HEIGHT: 80,
    /** Bloque de totales al pie (5 filas + total), solo ultima hoja */
    TOTALS_BLOCK_HEIGHT: 256,
    /** Altura de fallback por fila si la medicion falla */
    FALLBACK_ROW_HEIGHT: 80,
} as const;
