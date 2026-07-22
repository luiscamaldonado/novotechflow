/**
 * Logica de display de items compartida entre apps/web y apps/api.
 * Fuente unica de: etiquetas de categoria, descripcion rapida (pantalla/PDF/API),
 * campos de informacion rapida (Excel) y lectura segura de technicalSpecs.
 * Origen: extraccion de apps/web/src/lib/itemDescription.ts y constants.ts
 * + copia de apps/api/src/external/external-spec-fields.ts (ADR-059).
 */

export const ITEM_TYPE_LABELS: Record<string, string> = {
  PCS: 'PCs',
  ACCESSORIES: 'Accesorios y Opciones',
  PC_SERVICES: 'Servicios PCs',
  SOFTWARE: 'Software',
  INFRASTRUCTURE: 'Infraestructura',
  INFRA_SERVICES: 'Servicios de Infraestructura',
};

export function resolveItemTypeLabel(itemType: string): string {
  return ITEM_TYPE_LABELS[itemType] ?? itemType;
}

export type SpecsInput = Record<string, unknown> | null | undefined;

export function pickSpecString(specs: SpecsInput, key: string): string | null {
  if (!specs) return null;
  const value = specs[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Campos que componen la descripcion rapida por categoria (pantalla, PDF y API externa).
 */
export const QUICK_DESCRIPTION_FIELDS_BY_ITEM_TYPE: Record<string, readonly string[]> = {
  PCS: ['formato', 'fabricante', 'modelo', 'procesador', 'memoriaRam', 'almacenamiento', 'garantiaBateria', 'garantiaEquipo'],
  ACCESSORIES: ['tipo', 'fabricante', 'modelo', 'garantia'],
  SOFTWARE: ['tipo', 'fabricante', 'modelo'],
  PC_SERVICES: ['tipo', 'responsable', 'modelo'],
  INFRASTRUCTURE: ['tipo', 'fabricante', 'modelo', 'garantia'],
  INFRA_SERVICES: ['tipo', 'responsable', 'modelo'],
};

/**
 * Campos de la informacion rapida del Excel: la misma definicion de pantalla
 * mas unidadMedida en las categorias que la manejan.
 */
export const QUICK_SPEC_FIELDS_BY_ITEM_TYPE: Record<string, readonly string[]> = {
  PCS: ['formato', 'fabricante', 'modelo', 'procesador', 'memoriaRam', 'almacenamiento', 'garantiaBateria', 'garantiaEquipo'],
  ACCESSORIES: ['tipo', 'fabricante', 'modelo', 'garantia'],
  SOFTWARE: ['tipo', 'fabricante', 'modelo', 'unidadMedida'],
  PC_SERVICES: ['tipo', 'responsable', 'modelo', 'unidadMedida'],
  INFRASTRUCTURE: ['tipo', 'fabricante', 'modelo', 'garantia'],
  INFRA_SERVICES: ['tipo', 'responsable', 'modelo', 'unidadMedida'],
};

function joinSpecFields(fields: readonly string[] | undefined, specs: SpecsInput, separator = ' | '): string {
  if (!specs || !fields) return '';
  return fields
    .map((key) => (typeof specs[key] === 'string' ? (specs[key] as string).trim() : ''))
    .filter(Boolean)
    .join(separator);
}

/**
 * Descripcion rapida del item (pantalla, PDF y API externa).
 */
export function buildQuickDescription(itemType: string, specs?: SpecsInput): string {
  return joinSpecFields(QUICK_DESCRIPTION_FIELDS_BY_ITEM_TYPE[itemType], specs);
}

/**
 * Informacion rapida para el Excel (incluye unidadMedida donde aplica).
 * Separador por defecto: punto medio, el formato historico del Excel.
 */
export function buildExcelQuickSpecs(itemType: string, specs?: SpecsInput, separator = ' \u00b7 '): string {
  return joinSpecFields(QUICK_SPEC_FIELDS_BY_ITEM_TYPE[itemType], specs, separator);
}

/**
 * Unidad de medida segun el tipo de item.
 */
export function getUnitOfMeasure(itemType: string, technicalSpecs?: SpecsInput): string {
  switch (itemType) {
    case 'SOFTWARE':
    case 'PC_SERVICES':
    case 'INFRA_SERVICES':
      return pickSpecString(technicalSpecs, 'unidadMedida') ?? 'Unidad';
    default:
      return 'Unidad';
  }
}
