import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Workbook } from 'exceljs';
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
const SOURCE: PrefillSource = 'EXCEL';

/** Tamaño máximo del archivo Excel aceptado (5 MB). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** MIME que el detector de magic bytes devuelve para un .xlsx (contenedor ZIP). */
const XLSX_MAGIC_MIME = 'application/zip';

const PROMPT_HEADER = `Analiza los datos de este archivo Excel (convertido a texto CSV) y extrae TODOS los equipos.
REGLAS OBLIGATORIAS:
1. MAPEADO COMPLETO: Es obligatorio que busques y llenes TODOS los campos del esquema (pantalla, sistemaOperativo, graficos, network, seguridad, garantias, etc.). \u00a1No dejes campos en blanco si el dato existe en la tabla!
2. Purgar basura t\u00e9cnica (hilos, latencias, P/E cores, protocolos Wi-Fi).
3. Procesador: Solo familia, modelo y n\u00facleos.
4. RAM/Disco: Formato limpio (Ej: 16GB RAM DDR5).
5. Deduce el fabricante (Lenovo, HP, Dell, etc.) y el formato de cada equipo.
6. REGLA DELL (CTO/Cotizaciones): Si se lista un Sistema Base seguido de m\u00faltiples componentes con SKUs individuales, NO extraigas cada componente como un \u00edtem separado. AGRUPA todos los componentes que le sigan al Sistema Base en UN SOLO objeto JSON en el equipo principal e ignora los SKUs secundarios de software o cables.`;

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

/** Convierte el valor de una celda de exceljs a texto plano. */
const cellToText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    typeof value === 'object' &&
    'text' in (value as Record<string, unknown>)
  ) {
    const text = (value as Record<string, unknown>).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
};

/**
 * Estrategia de prellenado a partir de un archivo Excel.
 * Valida el buffer (tamaño y magic bytes), vuelca cada hoja a texto tipo CSV
 * y envía el resultado a Gemini con las reglas de normalización.
 */
@Injectable()
export class ExcelStrategy implements PrefillStrategy {
  constructor(private readonly gemini: GeminiClient) {}

  async ejecutar(data: PrefillInput): Promise<PrefillResponseDto> {
    const buffer = data.file?.buffer;
    if (!buffer) {
      throw new BadRequestException('El archivo Excel es requerido.');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException(
        'El archivo Excel supera el l\u00edmite de 5MB.',
      );
    }
    if (detectMimeFromMagicBytes(buffer) !== XLSX_MAGIC_MIME) {
      throw new BadRequestException(
        'El archivo no es un Excel (.xlsx) v\u00e1lido.',
      );
    }

    const excelText = await this.extraerTexto(buffer);
    if (excelText.trim().length === 0) {
      throw new BadRequestException('El archivo Excel est\u00e1 vac\u00edo.');
    }

    const prompt = `${PROMPT_HEADER}\n\n${NORMALIZATION_RULES}\n\nDatos Excel:\n"${excelText}"`;
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
      throw new BadRequestException(
        'No se detectaron equipos en el archivo Excel.',
      );
    }

    return { productos };
  }

  private async extraerTexto(buffer: Buffer): Promise<string> {
    const workbook = new Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );

    const partes: string[] = [];
    workbook.eachSheet((sheet) => {
      const filas: string[] = [];
      sheet.eachRow((row) => {
        const valores = Array.isArray(row.values) ? row.values.slice(1) : [];
        const linea = valores.map(cellToText).join(',');
        if (linea.replace(/,/g, '').trim() !== '') {
          filas.push(linea);
        }
      });
      if (filas.length > 0) {
        partes.push(`\n--- Hoja: ${sheet.name} ---\n${filas.join('\n')}`);
      }
    });

    return partes.join('');
  }
}
