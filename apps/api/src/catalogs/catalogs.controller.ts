import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class CatalogsController
 * Controlador para acceder a los datos maestros del sistema.
 */
@ApiTags('Catalogs')
@ApiBearerAuth()
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
      'SEGURIDAD', 'GARANTIA_BATERIA', 'GARANTIA_EQUIPO',
      'ACC_TIPO', 'ACC_GARANTIA',
      'SVC_TIPO', 'SVC_RESPONSABLE', 'SVC_UM',
      'SW_TIPO', 'SW_UM',
      'INFRA_TIPO', 'INFRA_GARANTIA',
      'INFRA_SVC_TIPO', 'INFRA_SVC_RESPONSABLE', 'INFRA_SVC_UM'
    ];
    return this.catalogsService.findMultipleCategories(categories);
  }
}
