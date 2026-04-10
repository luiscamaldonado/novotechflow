import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ClientsModule } from './clients/clients.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { TemplatesModule } from './templates/templates.module';
import { BillingProjectionsModule } from './billing-projections/billing-projections.module';
import { SpecOptionsModule } from './spec-options/spec-options.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ProposalsModule, ClientsModule, CatalogsModule, TemplatesModule, BillingProjectionsModule, SpecOptionsModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule { }
