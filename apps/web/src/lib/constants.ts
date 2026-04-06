// ──────────────────────────────────────────────────────────
// Constantes de negocio — NovoTechFlow
// Centralizan magic numbers y strings en un solo lugar.
// ──────────────────────────────────────────────────────────

import {
    FileText, FileSignature, Building2, ListOrdered,
    Cpu, DollarSign,
    Image as ImageIcon,
} from 'lucide-react';

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
