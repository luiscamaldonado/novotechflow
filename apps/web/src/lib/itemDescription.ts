/**
 * Construye la descripción rápida a partir de los campos de specs según el tipo de ítem.
 * PCS: fabricante, modelo, procesador, memoria, disco, garantía
 * ACCESSORIES: tipo, fabricante, garantía
 * SOFTWARE: tipo, fabricante
 * PC_SERVICES: tipo de servicio, responsable
 * INFRASTRUCTURE: tipo de infraestructura, fabricante, garantía
 * INFRA_SERVICES: tipo de servicio, responsable, unidad de medida
 */
export function buildQuickDescription(itemType: string, specs?: Record<string, string>): string {
    if (!specs) return '';
    const pick = (...keys: string[]) =>
        keys.map(k => specs[k]?.trim()).filter(Boolean).join(' | ');

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

/**
 * Determina la unidad de medida según el tipo de ítem.
 * PCS, ACCESSORIES, INFRASTRUCTURE → "Unidad"
 * SOFTWARE, PC_SERVICES, INFRA_SERVICES → usa technicalSpecs.unidadMedida o fallback "Unidad"
 */
export function getUnitOfMeasure(itemType: string, technicalSpecs?: Record<string, string>): string {
    switch (itemType) {
        case 'SOFTWARE':
        case 'PC_SERVICES':
        case 'INFRA_SERVICES':
            return technicalSpecs?.unidadMedida?.trim() || 'Unidad';
        default:
            return 'Unidad';
    }
}
