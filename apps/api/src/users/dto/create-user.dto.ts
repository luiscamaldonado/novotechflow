import { IsEmail, IsString, MinLength, MaxLength, IsEnum } from 'class-validator';
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
}
