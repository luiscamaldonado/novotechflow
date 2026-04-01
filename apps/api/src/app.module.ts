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

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ProposalsModule, ClientsModule, CatalogsModule, TemplatesModule, BillingProjectionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
