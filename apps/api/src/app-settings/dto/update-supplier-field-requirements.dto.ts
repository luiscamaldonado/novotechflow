import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSupplierFieldRequirementsDto {
  @IsOptional()
  @IsBoolean()
  nameRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  phoneRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  emailRequired?: boolean;
}
