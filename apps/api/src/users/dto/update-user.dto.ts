import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * DTO para edición de usuario desde el panel admin.
 * Todos los campos son opcionales (PATCH semantics).
 * proposalCounterStart es editable por ADMIN, con validación contra códigos ya emitidos (ver UsersService.updateUser).
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

  @ApiPropertyOptional({
    description:
      'Offset inicial del contador de propuestas. Editable por ADMIN. No puede ser menor o igual al \u00FAltimo n\u00FAmero secuencial ya emitido por el usuario.',
    example: 100,
    minimum: 0,
    maximum: 99999,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  proposalCounterStart?: number;
}
