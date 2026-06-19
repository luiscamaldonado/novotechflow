import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrefillStrategyType } from '../interfaces/prefill-strategy.interface';

/**
 * DTO de entrada del endpoint de extracción de especificaciones.
 * El archivo (Excel/PDF) viaja como multipart por @UploadedFile; aquí solo
 * se declara para que el ValidationPipe (forbidNonWhitelisted) no lo rechace.
 * Su contenido NO se valida aquí: cada estrategia valida el buffer por magic bytes.
 */
export class ExtractSpecsDto {
  @IsEnum(PrefillStrategyType)
  tipoInput: PrefillStrategyType;

  @IsOptional()
  @IsString()
  payload?: string;

  @IsOptional()
  file?: unknown;
}
