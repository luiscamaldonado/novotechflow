import { Injectable, BadRequestException } from '@nestjs/common';
import { GeminiClient } from '../gemini.client';
import { LenovoPsrefService } from '../services/lenovo-psref.service';
import { NORMALIZATION_RULES } from '../constants/normalization-rules.constant';
import { SPEC_SCHEMA_OBJECT } from '../constants/spec-schema.constant';
import type {
  PrefillStrategy,
  PrefillInput,
} from '../interfaces/prefill-strategy.interface';
import type {
  PrefillResponseDto,
  ProductoPrefillDto,
  CampoPrefillDto,
  PrefillSource,
} from '../dto/prefill-response.dto';

/** Longitud mínima de un part number válido. */
const MIN_PART_NUMBER_LENGTH = 5;

/** Un código de 5 a 7 alfanuméricos se trata como código Dell (sin scraping). */
const DELL_CODE_PATTERN = /^[A-Z0-9]{5,7}$/i;

const buildPromptDell = (partNumber: string): string =>
  `El usuario ha proporcionado un c\u00f3digo de Dell (Part Number o Service Tag): ${partNumber}.
REGLAS:
- Act\u00faa como un experto en hardware de Dell. Intenta deducir las especificaciones principales (procesador, RAM, disco, pantalla) asociadas a este c\u00f3digo bas\u00e1ndote en tu conocimiento.
- El 'fabricante' debe ser estrictamente "Dell".
- Purgar basura t\u00e9cnica (hilos, latencias, P/E cores).
- Procesador: Solo familia, modelo y n\u00facleos.
- RAM/Disco: Formato limpio (Ej: 16GB RAM DDR5).
${NORMALIZATION_RULES}`;

const buildPromptJson = (datos: string): string =>
  `Analiza este JSON extra\u00eddo del fabricante y extrae el equipo. REGLAS:
- Purgar basura t\u00e9cnica (hilos, latencias, P/E cores, protocolos Wi-Fi).
- Procesador: Solo familia, modelo y n\u00facleos.
- RAM/Disco: Formato limpio (Ej: 16GB RAM DDR5).
- Deduce el fabricante y el formato del equipo.
${NORMALIZATION_RULES}
JSON Original:\n${datos}`;

const cleanModelo = (modelo: string): string =>
  modelo.replace(/^(Dell|HP|Lenovo)\s+/i, '').trim();

const readString = (raw: Record<string, unknown>, key: string): string => {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : '';
};

interface PlanExtraccion {
  prompt: string;
  fabricante: string;
  source: PrefillSource;
}

/**
 * Estrategia de prellenado a partir de un part number.
 * Códigos Dell: deduce specs con Gemini sin scraping.
 * Códigos Lenovo: obtiene datos crudos vía LenovoPsrefService y los normaliza.
 */
@Injectable()
export class PartNumberStrategy implements PrefillStrategy {
  constructor(
    private readonly gemini: GeminiClient,
    private readonly lenovoPsref: LenovoPsrefService,
  ) {}

  async ejecutar(data: PrefillInput): Promise<PrefillResponseDto> {
    const partNumber = data.payload?.trim().toUpperCase();
    if (!partNumber || partNumber.length < MIN_PART_NUMBER_LENGTH) {
      throw new BadRequestException(
        'El Part Number es inv\u00e1lido o demasiado corto.',
      );
    }

    const plan = DELL_CODE_PATTERN.test(partNumber)
      ? this.planDell(partNumber)
      : await this.planLenovo(partNumber);

    const [raw] = await this.gemini.generarJson(
      plan.prompt,
      SPEC_SCHEMA_OBJECT,
    );
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException(
        `No se pudo extraer informaci\u00f3n para '${partNumber}'.`,
      );
    }

    const producto = this.mapProducto(
      raw as Record<string, unknown>,
      partNumber,
      plan,
    );
    return { productos: [producto] };
  }

  private planDell(partNumber: string): PlanExtraccion {
    return {
      prompt: buildPromptDell(partNumber),
      fabricante: 'Dell',
      source: 'PART_NUMBER',
    };
  }

  private async planLenovo(partNumber: string): Promise<PlanExtraccion> {
    const { datos, fuente } = await this.lenovoPsref.obtenerDatos(partNumber);
    return {
      prompt: buildPromptJson(datos),
      fabricante: 'Lenovo',
      source: fuente,
    };
  }

  private mapProducto(
    raw: Record<string, unknown>,
    partNumber: string,
    plan: PlanExtraccion,
  ): ProductoPrefillDto {
    const toCampo = (value: string): CampoPrefillDto => ({
      value,
      source: plan.source,
    });
    return {
      fabricante: toCampo(plan.fabricante),
      numeroParte: toCampo(partNumber),
      formato: toCampo(readString(raw, 'formato')),
      modelo: toCampo(cleanModelo(readString(raw, 'modelo'))),
      procesador: toCampo(readString(raw, 'procesador')),
      sistemaOperativo: toCampo(readString(raw, 'sistemaOperativo')),
      graficos: toCampo(readString(raw, 'graficos')),
      memoriaRam: toCampo(readString(raw, 'memoriaRam')),
      almacenamiento: toCampo(readString(raw, 'almacenamiento')),
      pantalla: toCampo(readString(raw, 'pantalla')),
      network: toCampo(readString(raw, 'network')),
      seguridad: toCampo(readString(raw, 'seguridad')),
      garantiaEquipo: toCampo(readString(raw, 'garantiaEquipo')),
      garantiaBateria: toCampo(readString(raw, 'garantiaBateria')),
    };
  }
}
