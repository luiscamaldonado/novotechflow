import { Module } from '@nestjs/common';
import { SpecOptionsController } from './spec-options.controller';
import { SpecOptionsService } from './spec-options.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * @module SpecOptionsModule
 * Módulo NestJS para la gestión de opciones de autocompletado de campos técnicos.
 *
 * @description
 * Responsabilidades:
 * - CRUD admin de opciones (fieldName + value).
 * - Endpoint público de sugerencias case-insensitive para autocompletado.
 * - Carga masiva con skipDuplicates.
 *
 * @dependencies PrismaModule (acceso a base de datos).
 */
@Module({
  imports: [PrismaModule],
  controllers: [SpecOptionsController],
  providers: [SpecOptionsService],
  exports: [SpecOptionsService],
})
export class SpecOptionsModule {}
