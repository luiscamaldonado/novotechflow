import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ClientsService, ISearchResponse } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  CreateClientDto,
  UpdateClientDto,
  BulkCreateClientsDto,
  BulkDeleteClientsDto,
} from './dto/clients.dto';

/**
 * @class ClientsController
 * Controlador REST para la gestión de clientes.
 * Expone endpoints públicos (búsqueda) y admin (CRUD completo).
 */
@Controller()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ─── ENDPOINT PÚBLICO (cualquier usuario autenticado) ──────────

  /**
   * Busca clientes por coincidencia parcial con ranking de relevancia.
   * También puede devolver sugerencias tipo "¿Quisiste decir...?" si no hay coincidencias.
   *
   * @param {string} query - Término de búsqueda ingresado por el usuario (mín. 2 caracteres).
   * @returns {Promise<ISearchResponse>} Objeto con resultados rankeados y sugerencia opcional.
   *
   * @example GET /clients/search?q=SURA
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('Clients')
  @ApiOperation({ summary: 'Buscar clientes con ranking de relevancia' })
  @ApiQuery({ name: 'q', required: true, example: 'SURA' })
  @Get('clients/search')
  async search(@Query('q') query: string): Promise<ISearchResponse> {
    return this.clientsService.search(query);
  }

  // ─── ENDPOINTS ADMIN ───────────────────────────────────────────

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Crear un cliente' })
  @Post('admin/clients')
  async create(@Body() dto: CreateClientDto) {
    return this.clientsService.createClient(dto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Listar clientes con paginación y búsqueda opcional' })
  @ApiQuery({ name: 'q', required: false, example: 'banco' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 50 })
  @Get('admin/clients')
  async findAll(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.clientsService.findAllAdmin(
      query,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Actualizar un cliente' })
  @Patch('admin/clients/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.updateClient(id, dto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Borrado masivo de clientes por IDs' })
  @Post('admin/clients/bulk-delete')
  async bulkDelete(@Body() dto: BulkDeleteClientsDto) {
    return this.clientsService.bulkRemove(dto.ids);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Hard-delete: eliminar un cliente' })
  @Delete('admin/clients/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.removeClient(id);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Carga masiva de clientes (ignora duplicados)' })
  @Post('admin/clients/bulk')
  async bulkCreate(@Body() dto: BulkCreateClientsDto) {
    return this.clientsService.bulkCreate(dto.items);
  }
}
