import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsBoolean,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * DTO para edición de usuario desde el panel admin.
 * Todos los campos son opcionales (PATCH semantics).
 * proposalCounterStart NO se incluye — es inmutable post-creación.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Juan Pérez', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'juan@empresa.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'JP',
    description: 'Nomenclatura del usuario (uppercase alfanumérico)',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'nomenclature debe contener solo letras mayúsculas y números',
  })
  nomenclature?: string;

  @ApiPropertyOptional({
    description: 'Nueva contraseña. Si viene vacío o ausente, no se cambia.',
    minLength: 6,
    maxLength: 72,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({ enum: Role, example: 'COMMERCIAL' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
