import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { GeminiClient } from '../gemini.client';
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

/** Origen que se estampa en cada campo extraído por esta estrategia. */
const SOURCE: PrefillSource = 'HP_PARTSURFER';

/** Base del proxy BFF de HP PartSurfer. */
const PARTSURFER_BASE = 'https://partsurfer.hpcloud.hp.com/bff/proxy/get';

/** Timeout de las consultas a HP (ms). */
const HP_TIMEOUT_MS = 15000;

/** Texto centinela cuando HP no devuelve resumen. */
const SIN_RESUMEN = 'Sin resumen';

/** Texto centinela cuando HP no devuelve componentes. */
const SIN_COMPONENTES = 'Sin componentes';

/** Cabeceras que emulan al navegador para el BFF de HP. */
const HP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
  Referer: 'https://partsurfer.hp.com/',
  Origin: 'https://partsurfer.hp.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

/** Respuesta del endpoint GetPart (resumen): Body es un objeto. */
interface HpPartResponse {
  Body?: { EnhancedDescription?: string };
}

/** Un componente del despiece de GetProduct. */
interface HpComponent {
  KeywordName?: string;
  EnhancedDescription?: string;
}

/** Respuesta del endpoint GetProduct (despiece): Body es un arreglo. */
interface HpProductResponse {
  Body?: HpComponent[];
}

const readString = (raw: Record<string, unknown>, key: string): string => {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : '';
};

const cleanModelo = (modelo: string): string =>
  modelo.replace(/^HP\s+/i, '').trim();

/**
 * Estrategia de prellenado a partir de un part number de HP.
 * Consulta el resumen y el despiece en el BFF de HP PartSurfer, arma un texto
 * combinado y lo envía a Gemini con las reglas de normalización.
 */
@Injectable()
export class HpPartNumberStrategy implements PrefillStrategy {
  private readonly logger = new Logger(HpPartNumberStrategy.name);

  constructor(private readonly gemini: GeminiClient) {}

  async ejecutar(data: PrefillInput): Promise<PrefillResponseDto> {
    const cleanPartNumber = data.payload?.trim().split('#')[0].toUpperCase();
    if (!cleanPartNumber) {
      throw new BadRequestException('El Part Number de HP es inv\u00e1lido.');
    }

    const { resumen, componentes } = await this.consultarHp(cleanPartNumber);
    if (resumen === SIN_RESUMEN && componentes === SIN_COMPONENTES) {
      throw new BadRequestException(
        'No se encontr\u00f3 informaci\u00f3n para este Part Number en HP PartSurfer.',
      );
    }

    const textoFinal = `RESUMEN DEL EQUIPO: ${resumen}\n\nCOMPONENTES INDIVIDUALES:\n${componentes}`;
    const prompt = this.buildPrompt(cleanPartNumber, textoFinal);

    const [raw] = await this.gemini.generarJson(
      prompt,
      SPEC_SCHEMA_OBJECT,
      0.1,
    );
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException(
        `No se pudo extraer informaci\u00f3n para '${cleanPartNumber}'.`,
      );
    }

    const producto = this.mapProducto(
      raw as Record<string, unknown>,
      cleanPartNumber,
    );
    return { productos: [producto] };
  }

  private async consultarHp(
    partNumber: string,
  ): Promise<{ resumen: string; componentes: string }> {
    const urlResumen = `${PARTSURFER_BASE}?input=/Part/GetPart/${partNumber}/country/US/usertype/EXT`;
    const urlDespiece = `${PARTSURFER_BASE}?input=/Product/GetProduct/${partNumber}/country/US/usertype/EXT`;
    const config = { timeout: HP_TIMEOUT_MS, headers: HP_HEADERS };

    try {
      const [resumenResponse, despieceResponse] = await Promise.all([
        axios.get<HpPartResponse>(urlResumen, config),
        axios.get<HpProductResponse>(urlDespiece, config),
      ]);

      const resumen =
        resumenResponse.data?.Body?.EnhancedDescription?.trim() || SIN_RESUMEN;

      const body = despieceResponse.data?.Body;
      const componentes = Array.isArray(body)
        ? body
            .map(
              (item) =>
                `${item.KeywordName ?? 'N/A'}: ${item.EnhancedDescription ?? 'N/A'}`,
            )
            .join('\n')
        : SIN_COMPONENTES;

      return { resumen, componentes };
    } catch (error) {
      const detalle = axios.isAxiosError(error)
        ? `${error.response?.status ?? ''} ${error.message}`
        : String(error);
      this.logger.error(
        `Fallo al consultar HP PartSurfer para '${partNumber}': ${detalle}`,
      );
      throw new BadRequestException(
        'No se pudo consultar HP PartSurfer en este momento.',
      );
    }
  }

  private buildPrompt(partNumber: string, textoFinal: string): string {
    return `Eres un experto en hardware de HP. Analiza los siguientes datos extra\u00eddos de la API de HP PartSurfer para el Part Number ${partNumber}. El primer bloque es el resumen general del equipo y el segundo es el despiece t\u00e9cnico. Extrae las especificaciones principales y asigna estrictamente el fabricante como 'HP'. Deduce el formato (Laptop, Desktop, etc.). Purga basura t\u00e9cnica.

${NORMALIZATION_RULES}

${textoFinal}`;
  }

  private mapProducto(
    raw: Record<string, unknown>,
    partNumber: string,
  ): ProductoPrefillDto {
    const toCampo = (value: string): CampoPrefillDto => ({
      value,
      source: SOURCE,
    });
    const numeroParteExtraido = readString(raw, 'partNumber');
    return {
      fabricante: toCampo('HP'),
      numeroParte: toCampo(numeroParteExtraido || partNumber),
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
