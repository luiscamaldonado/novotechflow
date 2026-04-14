import { readFile, unlink } from 'fs/promises';
import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export async function validateImageMagicBytes(file: Express.Multer.File): Promise<void> {
  const { fileTypeFromBuffer } = await import('file-type');
  const buffer = await readFile(file.path);
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ALLOWED_IMAGE_MIMES.includes(type.mime)) {
    await safeUnlink(file.path);
    throw new BadRequestException('Tipo de archivo no permitido. Solo se aceptan im\u00e1genes JPEG, PNG, GIF o WebP.');
  }
}

export function sanitizeFilename(originalname: string): string {
  const sanitized = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = extname(sanitized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new BadRequestException(`Extensi\u00f3n ${ext} no permitida.`);
  }
  return sanitized;
}

// ─── CSV VALIDATION ─────────────────────────────────────────────

const ALLOWED_CSV_MIMES = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
const ALLOWED_CSV_EXTENSIONS = ['.csv'];
const CSV_MAX_SIZE_BYTES = 401 * 1024; // 401KB
const IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Dangerous CSV injection prefixes that can execute code in Excel/Sheets */
const CSV_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n', '|', '%'];

/**
 * Validates that a file is a real CSV by checking:
 * 1. File extension
 * 2. File size limit
 * 3. Content is valid UTF-8 text (not binary)
 * 4. Content parses as CSV (has rows and consistent columns)
 * Deletes the file and throws if invalid.
 */
export async function validateCsvFile(file: Express.Multer.File): Promise<void> {
  // 1. Extension check
  const ext = extname(file.originalname).toLowerCase();
  if (!ALLOWED_CSV_EXTENSIONS.includes(ext)) {
    await safeUnlink(file.path);
    throw new BadRequestException('Solo se permiten archivos .csv');
  }

  // 2. Size check
  const buffer = await readFile(file.path);
  if (buffer.length > CSV_MAX_SIZE_BYTES) {
    await safeUnlink(file.path);
    throw new BadRequestException('El archivo CSV excede el l\u00edmite de 401KB.');
  }

  // 3. Binary detection via magic bytes - reject if file-type detects a known binary format
  const { fileTypeFromBuffer } = await import('file-type');
  const detectedType = await fileTypeFromBuffer(buffer);
  // CSV/text files return undefined from fileTypeFromBuffer (no magic bytes for text).
  // If it detects a type, it means it's a binary file disguised as CSV.
  if (detectedType) {
    await safeUnlink(file.path);
    throw new BadRequestException(
      `Archivo rechazado: se detect\u00f3 formato ${detectedType.mime} disfrazado como CSV. Solo se permiten archivos CSV reales.`,
    );
  }

  // 4. UTF-8 text validation - reject if content has null bytes (binary indicator)
  if (buffer.includes(0x00)) {
    await safeUnlink(file.path);
    throw new BadRequestException('El archivo contiene datos binarios y no es un CSV v\u00e1lido.');
  }

  // 5. CSV structure validation - must have consistent delimiter-based columns
  const content = buffer.toString('utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    await safeUnlink(file.path);
    throw new BadRequestException('El archivo CSV debe tener al menos un encabezado y una fila de datos.');
  }

  // Detect delimiter: try comma, semicolon, tab
  const headerLine = lines[0];
  let delimiter = ',';
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  }

  // Header must have at least 1 delimiter (meaning at least 2 columns)
  const headerColumns = headerLine.split(delimiter).length;
  if (headerColumns < 2) {
    await safeUnlink(file.path);
    throw new BadRequestException(
      'El archivo no tiene estructura CSV v\u00e1lida. Debe tener al menos 2 columnas separadas por coma, punto y coma, o tabulador.',
    );
  }

  // Check that at least 50% of data rows have a similar column count (tolerance of \u00b11)
  const dataLines = lines.slice(1);
  const validRows = dataLines.filter(line => {
    const cols = line.split(delimiter).length;
    return Math.abs(cols - headerColumns) <= 1;
  });

  if (validRows.length < dataLines.length * 0.5) {
    await safeUnlink(file.path);
    throw new BadRequestException(
      'El archivo no tiene estructura CSV consistente. Las filas no tienen un n\u00famero uniforme de columnas.',
    );
  }
}

/**
 * Sanitizes CSV cell values to prevent CSV injection attacks.
 * Prefixes dangerous characters with a single quote to neutralize formulas.
 */
export function sanitizeCsvCellValue(value: string): string {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  // If the cell starts with a dangerous character, prefix with single quote
  if (CSV_INJECTION_PREFIXES.some(prefix => trimmed.startsWith(prefix))) {
    return "'" + trimmed;
  }
  return trimmed;
}

/**
 * Validates image file size in addition to existing magic bytes check.
 */
export async function validateImageFileSize(file: Express.Multer.File): Promise<void> {
  const stats = await readFile(file.path);
  if (stats.length > IMAGE_MAX_SIZE_BYTES) {
    await safeUnlink(file.path);
    throw new BadRequestException('La imagen excede el l\u00edmite de 2MB.');
  }
}

/**
 * Safe unlink that doesn't throw if file already deleted.
 */
async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }
}

/**
 * Extended sanitizeFilename that supports CSV extensions.
 */
export function sanitizeFilenameCsv(originalname: string): string {
  const sanitized = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = extname(sanitized).toLowerCase();
  if (!ALLOWED_CSV_EXTENSIONS.includes(ext)) {
    throw new BadRequestException(`Extensi\u00f3n ${ext} no permitida para CSV. Solo .csv`);
  }
  return sanitized;
}
