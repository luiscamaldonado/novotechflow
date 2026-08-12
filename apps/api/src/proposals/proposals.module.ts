import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ScenariosService } from './scenarios.service';
import { PagesService } from './pages.service';
import { TrmService } from './trm.service';
import { ProposalsController } from './proposals.controller';
import { ImageAssetsModule } from '../image-assets/image-assets.module';

@Module({
  imports: [ImageAssetsModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, ScenariosService, PagesService, TrmService],
})
export class ProposalsModule {}
