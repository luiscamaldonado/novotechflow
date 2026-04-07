import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService, ISearchResponse } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class ClientsController
 * Controlador REST para la gestión de búsquedas de clientes.
 * Expone endpoints protegidos por JWT para consultar el maestro de clientes.
 *
 * @route /clients
 */
@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * Busca clientes por coincidencia parcial con ranking de relevancia.
   * También puede devolver sugerencias tipo "¿Quisiste decir...?" si no hay coincidencias.
   *
   * @param {string} query - Término de búsqueda ingresado por el usuario (mín. 2 caracteres).
   * @returns {Promise<ISearchResponse>} Objeto con resultados rankeados y sugerencia opcional.
   *
   * @example GET /clients/search?q=SURA
   */
  @Get('search')
  async search(@Query('q') query: string): Promise<ISearchResponse> {
    return this.clientsService.search(query);
  }
}
