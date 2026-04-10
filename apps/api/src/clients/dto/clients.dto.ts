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
 * DTO para crear un cliente (solo nombre requerido).
 */
export class CreateClientDto {
  @ApiProperty({ example: 'Banco de Bogotá', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: '860001234-5', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;
}

/**
 * DTO para actualizar un cliente.
 */
export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Banco de Bogotá S.A.', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '860001234-5', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Máximo de clientes permitidos en un bulk create */
const MAX_BULK_CLIENTS = 500;

/**
 * DTO para carga masiva de clientes (CSV import).
 */
export class BulkCreateClientsDto {
  @ApiProperty({ type: [CreateClientDto], maxItems: MAX_BULK_CLIENTS })
  @IsArray()
  @ArrayMaxSize(MAX_BULK_CLIENTS)
  @ValidateNested({ each: true })
  @Type(() => CreateClientDto)
  items: CreateClientDto[];
}
