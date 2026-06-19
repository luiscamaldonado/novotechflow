import {
  Injectable,
  Logger,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { GeminiClient } from '../gemini.client';
import { detectMimeFromMagicBytes } from '../../common/upload-validation';
import { NORMALIZATION_RULES } from '../constants/normalization-rules.constant';
import { SPEC_SCHEMA_ARRAY } from '../constants/spec-schema.constant';
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
const SOURCE: PrefillSource = 'PDF';

/** Tamaño máximo del archivo PDF aceptado (10 MB). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** MIME que el detector de magic bytes devuelve para un PDF. */
const PDF_MAGIC_MIME = 'application/pdf';

/** Longitud mínima del texto extraído para intentar una extracción. */
const MIN_TEXT_LENGTH = 15;

const PROMPT_HEADER = `Eres un experto en extracci\u00f3n de datos estructurados de hardware. Analiza el siguiente texto de una cotizaci\u00f3n y extrae los componentes.

REGLAS GENERALES:
- Ignora texto irrelevante, saludos, direcciones y basura t\u00e9cnica profunda.
- Identifica el formato (Laptop, Desktop, Workstation, Micro, Tower, Monitor, Accesorio, etc.).
- Identifica el fabricante (Lenovo, HP, Dell, etc.).`;

const PROMPT_FOOTER = `REGLA DE AGRUPACI\u00d3N (SISTEMAS CTO/MODULARES):
Si detectas un "Sistema Base" o equipo principal seguido de una lista de componentes individuales (SKUs de procesadores, discos, garant\u00edas, licencias), DEBES fusionarlos todos. El nombre de ese Sistema Base ser\u00e1 el 'modelo'. No extraigas los componentes secundarios como equipos separados.

INSTRUCCIONES DE MAPEO (Busca estos conceptos en el bloque del equipo):
- procesador: Busca Intel, AMD, Ryzen, Core, Ultra, etc.
- memoriaRam: Busca capacidades en GB y tecnolog\u00edas (DDR4, DDR5, MT/s).
- almacenamiento: Busca SSD, HDD, NVMe, M.2 o TB/GB de disco.
- graficos: Busca NVIDIA, RTX, Radeon. Si no menciona tarjeta dedicada, pon "Integrados".
- sistemaOperativo: Busca Windows, Linux, Ubuntu, DOS.
- garantiaEquipo: Busca a\u00f1os de servicio, Care Pack, ProSupport, Basic Onsite.
- network: Busca Wi-Fi, Ethernet, Intel AX, Bluetooth.
- seguridad: Busca TPM, vPro, Fingerprint.
- partNumber: Extrae el SKU o c\u00f3digo principal asociado al equipo base (suele ser alfanum\u00e9rico corto).`;

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
 * Estrategia de prellenado a partir de un archivo PDF (cotizaciones).
 * Valida el buffer (tamaño y magic bytes), extrae el texto con pdf-parse
 * y lo envía a Gemini con las reglas de normalización.
 */
@Injectable()
export class PdfStrategy implements PrefillStrategy {
  private readonly logger = new Logger(PdfStrategy.name);

  constructor(private readonly gemini: GeminiClient) {}

  async ejecutar(data: PrefillInput): Promise<PrefillResponseDto> {
    const buffer = data.file?.buffer;
    if (!buffer) {
      throw new BadRequestException('El archivo PDF es requerido.');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo PDF supera el l\u00edmite de 10MB.',
      );
    }
    if (detectMimeFromMagicBytes(buffer) !== PDF_MAGIC_MIME) {
      throw new BadRequestException('El archivo no es un PDF v\u00e1lido.');
    }

    const texto = await this.extraerTexto(buffer);
    if (texto.length === 0) {
      throw new BadRequestException(
        'El PDF no contiene texto extra\u00edble (podr\u00eda ser un PDF escaneado).',
      );
    }
    if (texto.length < MIN_TEXT_LENGTH) {
      throw new BadRequestException(
        'El texto extra\u00eddo del PDF es muy corto para extraer especificaciones.',
      );
    }

    const prompt = `${PROMPT_HEADER}\n\n${NORMALIZATION_RULES}\n\n${PROMPT_FOOTER}\n\nTexto de la cotizaci\u00f3n:\n"${texto}"`;
    const rawProducts = await this.gemini.generarJson(
      prompt,
      SPEC_SCHEMA_ARRAY,
    );

    const productos = rawProducts
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
      .map(mapProducto);

    if (productos.length === 0) {
      throw new BadRequestException('No se detectaron equipos en el PDF.');
    }

    return { productos };
  }

  private async extraerTexto(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const texto = typeof result.text === 'string' ? result.text : '';
      return texto.trim();
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fallo al extraer texto del PDF: ${detalle}`);
      throw new BadRequestException(
        'No se pudo extraer el texto del archivo PDF.',
      );
    }
  }
}
