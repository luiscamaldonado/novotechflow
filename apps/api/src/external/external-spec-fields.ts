/**
 * Campos derivados de technicalSpecs para el contrato de la API externa.
 * Replica la logica de display de apps/web (buildQuickDescription, ITEM_TYPE_LABELS)
 * adaptada al tipado Record<string, unknown> de technicalSpecs en el backend.
 * DEUDA: duplicado de apps/web; extraer a paquete compartido (follow-up, ver ADR).
 */

const ITEM_TYPE_LABELS: Record<string, string> = {
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

export function pickSpecString(
  specs: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!specs) return null;
  const value = specs[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildQuickDescription(
  itemType: string,
  specs: Record<string, unknown> | null | undefined,
): string {
  if (!specs) return '';
  const pick = (...keys: string[]): string =>
    keys
      .map((key) => (typeof specs[key] === 'string' ? (specs[key] as string).trim() : ''))
      .filter(Boolean)
      .join(' | ');

  switch (itemType) {
    case 'PCS':
      return pick('fabricante', 'modelo', 'procesador', 'memoriaRam', 'almacenamiento', 'garantiaEquipo');
    case 'ACCESSORIES':
      return pick('tipo', 'fabricante', 'garantia');
    case 'SOFTWARE':
      return pick('tipo', 'fabricante');
    case 'PC_SERVICES':
      return pick('tipo', 'responsable');
    case 'INFRASTRUCTURE':
      return pick('tipo', 'fabricante', 'garantia');
    case 'INFRA_SERVICES':
      return pick('tipo', 'responsable', 'unidadMedida');
    default:
      return '';
  }
}
