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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { SpecOptionsService } from './spec-options.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  validateCsvFile,
  sanitizeCsvCellValue,
  sanitizeFilenameCsv,
} from '../common/upload-validation';
import {
  CreateSpecOptionDto,
  UpdateSpecOptionDto,
  BulkCreateSpecOptionsDto,
  BulkDeleteSpecOptionsDto,
} from './dto/spec-options.dto';

/** MIME types permitted for CSV uploads */
const ALLOWED_CSV_MIMES = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];

/** Max CSV file size: 5 MB */
const CSV_MAX_SIZE = 5 * 1024 * 1024;

/**
 * @class SpecOptionsController
 * Controlador REST para la gesti\u00f3n de opciones de autocompletado.
 * Expone endpoints admin (CRUD completo) y un endpoint p\u00fablico de sugerencias.
 */
@Controller()
export class SpecOptionsController {
  constructor(private readonly specOptionsService: SpecOptionsService) {}

  // \u2500\u2500\u2500 ENDPOINTS ADMIN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Crear una opci\u00f3n de autocompletado' })
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
  @ApiOperation({ summary: 'Actualizar una opci\u00f3n de autocompletado' })
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
  @ApiOperation({ summary: 'Hard-delete: eliminar una opci\u00f3n' })
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

  /**
   * Endpoint de subida directa de archivo CSV para SpecOptions.
   * Valida el archivo (extensi\u00f3n, tama\u00f1o, binarios, estructura CSV),
   * sanitiza cada celda contra inyecci\u00f3n CSV, y crea opciones en bulk.
   */
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/spec-options')
  @ApiOperation({ summary: 'Importar opciones desde archivo CSV' })
  @ApiConsumes('multipart/form-data')
  @Post('admin/spec-options/import-csv')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'tmp'),
      filename: (_req, file, cb) => {
        const safeName = sanitizeFilenameCsv(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `csv-${uniqueSuffix}-${safeName}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_CSV_MIMES.includes(file.mimetype)) {
        cb(new BadRequestException('Solo se permiten archivos CSV'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: CSV_MAX_SIZE },
  }))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se envi\u00f3 ning\u00fan archivo.');
    }

    await validateCsvFile(file);
    const items = await this.parseCsvToSpecOptions(file.path);
    return this.specOptionsService.bulkCreate(items);
  }

  // \u2500\u2500\u2500 ENDPOINT P\u00daBLICO (cualquier usuario autenticado) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiTags('spec-options')
  @ApiOperation({ summary: 'Sugerir opciones para autocompletado (m\u00e1x 10)' })
  @ApiQuery({ name: 'fieldName', required: true, example: 'fabricante' })
  @ApiQuery({ name: 'q', required: true, example: 'del' })
  @Get('spec-options/suggest')
  async suggest(
    @Query('fieldName') fieldName: string,
    @Query('q') query: string,
  ) {
    return this.specOptionsService.suggest(fieldName, query);
  }

  // \u2500\u2500\u2500 PRIVATE HELPERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  /**
   * Parsea un archivo CSV a un array de CreateSpecOptionDto.
   * Formato esperado: columnas "fieldName" (o "field_name") y "value".
   * Si el CSV solo tiene una columna, se interpreta como "value" y se requiere
   * que el header sea el fieldName.
   */
  private async parseCsvToSpecOptions(filePath: string): Promise<CreateSpecOptionDto[]> {
    const buffer = await readFile(filePath);
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('El CSV debe tener al menos un encabezado y una fila.');
    }

    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const items: CreateSpecOptionDto[] = [];

    const fieldNameIndex = headers.findIndex(h => h === 'fieldname' || h === 'field_name');
    const valueIndex = headers.findIndex(h => h === 'value');

    // Two-column format: fieldName, value
    if (fieldNameIndex !== -1 && valueIndex !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const fieldName = sanitizeCsvCellValue(cols[fieldNameIndex] || '');
        const value = sanitizeCsvCellValue(cols[valueIndex] || '');
        if (fieldName && value) {
          items.push({ fieldName, value });
        }
      }
    }
    // Single-column: header IS the fieldName, each row is a value
    else if (headers.length === 1) {
      const fieldName = sanitizeCsvCellValue(headers[0]);
      for (let i = 1; i < lines.length; i++) {
        const value = sanitizeCsvCellValue(lines[i].trim().replace(/^"|"$/g, ''));
        if (value) {
          items.push({ fieldName, value });
        }
      }
    } else {
      throw new BadRequestException(
        'Formato CSV no reconocido. Use columnas "fieldName,value" o una sola columna con el nombre del campo como encabezado.',
      );
    }

    if (items.length === 0) {
      throw new BadRequestException('El archivo CSV no contiene datos v\u00e1lidos.');
    }

    return items;
  }
}
