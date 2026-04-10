import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSpecOptionDto, UpdateSpecOptionDto } from './dto/spec-options.dto';

/** Máximo de sugerencias devueltas por el endpoint suggest */
const MAX_SUGGESTIONS = 10;

/**
 * @class SpecOptionsService
 * Servicio para gestionar las opciones de autocompletado de campos técnicos.
 * Soporta CRUD individual, carga masiva y sugerencias case-insensitive.
 */
@Injectable()
export class SpecOptionsService {
  private readonly logger = new Logger(SpecOptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista opciones filtradas opcionalmente por fieldName.
   * Por defecto solo devuelve activas; pasa includeInactive=true para incluir desactivadas.
   */
  async findAll(fieldName?: string, includeInactive = false) {
    return this.prisma.specOption.findMany({
      where: {
        ...(fieldName ? { fieldName } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { value: 'asc' },
    });
  }

  /**
   * Sugiere opciones activas cuyo valor contenga `query` (case-insensitive).
   * Retorna máximo MAX_SUGGESTIONS resultados.
   */
  async suggest(fieldName: string, query: string) {
    return this.prisma.specOption.findMany({
      where: {
        fieldName,
        value: { contains: query, mode: 'insensitive' },
        isActive: true,
      },
      take: MAX_SUGGESTIONS,
      orderBy: { value: 'asc' },
    });
  }

  /**
   * Crea una nueva opción. Lanza ConflictException si la combinación
   * fieldName + value ya existe.
   */
  async create(dto: CreateSpecOptionDto) {
    const existingOption = await this.prisma.specOption.findUnique({
      where: {
        fieldName_value: {
          fieldName: dto.fieldName,
          value: dto.value,
        },
      },
    });

    if (existingOption) {
      throw new ConflictException(
        `Ya existe una opción "${dto.value}" para el campo "${dto.fieldName}".`,
      );
    }

    return this.prisma.specOption.create({ data: dto });
  }

  /**
   * Actualiza el valor o estado activo de una opción.
   */
  async update(id: string, dto: UpdateSpecOptionDto) {
    return this.prisma.specOption.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Soft-delete: desactiva la opción en vez de eliminarla.
   */
  async remove(id: string) {
    return this.prisma.specOption.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Crea múltiples opciones de una vez, ignorando duplicados.
   */
  async bulkCreate(items: CreateSpecOptionDto[]) {
    const result = await this.prisma.specOption.createMany({
      data: items,
      skipDuplicates: true,
    });

    this.logger.log(`Bulk create: ${result.count} opciones creadas (${items.length} enviadas)`);

    return { created: result.count, sent: items.length };
  }
}
