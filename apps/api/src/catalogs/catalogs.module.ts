import { Module } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';

/**
 * @module CatalogsModule
 * Módulo para la gestión y consulta de catálogos y datos maestros.
 */
@Module({
  providers: [CatalogsService],
  controllers: [CatalogsController],
  exports: [CatalogsService],
})
export class CatalogsModule {}
