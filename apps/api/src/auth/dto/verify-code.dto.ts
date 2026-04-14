import { IsUUID, IsString, Length } from 'class-validator';

/**
 * DTO para verificar un c\u00f3digo de 2FA.
 */
export class VerifyCodeDto {
  @IsUUID()
  userId: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

/**
 * DTO para reenviar un c\u00f3digo de 2FA.
 */
export class ResendCodeDto {
  @IsUUID()
  userId: string;
}
