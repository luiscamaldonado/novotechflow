import { IsString, IsBoolean, MaxLength } from 'class-validator';

export class UpdateMaintenanceBannerDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  @IsBoolean()
  active!: boolean;
}
