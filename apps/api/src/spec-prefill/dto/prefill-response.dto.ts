/**
 * Origen de un campo extraído. El backend nunca produce 'MANUAL';
 * ese valor lo asigna el frontend cuando el usuario edita el campo.
 */
export type PrefillSource =
    | 'EXCEL'
    | 'TEXTO_PLANO'
    | 'PART_NUMBER'
    | 'PSREF'
    | 'SMARTFIND'
    | 'HP_PARTSURFER'
    | 'PDF';

/**
 * Un campo de especificación extraído, con su valor y su origen.
 */
export class CampoPrefillDto {
    value: string;
    source: PrefillSource;
}

/**
 * Especificaciones de un equipo extraídas de una fuente.
 * Las claves coinciden con TechnicalSpecs del frontend (categoría PCS),
 * salvo 'estado', que lo elige el usuario.
 */
export class ProductoPrefillDto {
    fabricante: CampoPrefillDto;
    numeroParte: CampoPrefillDto;
    formato: CampoPrefillDto;
    modelo: CampoPrefillDto;
    procesador: CampoPrefillDto;
    sistemaOperativo: CampoPrefillDto;
    graficos: CampoPrefillDto;
    memoriaRam: CampoPrefillDto;
    almacenamiento: CampoPrefillDto;
    pantalla: CampoPrefillDto;
    network: CampoPrefillDto;
    seguridad: CampoPrefillDto;
    garantiaEquipo: CampoPrefillDto;
    garantiaBateria: CampoPrefillDto;
}

/**
 * Respuesta del endpoint de extracción: lista de equipos detectados.
 */
export class PrefillResponseDto {
    productos: ProductoPrefillDto[];
}
