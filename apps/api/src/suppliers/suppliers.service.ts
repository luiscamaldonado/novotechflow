import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { SupplierCompany, SupplierContact } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierCompanyDto } from './dto/create-supplier-company.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';

/** Empresa proveedora con sus contactos anidados (payload de findAll/createCompany). */
export type SupplierCompanyWithContacts = SupplierCompany & {
  contacts: SupplierContact[];
};

/**
 * @class SuppliersService
 * Catalogo global de proveedores (empresas + contactos).
 * No hay ownership: cualquier usuario autenticado ve y crea.
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normaliza el nombre de una empresa con la misma regla usada al sembrar el
   * CSV: trim, puntos -> espacio, colapsa espacios, trim, MAYUSCULAS.
   * Los acentos se conservan.
   */
  private normalizeName(raw: string): string {
    return raw
      .trim()
      .replace(/\./g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /** Lista todas las empresas por nombre, con sus contactos (tambien por nombre). */
  async findAll(): Promise<SupplierCompanyWithContacts[]> {
    return this.prisma.supplierCompany.findMany({
      orderBy: { name: 'asc' },
      include: { contacts: { orderBy: { name: 'asc' } } },
    });
  }

  /**
   * Crea una empresa proveedora MANUAL. Rechaza duplicados por nombre normalizado.
   * @param dto nombre de la empresa (sin NIT en creacion manual).
   * @param userId ID del usuario que la crea (audit trail).
   */
  async createCompany(
    dto: CreateSupplierCompanyDto,
    userId: string,
  ): Promise<SupplierCompanyWithContacts> {
    const name = this.normalizeName(dto.name);

    const existing = await this.prisma.supplierCompany.findFirst({
      where: { name },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un proveedor con ese nombre: ${name}`,
      );
    }

    return this.prisma.supplierCompany.create({
      data: { name, source: 'MANUAL', createdById: userId },
      include: { contacts: true },
    });
  }

  /**
   * Crea un contacto para una empresa existente.
   * @param companyId empresa destino (debe existir).
   * @param dto datos del contacto (phone/email opcionales).
   * @param userId ID del usuario que lo crea (audit trail).
   */
  async createContact(
    companyId: string,
    dto: CreateSupplierContactDto,
    userId: string,
  ): Promise<SupplierContact> {
    const company = await this.prisma.supplierCompany.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(
        `No existe un proveedor con id: ${companyId}`,
      );
    }

    return this.prisma.supplierContact.create({
      data: {
        companyId,
        name: dto.name.trim(),
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        createdById: userId,
      },
    });
  }
}
