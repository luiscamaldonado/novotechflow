import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeCsvCellValue } from '../common/upload-validation';
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
   * Hard-delete: elimina la opción de la base de datos.
   */
  async remove(id: string) {
    return this.prisma.specOption.delete({ where: { id } });
  }

  /**
   * Elimina múltiples opciones por sus IDs.
   */
  async bulkRemove(ids: string[]): Promise<{ deleted: number }> {
    const result = await this.prisma.specOption.deleteMany({
      where: { id: { in: ids } },
    });
    return { deleted: result.count };
  }

  /**
   * Elimina todas las opciones de un campo específico.
   */
  async bulkRemoveByField(fieldName: string): Promise<{ deleted: number }> {
    const result = await this.prisma.specOption.deleteMany({
      where: { fieldName },
    });
    return { deleted: result.count };
  }

  /**
   * Crea múltiples opciones de una vez, ignorando duplicados.
   * Sanitiza cada valor contra CSV injection antes de insertar.
   */
  async bulkCreate(items: CreateSpecOptionDto[]) {
    const sanitizedItems = items.map(item => ({
      fieldName: sanitizeCsvCellValue(item.fieldName),
      value: sanitizeCsvCellValue(item.value),
    }));

    const result = await this.prisma.specOption.createMany({
      data: sanitizedItems,
      skipDuplicates: true,
    });

    this.logger.log(`Bulk create: ${result.count} opciones creadas (${items.length} enviadas)`);

    return { created: result.count, sent: items.length };
  }
}

