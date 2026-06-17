import { api } from './api';
import type { TechnicalSpecs } from './types';

/** Fuentes de extracción soportadas por el endpoint de prellenado. */
export type PrefillTipoInput = 'TEXTO_PLANO' | 'PART_NUMBER' | 'HP_PART_NUMBER' | 'EXCEL' | 'PDF';

/** Origen de un campo extraído (incluye MANUAL para ediciones del usuario). */
export type PrefillSource =
    | 'EXCEL'
    | 'TEXTO_PLANO'
    | 'PART_NUMBER'
    | 'PSREF'
    | 'SMARTFIND'
    | 'HP_PARTSURFER'
    | 'PDF'
    | 'MANUAL';

/** Un campo extraído: su valor y de dónde salió. */
export interface CampoPrefill {
    value: string;
    source: PrefillSource;
}

/** Especificaciones de un equipo extraídas de una fuente (14 campos con lineage). */
export interface ProductoPrefill {
    fabricante: CampoPrefill;
    numeroParte: CampoPrefill;
    formato: CampoPrefill;
    modelo: CampoPrefill;
    procesador: CampoPrefill;
    sistemaOperativo: CampoPrefill;
    graficos: CampoPrefill;
    memoriaRam: CampoPrefill;
    almacenamiento: CampoPrefill;
    pantalla: CampoPrefill;
    network: CampoPrefill;
    seguridad: CampoPrefill;
    garantiaEquipo: CampoPrefill;
    garantiaBateria: CampoPrefill;
}

/** Respuesta del endpoint de extracción. */
export interface PrefillResponse {
    productos: ProductoPrefill[];
}

/** Las 13 keys de spec de un equipo PC que el prellenado puede poblar (sin 'estado', que elige el usuario). */
const PREFILL_SPEC_KEYS: ReadonlyArray<keyof ProductoPrefill> = [
    'fabricante',
    'numeroParte',
    'formato',
    'modelo',
    'procesador',
    'sistemaOperativo',
    'graficos',
    'memoriaRam',
    'almacenamiento',
    'pantalla',
    'network',
    'seguridad',
    'garantiaEquipo',
    'garantiaBateria',
];

/** Placeholders que Gemini devuelve cuando no hay dato; se tratan como vacío al colapsar. */
const PLACEHOLDER_VALUES: ReadonlyArray<string> = [
    'no especificada',
    'no especificado',
    'no aplica',
    'no incluida',
    'no incluido',
    'n/a',
];

/** True si el valor es un placeholder o está vacío (no debe escribirse en el spec). */
const esVacioOPlaceholder = (value: string): boolean => {
    const limpio = value.trim().toLowerCase();
    return limpio === '' || PLACEHOLDER_VALUES.includes(limpio);
};

/**
 * Envía una entrada al backend y devuelve los equipos detectados.
 * Para texto/part number se usa payload; para Excel/PDF se adjunta file.
 */
export async function extraerSpecs(
    tipoInput: PrefillTipoInput,
    input: { payload?: string; file?: File },
): Promise<ProductoPrefill[]> {
    const formData = new FormData();
    formData.append('tipoInput', tipoInput);
    if (input.payload !== undefined) {
        formData.append('payload', input.payload);
    }
    if (input.file) {
        formData.append('file', input.file);
    }
    const { data } = await api.post<PrefillResponse>('/spec-prefill/extract', formData);
    return data.productos;
}

/**
 * Colapsa un equipo extraído ({ value, source }) a un TechnicalSpecs plano.
 * Toma solo el valor de cada campo y descarta placeholders/vacíos.
 * No incluye 'estado' (lo define el usuario en el formulario).
 */
export function colapsarProducto(producto: ProductoPrefill): TechnicalSpecs {
    const specs: TechnicalSpecs = {};
    for (const key of PREFILL_SPEC_KEYS) {
        const value = producto[key]?.value ?? '';
        if (!esVacioOPlaceholder(value)) {
            specs[key] = value.trim();
        }
    }
    return specs;
}
