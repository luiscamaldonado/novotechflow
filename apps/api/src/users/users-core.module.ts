import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { ImageAssetsModule } from '../image-assets/image-assets.module';

// Nucleo sin controladores: provee UsersService para cualquier proceso
// (API principal via UsersModule, servicio externo via ExternalModule)
// sin arrastrar UsersController al grafo.
@Module({
  imports: [ImageAssetsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersCoreModule {}
