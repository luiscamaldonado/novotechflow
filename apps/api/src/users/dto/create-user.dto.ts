import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsString() @MinLength(2) @MaxLength(10)
  nomenclature: string;

  @IsString() @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    description: 'Número desde el cual empezará el consecutivo de cotizaciones (default 0)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  proposalCounterStart?: number;
}
