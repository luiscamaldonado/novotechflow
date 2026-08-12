import { Module } from '@nestjs/common';
import { ImageAssetsService } from './image-assets.service';

// PrismaModule es @Global() y se registra en app.module.ts / external-app.module.ts,
// por eso aqui no se importa (mismo patron que TemplatesModule y ProposalsModule).
@Module({
  providers: [ImageAssetsService],
  exports: [ImageAssetsService],
})
export class ImageAssetsModule {}
