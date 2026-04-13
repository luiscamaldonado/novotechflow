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
    await unlink(file.path);
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
