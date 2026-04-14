import { readFile, unlink } from 'fs/promises';
import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export async function validateImageMagicBytes(file: Express.Multer.File): Promise<void> {
  const buffer = await readFile(file.path);
  const mime = detectMimeFromMagicBytes(buffer);
  if (!mime || !ALLOWED_IMAGE_MIMES.includes(mime)) {
    await safeUnlink(file.path);
    throw new BadRequestException(
      'Tipo de archivo no permitido. Solo se aceptan im\u00e1genes JPEG, PNG, GIF o WebP.',
    );
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

/**
 * List of patterns that indicate CSV injection attempts.
 * These should NEVER appear in legitimate CSV data for this application.
 */
const CSV_INJECTION_PATTERNS: RegExp[] = [
  /^=/,          // Formula: =CMD, =HYPERLINK, =SUM, etc.
  /^\+[A-Za-z]/, // Formula: +CMD, +SYSTEM (but allow +57 phone numbers)
  /^@/,          // Formula: @SUM, @IF
  /^\|/,         // Pipe execution
  /^!/,          // Shell execution
  /^%/,          // Macro execution
  /\t/,          // Tab injection
  /\r/,          // Carriage return injection (mid-cell)
  /\n/,          // Newline injection (mid-cell)
];

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

  // 3. Binary detection via magic bytes - reject if detected as a known binary format
  const detectedMime = detectMimeFromMagicBytes(buffer as Buffer);
  if (detectedMime) {
    await safeUnlink(file.path);
    throw new BadRequestException(
      `Archivo rechazado: se detect\u00f3 formato ${detectedMime} disfrazado como CSV. Solo se permiten archivos CSV reales.`,
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
 * Validates that a CSV cell value does not contain injection patterns.
 * Throws BadRequestException if a dangerous pattern is detected.
 * This REJECTS the entire import rather than silently sanitizing,
 * because legitimate CSV data for this application never contains formulas.
 */
export function validateCsvCellValue(value: string): void {
  if (!value || typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed.length === 0) return;

  for (const pattern of CSV_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new BadRequestException(
        `Valor rechazado por seguridad: "${trimmed.substring(0, 30)}..." contiene caracteres no permitidos. ` +
        'Los archivos CSV solo deben contener texto plano (letras, n\u00fameros, puntos, guiones).',
      );
    }
  }
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
 * Detects file type by reading magic bytes from the buffer header.
 * Returns the MIME type if recognized, or null if unknown/text.
 * This replaces the 'file-type' npm package which is ESM-only
 * and incompatible with NestJS CommonJS compilation.
 */
function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }
  // WebP: 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  // ZIP/DOCX/XLSX: 50 4B 03 04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'application/zip';
  }
  // EXE/DLL (MZ): 4D 5A
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return 'application/x-msdownload';
  }
  // ELF binary: 7F 45 4C 46
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return 'application/x-elf';
  }

  return null; // Unknown or text-based format
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
