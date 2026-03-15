import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class CatalogsController
 * Controlador para acceder a los datos maestros del sistema.
 */
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  /**
   * Obtiene los valores de una categoría.
   * @example GET /catalogs/category/FABRICANTE
   */
  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    return this.catalogsService.findByCategory(category);
  }

  /**
   * Obtiene especificaciones para PCs (múltiples categorías).
   * @example GET /catalogs/pc-specs
   */
  @Get('pc-specs')
  async getPcSpecs() {
    const categories = [
      'FORMATO', 'FABRICANTE', 'MODELO', 'PROCESADOR', 'SISTEMA_OPERATIVO',
      'GRAFICOS', 'MEMORIA_RAM', 'ALMACENAMIENTO', 'PANTALLA', 'NETWORK',
      'SEGURIDAD', 'GARANTIA_BATERIA', 'GARANTIA_EQUIPO'
    ];
    return this.catalogsService.findMultipleCategories(categories);
  }
}
