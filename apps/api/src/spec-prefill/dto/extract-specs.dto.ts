import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrefillStrategyType } from '../interfaces/prefill-strategy.interface';

/**
 * DTO de entrada del endpoint de extracción de especificaciones.
 * El archivo (Excel/PDF) viaja como multipart por @UploadedFile, no aquí.
 */
export class ExtractSpecsDto {
    @IsEnum(PrefillStrategyType)
    tipoInput: PrefillStrategyType;

    @IsOptional()
    @IsString()
    payload?: string;
}
