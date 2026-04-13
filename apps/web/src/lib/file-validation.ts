const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_CSV_TYPES = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
const ALLOWED_CSV_EXTENSIONS = ['.csv'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CSV_SIZE = 401 * 1024; // 401KB

export type FileValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates an image file before upload.
 * Checks: extension, MIME type, size, and first bytes (magic bytes).
 */
export async function validateImageFile(file: File): Promise<FileValidationResult> {
  // 1. Extension
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Extensi\u00f3n "${ext}" no permitida. Solo: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}` };
  }
  // 2. MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Tipo "${file.type}" no permitido. Solo im\u00e1genes JPEG, PNG, GIF, WebP.` };
  }
  // 3. Size
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'La imagen excede el l\u00edmite de 2MB.' };
  }
  // 4. Magic bytes check
  const header = await readFileHeader(file, 12);
  if (!isValidImageHeader(header)) {
    return { valid: false, error: 'El archivo no es una imagen v\u00e1lida. Puede tener extensi\u00f3n cambiada.' };
  }
  return { valid: true };
}

/**
 * Validates a CSV file before upload.
 * Checks: extension, size, and that it's text (not binary).
 */
export async function validateCsvFile(file: File): Promise<FileValidationResult> {
  // 1. Extension
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_CSV_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Solo se permiten archivos .csv (recibido: "${ext}")` };
  }
  // 2. MIME type — browsers may report empty type for CSV
  if (!ALLOWED_CSV_TYPES.includes(file.type) && file.type !== '') {
    return { valid: false, error: `Tipo de archivo "${file.type}" no permitido para CSV.` };
  }
  // 3. Size
  if (file.size > MAX_CSV_SIZE) {
    return { valid: false, error: 'El archivo CSV excede el l\u00edmite de 401KB.' };
  }
  // 4. Binary content check (read first 8KB)
  const header = await readFileHeader(file, 8192);
  if (containsNullBytes(header)) {
    return { valid: false, error: 'El archivo contiene datos binarios y no es un CSV v\u00e1lido.' };
  }
  return { valid: true };
}

/** Read first N bytes of a file */
function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsArrayBuffer(file.slice(0, bytes));
  });
}

/** Check image magic bytes (JPEG, PNG, GIF, WebP) */
function isValidImageHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
  return false;
}

/** Check for null bytes (binary content indicator) */
function containsNullBytes(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x00) return true;
  }
  return false;
}

/** Accept strings for <input type="file"> */
export const ACCEPT_IMAGES = ALLOWED_IMAGE_TYPES.join(',');
export const ACCEPT_CSV = '.csv';
