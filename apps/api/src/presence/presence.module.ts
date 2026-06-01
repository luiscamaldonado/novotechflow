import { Module } from '@nestjs/common';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * @module PresenceModule
 * Presencia de usuarios v\u00eda heartbeat. Lectura de activos restringida a admin.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PresenceController],
  providers: [PresenceService],
})
export class PresenceModule {}
