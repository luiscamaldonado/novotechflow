import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ScenariosService } from './scenarios.service';
import { PagesService } from './pages.service';
import { TrmService } from './trm.service';
import { ProposalsController } from './proposals.controller';

@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService, ScenariosService, PagesService, TrmService],
})
export class ProposalsModule {}
