import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ExternalLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ExternalVerifyCodeDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

export class ExternalResendCodeDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export interface ExternalJwtPayload {
  sub: string;
  email: string;
}

export interface ExternalAuthUser {
  id: string;
  email: string;
}

export interface ExternalVerificationPendingResponse {
  requiresVerification: true;
  userId: string;
  email: string;
}

export interface ExternalLoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}
