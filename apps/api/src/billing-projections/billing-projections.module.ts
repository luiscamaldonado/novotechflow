import { Module } from '@nestjs/common';
import { BillingProjectionsController } from './billing-projections.controller';
import { BillingProjectionsService } from './billing-projections.service';

@Module({
  controllers: [BillingProjectionsController],
  providers: [BillingProjectionsService],
})
export class BillingProjectionsModule {}
