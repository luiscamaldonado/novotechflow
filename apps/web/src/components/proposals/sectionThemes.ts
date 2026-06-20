import { Monitor, Package, FileText, Server, Settings, type LucideIcon } from 'lucide-react';

// ──────────────────────────────────────────────────────────
// Configuración visual por tipo de ítem
// ──────────────────────────────────────────────────────────

interface SectionTheme {
    icon: LucideIcon;
    iconBg: string;
    titleColor: string;
    title: string;
    subtitle: string;
    borderColor: string;
    focusColor: string;
    /** Cantidad de columnas en el grid (PCS usa 4, el resto 3) */
    cols: number;
}

export const SECTION_THEMES: Record<string, SectionTheme> = {
    PCS: {
        icon: Monitor,
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-600',
        title: 'Ficha Técnica Automatizada',
        subtitle: 'Configure los parámetros del equipo basados en el catálogo maestro.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-indigo-600',
        cols: 4,
    },
    ACCESSORIES: {
        icon: Package,
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-600',
        title: 'Especificaciones de Accesorio',
        subtitle: 'Defina el tipo, marca y respaldo del accesorio u opción.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-indigo-600',
        cols: 3,
    },
    PC_SERVICES: {
        icon: FileText,
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-600',
        title: 'Configuración de Servicio',
        subtitle: 'Defina el alcance, responsable y métricas del servicio.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-indigo-600',
        cols: 3,
    },
    SOFTWARE: {
        icon: Package,
        iconBg: 'bg-purple-600',
        titleColor: 'text-purple-600',
        title: 'Configuración de Software',
        subtitle: 'Defina el tipo de licencia, fabricante y periodicidad.',
        borderColor: 'border-indigo-100',
        focusColor: 'focus:border-purple-600',
        cols: 3,
    },
    INFRASTRUCTURE: {
        icon: Server,
        iconBg: 'bg-slate-800',
        titleColor: 'text-slate-800',
        title: 'Configuración de Infraestructura',
        subtitle: 'Defina el tipo de equipo, fabricante y periodo de soporte.',
        borderColor: 'border-slate-200',
        focusColor: 'focus:border-slate-800',
        cols: 3,
    },
    INFRA_SERVICES: {
        icon: Settings,
        iconBg: 'bg-slate-900',
        titleColor: 'text-slate-900',
        title: 'Configuración de Servicios Infra.',
        subtitle: 'Defina el tipo de servicio especializado y responsable.',
        borderColor: 'border-slate-700',
        focusColor: 'focus:border-slate-900',
        cols: 3,
    },
};
