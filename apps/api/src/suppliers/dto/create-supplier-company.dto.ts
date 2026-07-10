import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** DTO para crear una empresa proveedora manual (solo nombre; sin NIT). */
export class CreateSupplierCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;
}
