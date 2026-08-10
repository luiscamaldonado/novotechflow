import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { PresenceModule } from './presence/presence.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ClientsModule } from './clients/clients.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { TemplatesModule } from './templates/templates.module';
import { BillingProjectionsModule } from './billing-projections/billing-projections.module';
import { SpecOptionsModule } from './spec-options/spec-options.module';
import { SpecPrefillModule } from './spec-prefill/spec-prefill.module';
import { ExternalModule } from './external/external.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RealIpThrottlerGuard } from './common/guards/real-ip-throttler.guard';

@Module({
  imports: [
    PrismaModule,
    AppSettingsModule,
    AuthModule,
    UsersModule,
    ProposalsModule,
    ClientsModule,
    CatalogsModule,
    TemplatesModule,
    BillingProjectionsModule,
    SpecOptionsModule,
    SpecPrefillModule,
    SuppliersModule,
    PresenceModule,
    ExternalModule,
    // 100 y no 30: pico legitimo medido 24 req/60s por (IP, handler), margen 4,2x (anexo medicion de trafico en docs/diagnostico-2026-07-24-deps-bundle.md)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: RealIpThrottlerGuard },
  ],
})
export class AppModule {}
