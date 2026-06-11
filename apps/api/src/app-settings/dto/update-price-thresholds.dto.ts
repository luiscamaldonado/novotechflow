import { IsInt, Min, Max } from 'class-validator';

export class UpdatePriceThresholdsDto {
  @IsInt()
  @Min(1)
  @Max(10000000)
  copMinUnitPrice!: number;

  @IsInt()
  @Min(1)
  @Max(100000000)
  usdMaxUnitPrice!: number;
}
