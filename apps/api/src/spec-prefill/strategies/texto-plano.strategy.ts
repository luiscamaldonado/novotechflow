import { Injectable, BadRequestException } from '@nestjs/common';
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
const SOURCE: PrefillSource = 'TEXTO_PLANO';

/** Longitud mínima del texto de entrada para intentar una extracción. */
const MIN_TEXT_LENGTH = 15;

const PROMPT_HEADER = `Extrae las especificaciones de UN \u00danico equipo a partir del siguiente texto. REGLAS CR\u00cdTICAS:
- El texto describe UN SOLO equipo, aunque venga en m\u00faltiples l\u00edneas, p\u00e1rrafos o con muchas frases separadas por puntos. CONSOLIDA toda la informaci\u00f3n dispersa en UN \u00danico objeto JSON. NUNCA generes m\u00e1s de un equipo.
- Si una especificaci\u00f3n aparece fragmentada o repetida en distintas partes del texto, re\u00fanela en el campo que corresponde.
- Purgar basura t\u00e9cnica (hilos, latencias, P/E cores, frecuencias, cach\u00e9, NPU TOPS, peso, adaptador).
- Procesador: Solo marca, familia y modelo (ej. 'Intel Core Ultra 7 256V'), sin n\u00facleos ni frecuencias.
- Deduce el fabricante (Lenovo, HP, Dell, etc.) y el formato del equipo.

REFINAMIENTO DE PART NUMBER (DELL CODES):
Si hay un c\u00f3digo alfanum\u00e9rico junto al nombre de la marca (ej. '6750370', 'PP70R', '9KP97'), \u00fasalo como 'partNumber'. Si un c\u00f3digo viene con un numeral y caracteres posteriores (ej. 'BH8M9LT#ABM'), ignora el numeral y todo lo que le siga, dejando solo el c\u00f3digo base ('BH8M9LT').

ASEGURAR EXTRACTOS LIMPIOS:
- 'modelo': Extrae el nombre comercial completo (ej. 'Dell Pro 15 Essential', 'EliteBook 8 G1i').`;

const PROMPT_FOOTER = `- 'almacenamiento': Identifica la capacidad y tipo (ej. '512GB SSD').
- 'pantalla': Extrae tama\u00f1o y resoluci\u00f3n (ej. '14" WUXGA 1920x1200'). Busca t\u00e9rminos como "Pantalla", "Diagonal", "Display".
- 'network': Extrae detalles de conectividad (ej. 'Wi-Fi 7, Bluetooth 5.4'). Busca t\u00e9rminos como "Conectividad", "WLAN", "Wi-Fi", "Red".`;

const readString = (raw: Record<string, unknown>, key: string): string => {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : '';
};

const cleanModelo = (modelo: string): string =>
  modelo.replace(/^(Dell|HP|Lenovo)\s+/i, '').trim();

const toCampo = (value: string): CampoPrefillDto => ({ value, source: SOURCE });

const mapProducto = (raw: Record<string, unknown>): ProductoPrefillDto => ({
  fabricante: toCampo(readString(raw, 'fabricante')),
  numeroParte: toCampo(readString(raw, 'partNumber')),
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
});

/**
 * Estrategia de prellenado a partir de texto plano (párrafos o descripciones).
 * Consolida todo el texto en un único equipo y lo envía a Gemini con las
 * reglas de normalización.
 */
@Injectable()
export class TextoPlanoStrategy implements PrefillStrategy {
  constructor(private readonly gemini: GeminiClient) {}

  async ejecutar(data: PrefillInput): Promise<PrefillResponseDto> {
    const texto = data.payload?.trim();
    if (!texto || texto.length < MIN_TEXT_LENGTH) {
      throw new BadRequestException(
        'El texto proporcionado es muy corto para extraer especificaciones.',
      );
    }

    const prompt = `${PROMPT_HEADER}\n${NORMALIZATION_RULES}\n${PROMPT_FOOTER}\n\nTexto:\n"${texto}"`;
    const rawProducts = await this.gemini.generarJson(
      prompt,
      SPEC_SCHEMA_OBJECT,
    );

    const primero = rawProducts.find(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
    if (!primero) {
      throw new BadRequestException(
        'No se detectaron especificaciones en el texto proporcionado.',
      );
    }

    return { productos: [mapProducto(primero)] };
  }
}
