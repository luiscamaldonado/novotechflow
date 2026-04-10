import {
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para crear una nueva opción de campo (fieldName + value).
 */
export class CreateSpecOptionDto {
  @ApiProperty({ example: 'fabricante', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  fieldName: string;

  @ApiProperty({ example: 'Dell Technologies', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  value: string;
}

/**
 * DTO para actualizar una opción existente (valor y/o estado activo).
 */
export class UpdateSpecOptionDto {
  @ApiPropertyOptional({ example: 'Dell Inc.', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  value?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Máximo de opciones permitidas en un bulk create */
const MAX_BULK_ITEMS = 500;

/**
 * DTO para carga masiva de opciones.
 */
export class BulkCreateSpecOptionsDto {
  @ApiProperty({ type: [CreateSpecOptionDto], maxItems: MAX_BULK_ITEMS })
  @IsArray()
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateSpecOptionDto)
  items: CreateSpecOptionDto[];
}
