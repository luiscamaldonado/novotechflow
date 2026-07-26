import { Module } from '@nestjs/common';
import { SpecOptionsController } from './spec-options.controller';
import { SpecOptionsService } from './spec-options.service';

/**
 * @module SpecOptionsModule
 * Módulo NestJS para la gestión de opciones de autocompletado de campos técnicos.
 *
 * @description
 * Responsabilidades:
 * - CRUD admin de opciones (fieldName + value).
 * - Endpoint público de sugerencias case-insensitive para autocompletado.
 * - Carga masiva con skipDuplicates.
 */
@Module({
  controllers: [SpecOptionsController],
  providers: [SpecOptionsService],
  exports: [SpecOptionsService],
})
export class SpecOptionsModule {}
