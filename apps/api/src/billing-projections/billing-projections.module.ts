import { Module } from '@nestjs/common';
import { BillingProjectionsController } from './billing-projections.controller';
import { BillingProjectionsService } from './billing-projections.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [BillingProjectionsController],
    providers: [BillingProjectionsService, PrismaService],
})
export class BillingProjectionsModule {}
