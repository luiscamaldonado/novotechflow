import { IsInt, Min, Max } from 'class-validator';

export class UpdateInactivityTimeoutDto {
  @IsInt()
  @Min(2)
  @Max(60)
  minutes!: number;
}
