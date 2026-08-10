import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExternalModule } from './external/external.module';
import { RealIpThrottlerGuard } from './common/guards/real-ip-throttler.guard';

// Modulo raiz del servicio api-external: solo el grafo que ExternalModule
// necesita para resolver sus dependencias. AuthModule aporta AuthService y
// EmailVerificationService (login + 2FA); UsersModule aporta UsersService
// (lo usan ExternalAuthService y ExternalJwtStrategy); PrismaModule aporta
// la conexion. Ningun modulo de negocio (Proposals, Clients, Templates,
// Catalogs, BillingProjections, Suppliers, Presence, SpecOptions,
// SpecPrefill, AppSettings) entra aqui.
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ExternalModule,
    // Misma config que AppModule: 100 y no 30 (anexo medicion de trafico en
    // docs/diagnostico-2026-07-24-deps-bundle.md).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: RealIpThrottlerGuard }],
})
export class ExternalAppModule {}
