import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { SupplierContact } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuppliersService } from './suppliers.service';
import type { SupplierCompanyWithContacts } from './suppliers.service';
import { CreateSupplierCompanyDto } from './dto/create-supplier-company.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';

/** Typed request after JWT authentication - mirrors app-settings.controller.ts */
interface AuthenticatedRequest {
  user: { id: string; role: string };
}

/**
 * @class SuppliersController
 * REST para el catalogo global de proveedores.
 * Todos los endpoints requieren JWT; no hay ownership ni AdminGuard.
 */
@Controller('suppliers')
@ApiTags('suppliers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar proveedores con sus contactos' })
  async findAll(): Promise<SupplierCompanyWithContacts[]> {
    return this.suppliersService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear un proveedor (empresa) manual' })
  async createCompany(
    @Body() dto: CreateSupplierCompanyDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SupplierCompanyWithContacts> {
    return this.suppliersService.createCompany(dto, req.user.id);
  }

  @Post(':companyId/contacts')
  @ApiOperation({ summary: 'Crear un contacto para un proveedor' })
  async createContact(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateSupplierContactDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SupplierContact> {
    return this.suppliersService.createContact(companyId, dto, req.user.id);
  }
}
