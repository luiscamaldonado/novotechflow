import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SpecOptionsService } from './spec-options.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateSpecOptionDto,
  UpdateSpecOptionDto,
  BulkCreateSpecOptionsDto,
  BulkDeleteSpecOptionsDto,
} from './dto/spec-options.dto';

/**
 * @class SpecOptionsController
 * Controlador REST para la gestión de opciones de autocompletado.
 * Expone endpoints admin (CRUD completo) y un endpoint público de sugerencias.
 */
@Controller()
export class SpecOptionsController {
  constructor(private readonly specOptionsService: SpecOptionsService) {}

  // ─── ENDPOINTS ADMIN ───────────────────────────────────────────

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Crear una opción de autocompletado' })
  @Post('admin/spec-options')
  async create(@Body() dto: CreateSpecOptionDto) {
    return this.specOptionsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Listar opciones (opcionalmente filtrar por fieldName)' })
  @ApiQuery({ name: 'fieldName', required: false, example: 'fabricante' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @Get('admin/spec-options')
  async findAll(
    @Query('fieldName') fieldName?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const shouldIncludeInactive = includeInactive === 'true';
    return this.specOptionsService.findAll(fieldName, shouldIncludeInactive);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Actualizar una opción de autocompletado' })
  @Patch('admin/spec-options/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecOptionDto,
  ) {
    return this.specOptionsService.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Borrado masivo por IDs' })
  @Post('admin/spec-options/bulk-delete')
  async bulkDelete(@Body() dto: BulkDeleteSpecOptionsDto) {
    return this.specOptionsService.bulkRemove(dto.ids);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Eliminar todas las opciones de un campo' })
  @Delete('admin/spec-options/by-field/:fieldName')
  async removeByField(@Param('fieldName') fieldName: string) {
    return this.specOptionsService.bulkRemoveByField(fieldName);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Hard-delete: eliminar una opción' })
  @Delete('admin/spec-options/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.specOptionsService.remove(id);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Carga masiva de opciones (ignora duplicados)' })
  @Post('admin/spec-options/bulk')
  async bulkCreate(@Body() dto: BulkCreateSpecOptionsDto) {
    return this.specOptionsService.bulkCreate(dto.items);
  }

  // ─── ENDPOINT PÚBLICO (cualquier usuario autenticado) ──────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('spec-options')
  @ApiOperation({ summary: 'Sugerir opciones para autocompletado (máx 10)' })
  @ApiQuery({ name: 'fieldName', required: true, example: 'fabricante' })
  @ApiQuery({ name: 'q', required: true, example: 'del' })
  @Get('spec-options/suggest')
  async suggest(
    @Query('fieldName') fieldName: string,
    @Query('q') query: string,
  ) {
    return this.specOptionsService.suggest(fieldName, query);
  }
}
