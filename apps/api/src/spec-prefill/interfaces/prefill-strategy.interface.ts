import type { PrefillResponseDto } from '../dto/prefill-response.dto';

/**
 * Tipos de estrategia de prellenado de especificaciones.
 * Cada valor identifica una fuente de extracción distinta.
 */
export enum PrefillStrategyType {
  EXCEL = 'EXCEL',
  PART_NUMBER = 'PART_NUMBER',
  HP_PART_NUMBER = 'HP_PART_NUMBER',
  TEXTO_PLANO = 'TEXTO_PLANO',
  PDF = 'PDF',
}

/**
 * Datos de entrada que recibe una estrategia.
 * payload se usa en estrategias de texto/part number; file en Excel/PDF.
 */
export interface PrefillInput {
  payload?: string;
  file?: Express.Multer.File;
}

/**
 * Contrato común de toda estrategia de prellenado.
 */
export interface PrefillStrategy {
  ejecutar(data: PrefillInput): Promise<PrefillResponseDto>;
}
