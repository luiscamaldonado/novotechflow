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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { ClientsService, ISearchResponse } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  validateCsvFile,
  sanitizeCsvCellValue,
  sanitizeFilenameCsv,
} from '../common/upload-validation';
import {
  CreateClientDto,
  UpdateClientDto,
  BulkCreateClientsDto,
  BulkDeleteClientsDto,
} from './dto/clients.dto';

/** MIME types permitted for CSV uploads */
const ALLOWED_CSV_MIMES = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];

/** Max CSV file size: 5 MB */
const CSV_MAX_SIZE = 5 * 1024 * 1024;

/**
 * @class ClientsController
 * Controlador REST para la gesti\u00f3n de clientes.
 * Expone endpoints p\u00fablicos (b\u00fasqueda) y admin (CRUD completo).
 */
@Controller()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // \u2500\u2500\u2500 ENDPOINT P\u00daBLICO (cualquier usuario autenticado) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  /**
   * Busca clientes por coincidencia parcial con ranking de relevancia.
   * Tambi\u00e9n puede devolver sugerencias tipo "\u00bfQuisiste decir...?" si no hay coincidencias.
   *
   * @param {string} query - T\u00e9rmino de b\u00fasqueda ingresado por el usuario (m\u00edn. 2 caracteres).
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

  // \u2500\u2500\u2500 ENDPOINTS ADMIN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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
  @ApiOperation({ summary: 'Listar clientes con paginaci\u00f3n y b\u00fasqueda opcional' })
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

  /**
   * Endpoint de subida directa de archivo CSV para Clients.
   * Valida el archivo (extensi\u00f3n, tama\u00f1o, binarios, estructura CSV),
   * sanitiza cada celda contra inyecci\u00f3n CSV, y crea clientes en bulk.
   */
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiTags('admin/clients')
  @ApiOperation({ summary: 'Importar clientes desde archivo CSV' })
  @ApiConsumes('multipart/form-data')
  @Post('admin/clients/import-csv')
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
    const items = await this.parseCsvToClients(file.path);
    return this.clientsService.bulkCreate(items);
  }

  // \u2500\u2500\u2500 PRIVATE HELPERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  /**
   * Parsea un archivo CSV a un array de CreateClientDto.
   * Formato esperado: columna "name" (requerida), columna "nit" (opcional).
   */
  private async parseCsvToClients(filePath: string): Promise<CreateClientDto[]> {
    const buffer = await readFile(filePath);
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('El CSV debe tener al menos un encabezado y una fila.');
    }

    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const items: CreateClientDto[] = [];

    const nameIndex = headers.findIndex(h => h === 'name' || h === 'nombre');
    const nitIndex = headers.findIndex(h => h === 'nit');

    // Multi-column: name, nit
    if (nameIndex !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const name = sanitizeCsvCellValue(cols[nameIndex] || '');
        const nit = nitIndex !== -1 ? sanitizeCsvCellValue(cols[nitIndex] || '') : undefined;
        if (name) {
          items.push({ name, ...(nit ? { nit } : {}) });
        }
      }
    }
    // Single-column: each row is a client name
    else if (headers.length === 1) {
      for (let i = 1; i < lines.length; i++) {
        const name = sanitizeCsvCellValue(lines[i].trim().replace(/^"|"$/g, ''));
        if (name) {
          items.push({ name });
        }
      }
    } else {
      throw new BadRequestException(
        'Formato CSV no reconocido. Use columna "name" (o "nombre") y opcionalmente "nit".',
      );
    }

    if (items.length === 0) {
      throw new BadRequestException('El archivo CSV no contiene datos v\u00e1lidos.');
    }

    return items;
  }
}
