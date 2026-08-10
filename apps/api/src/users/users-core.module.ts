import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

// Nucleo sin controladores: provee UsersService para cualquier proceso
// (API principal via UsersModule, servicio externo via ExternalModule)
// sin arrastrar UsersController al grafo.
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersCoreModule {}
