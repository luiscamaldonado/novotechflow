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
import { SuppliersModule } from './suppliers/suppliers.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
    // 100 y no 30: pico legitimo medido 24 req/60s por (IP, handler) en GET /spec-options/suggest, margen 4,2x (reporte de trafico)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
