import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersCoreModule } from '../users/users-core.module';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';

// Nucleo sin controladores ni estrategias: provee AuthService (login + firma
// de JWT con JWT_SECRET) y EmailVerificationService (2FA por correo) para la
// API principal (via AuthModule) y el servicio externo (via ExternalModule)
// sin arrastrar AuthController al grafo.
@Module({
  imports: [
    UsersCoreModule,
    PassportModule,
    JwtModule.register({
      secret: (() => {
        if (!process.env.JWT_SECRET)
          throw new Error('JWT_SECRET env var is required');
        return process.env.JWT_SECRET;
      })(),
      signOptions: { expiresIn: '12h' },
    }),
  ],
  providers: [AuthService, EmailVerificationService],
  exports: [AuthService, EmailVerificationService],
})
export class AuthCoreModule {}
