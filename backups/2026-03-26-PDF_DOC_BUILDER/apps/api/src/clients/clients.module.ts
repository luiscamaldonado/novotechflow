import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * @module ClientsModule
 * Módulo NestJS que encapsula toda la funcionalidad de gestión de clientes.
 *
 * @description
 * Responsabilidades:
 * - Búsqueda inteligente con ranking de relevancia.
 * - Sugerencias tipo Google ("¿Quisiste decir...?") basadas en Coeficiente de Dice.
 * - Auto-registro de nuevos clientes (gestionado desde ProposalsService al crear propuestas).
 *
 * @dependencies PrismaModule (acceso a base de datos).
 */
@Module({
  imports: [PrismaModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
