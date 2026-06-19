import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus, ConsecutiveSource } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizePlainText } from '../common/sanitize';
import {
  CreateProposalDto,
  UpdateProposalDto,
  CreateProposalItemDto,
  UpdateProposalItemDto,
} from './dto/proposals.dto';
import { assertProposalNotLocked } from './proposals-lock.helper';

/** Resultado de la validación de un consecutivo manual. */
export type ManualConsecutiveValidation =
  | { ok: true }
  | {
      ok: false;
      reason: 'OUT_OF_RANGE' | 'GTE_AUTO' | 'TAKEN';
      conflict?: string;
      suggestion: number | null;
    };

/** Límite superior del rango de consecutivos. */
const MAX_CONSECUTIVE = 99999;
/** Dígitos de padding para los consecutivos nuevos. */
const CONSECUTIVE_PAD_LENGTH = 5;

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica que el usuario tenga acceso a la propuesta.
   * ADMIN accede a todas; COMMERCIAL solo a las propias.
   * Público para que ScenariosService y PagesService lo importen.
   */
  async verifyProposalOwnership(proposalId: string, user: AuthenticatedUser) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
    if (user.role !== 'ADMIN' && proposal.userId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta propuesta.');
    }
    if (proposal.deletedAt)
      throw new NotFoundException('Propuesta no encontrada.');
    return proposal;
  }

  /**
   * Busca propuestas recientes que coincidan con el término de búsqueda.
   * NOTA DE SEGURIDAD: Este endpoint muestra propuestas de TODOS los usuarios
   * intencionalmente. Su propósito es detectar cruces de cuenta entre comerciales
   * antes de crear una nueva propuesta para el mismo cliente.
   * Revisado en auditoría de seguridad 2026-04-05 — comportamiento aceptado.
   */
  async findPotentialConflicts(query: string): Promise<any[]> {
    const normalizedQuery = query?.trim();

    // Early return si no hay suficiente información para buscar
    if (!normalizedQuery || normalizedQuery.length < 3) {
      return [];
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return this.prisma.proposal.findMany({
      where: {
        OR: [
          { clientName: { contains: normalizedQuery, mode: 'insensitive' } },
          { subject: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
        createdAt: { gte: oneYearAgo },
        deletedAt: null,
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Limitamos para evitar sobrecarga visual
    });
  }

  /**
   * Orquesta la creación de una nueva propuesta comercial.
   * Soporta tanto generación automática como consecutivo manual.
   *
   * @param {string} userId - ID del usuario comercial que crea la oferta.
   * @param {CreateProposalDto} data - Payload con la información de la propuesta.
   * @throws {NotFoundException} Si el usuario no existe.
   * @throws {BadRequestException} Si el consecutivo manual es inválido.
   */
  async createProposal(userId: string, data: CreateProposalDto) {
    try {
      const user = await this.validateUserAccess(userId);
      const clientId = await this.ensureClientExists(
        data.clientName,
        data.clientId,
      );

      let proposalCode: string;
      let consecutiveSource: ConsecutiveSource;

      if (data.manualConsecutive !== undefined) {
        const validation: ManualConsecutiveValidation =
          await this.validateManualConsecutive(userId, data.manualConsecutive);

        if (validation.ok === false) {
          const { reason, conflict, suggestion } = validation;
          const messages: Record<string, string> = {
            OUT_OF_RANGE: `El consecutivo ${data.manualConsecutive} está fuera del rango permitido (1-${MAX_CONSECUTIVE}).`,
            GTE_AUTO: `El consecutivo ${data.manualConsecutive} es igual o mayor al próximo automático. Solo se permiten números por debajo del automático.`,
            TAKEN: `El consecutivo ${data.manualConsecutive} ya está en uso${conflict ? ` (${conflict})` : ''}.${suggestion ? ` Sugerencia: ${suggestion}` : ''}`,
          };
          throw new BadRequestException(messages[reason]);
        }

        const prefix = user.nomenclature || 'XX';
        const sequential = data.manualConsecutive
          .toString()
          .padStart(CONSECUTIVE_PAD_LENGTH, '0');
        proposalCode = `COT-${prefix}${sequential}-1`;
        consecutiveSource = ConsecutiveSource.MANUAL;
      } else {
        proposalCode = await this.generateProposalCode(
          user.nomenclature,
          userId,
        );
        consecutiveSource = ConsecutiveSource.AUTO;
      }

      return await this.prisma.proposal.create({
        data: {
          proposalCode,
          consecutiveSource,
          userId,
          clientId,
          clientName: sanitizePlainText(data.clientName.trim().toUpperCase()),
          subject: sanitizePlainText(data.subject),
          issueDate: new Date(data.issueDate),
          validityDays:
            typeof data.validityDays === 'string'
              ? parseInt(data.validityDays, 10)
              : data.validityDays,
          validityDate: new Date(data.validityDate),
          closeDate: new Date(data.closeDate),
          status: data.status ?? ProposalStatus.ELABORACION,
          acquisitionType: data.acquisitionType,
          manualAmount: data.manualAmount,
        },
      });
    } catch (error) {
      this.logger.error(
        `Falla al crear propuesta para usuario ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Valida la existencia del usuario y su capacidad para crear propuestas.
   * @private
   */
  private async validateUserAccess(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Early return pattern para validación
    if (!user) {
      throw new NotFoundException(
        `El usuario con ID ${userId} no fue encontrado en el sistema.`,
      );
    }

    return user;
  }

  /**
   * Garantiza que el cliente esté registrado en la base de datos centralizada (Master Data).
   * Implementa un patrón Upsert para evitar duplicidad de nombres normalizados.
   * @private
   */
  private async ensureClientExists(
    name: string,
    existingId?: string,
  ): Promise<string> {
    const normalizedName = name.trim().toUpperCase();

    // Si ya tenemos un ID verificado, lo usamos directamente (OCP)
    if (existingId) return existingId;

    // Si no, realizamos un registro automático
    const client = await this.prisma.client.upsert({
      where: { name: normalizedName },
      update: {},
      create: {
        name: normalizedName,
        isActive: true,
      },
    });

    return client.id;
  }

  /**
   * Calcula el próximo número automático para un usuario (sin considerar huecos manuales).
   * Se usa como fuente única tanto en generateProposalCode como en validateManualConsecutive.
   * @private
   */
  private async getNextAutoNumber(userId: string): Promise<number> {
    const autoCodes = await this.prisma.proposal.findMany({
      where: { userId, consecutiveSource: ConsecutiveSource.AUTO },
      select: { proposalCode: true },
    });

    const autoNumbers = autoCodes
      .map((p) => p.proposalCode)
      .filter((c): c is string => c !== null)
      .map((c) => {
        const m = c.match(/(\d+)-\d+$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const maxAutoNumber = autoNumbers.length > 0 ? Math.max(...autoNumbers) : 0;
    let nextNumber = maxAutoNumber + 1;

    // Aplicar offset del usuario (historial previo fuera del sistema)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { proposalCounterStart: true },
    });
    if (user && user.proposalCounterStart > 0) {
      nextNumber = Math.max(nextNumber, user.proposalCounterStart + 1);
    }

    return nextNumber;
  }

  /**
   * Construye un Set con todos los números de consecutivo ya tomados por el usuario.
   * Incluye tanto AUTO como MANUAL.
   * @private
   */
  private async getTakenNumbers(userId: string): Promise<Set<number>> {
    const allCodes = await this.prisma.proposal.findMany({
      where: { userId },
      select: { proposalCode: true },
    });

    return new Set(
      allCodes
        .map((p) => p.proposalCode)
        .filter((c): c is string => c !== null)
        .map((c) => {
          const m = c.match(/(\d+)-\d+$/);
          return m ? parseInt(m[1], 10) : -1;
        })
        .filter((n) => n > 0),
    );
  }

  /**
   * Genera un código de propuesta único siguiendo el estándar corporativo
   * COT-[NOMENCLATURA][SECUENCIAL]-[VERSION].
   * Solo cuenta códigos AUTO para calcular el siguiente número y salta
   * números ya tomados por manuales.
   * @private
   */
  private async generateProposalCode(
    nomenclature: string,
    userId: string,
  ): Promise<string> {
    const prefix = nomenclature || 'XX';

    let nextNumber = await this.getNextAutoNumber(userId);

    // Saltar números que ya estén tomados (por manuales u otros)
    const takenNumbers = await this.getTakenNumbers(userId);
    while (takenNumbers.has(nextNumber)) {
      nextNumber++;
    }

    if (nextNumber > MAX_CONSECUTIVE) {
      throw new BadRequestException(
        'Se agotó el rango de consecutivos disponibles para este usuario.',
      );
    }

    const sequential = nextNumber
      .toString()
      .padStart(CONSECUTIVE_PAD_LENGTH, '0');
    return `COT-${prefix}${sequential}-1`;
  }

  /**
   * Valida un número de consecutivo manual contra el estado actual del usuario.
   * Retorna { ok: true } si es válido, o un objeto con reason, conflict y suggestion si no.
   */
  async validateManualConsecutive(
    userId: string,
    number: number,
  ): Promise<ManualConsecutiveValidation> {
    if (!Number.isInteger(number) || number < 1 || number > MAX_CONSECUTIVE) {
      return { ok: false, reason: 'OUT_OF_RANGE', suggestion: null };
    }

    const nextAuto = await this.getNextAutoNumber(userId);

    if (number >= nextAuto) {
      return { ok: false, reason: 'GTE_AUTO', suggestion: null };
    }

    const takenNumbers = await this.getTakenNumbers(userId);

    if (takenNumbers.has(number)) {
      // Buscar sugerencia: siguiente libre entre number+1 y nextAuto-1
      let suggestion: number | null = null;
      let candidate = number + 1;
      while (candidate < nextAuto && takenNumbers.has(candidate)) {
        candidate++;
      }
      if (candidate < nextAuto) {
        suggestion = candidate;
      }

      // Construir el código en conflicto para feedback
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { nomenclature: true },
      });
      const prefix = user?.nomenclature || 'XX';
      const conflict = `COT-${prefix}${number.toString().padStart(CONSECUTIVE_PAD_LENGTH, '0')}`;

      return { ok: false, reason: 'TAKEN', conflict, suggestion };
    }

    return { ok: true };
  }

  /**
   * Recupera una propuesta con sus ítems asociados para edición.
   */
  async getProposalById(id: string, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  /**
   * Actualiza los datos generales de una propuesta existente.
   *
   * @param {string} id - UUID de la propuesta.
   * @param {any} data - Nuevos datos (asunto, fechas, etc).
   */
  async updateProposal(
    id: string,
    data: UpdateProposalDto,
    user: AuthenticatedUser,
  ) {
    const proposal = await this.verifyProposalOwnership(id, user);
    assertProposalNotLocked(proposal);
    return this.prisma.proposal.update({
      where: { id },
      data: {
        subject: data.subject ? sanitizePlainText(data.subject) : undefined,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        validityDays: data.validityDays ?? undefined,
        validityDate: data.validityDate
          ? new Date(data.validityDate)
          : undefined,
        status: data.status ?? undefined,
        closeDate: data.closeDate
          ? new Date(data.closeDate)
          : data.closeDate === null
            ? null
            : undefined,
        billingDate: data.billingDate
          ? new Date(data.billingDate)
          : data.billingDate === null
            ? null
            : undefined,
        acquisitionType: data.acquisitionType ?? undefined,
        issueCity: data.issueCity ?? undefined,
        manualAmount:
          data.manualAmount === undefined ? undefined : data.manualAmount,
      },
    });
  }

  /**
   * Añade un nuevo ítem (producto/servicio) a la propuesta.
   * Gestiona el correlativo de orden (sortOrder) automáticamente.
   */
  async addProposalItem(
    proposalId: string,
    data: CreateProposalItemDto,
    user: AuthenticatedUser,
  ) {
    const proposal = await this.verifyProposalOwnership(proposalId, user);
    assertProposalNotLocked(proposal);
    const aggregate = await this.prisma.proposalItem.aggregate({
      where: { proposalId },
      _max: { sortOrder: true },
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalItem.create({
      data: {
        proposalId,
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity || 1,
        unitCost: data.unitCost || 0,
        costCurrency: data.costCurrency || 'COP',
        deliveryDays: data.deliveryDays,
        marginPct: data.marginPct || 0,
        unitPrice: data.unitPrice || 0,
        isTaxable: data.isTaxable ?? true,
        technicalSpecs: (data.technicalSpecs || {}) as object,
        internalCosts: (data.internalCosts || {}) as object,
        sortOrder: nextOrder,
      },
    });
  }

  /**
   * Elimina un ítem específico de una propuesta.
   */
  async removeProposalItem(itemId: string, user: AuthenticatedUser) {
    const item = await this.prisma.proposalItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('\u00cdtem no encontrado.');
    const proposal = await this.verifyProposalOwnership(item.proposalId, user);
    assertProposalNotLocked(proposal);
    return this.prisma.proposalItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Actualiza un ítem específico de una propuesta.
   */
  async updateProposalItem(
    itemId: string,
    data: UpdateProposalItemDto,
    user: AuthenticatedUser,
  ) {
    const item = await this.prisma.proposalItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('\u00cdtem no encontrado.');
    const proposal = await this.verifyProposalOwnership(item.proposalId, user);
    assertProposalNotLocked(proposal);
    return this.prisma.proposalItem.update({
      where: { id: itemId },
      data: {
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity,
        unitCost: data.unitCost,
        costCurrency: data.costCurrency,
        deliveryDays: data.deliveryDays,
        marginPct: data.marginPct,
        unitPrice: data.unitPrice,
        isTaxable: data.isTaxable,
        technicalSpecs: data.technicalSpecs as object | undefined,
        internalCosts: data.internalCosts as object | undefined,
      },
    });
  }

  /**
   * Lista propuestas filtradas por control de acceso basado en rol (RBAC).
   * ADMIN tiene visibilidad total; COMERCIAL solo ve las propias.
   *
   * @param {any} user - Objeto del usuario autenticado (proviene del JWT payload).
   * @returns Lista de propuestas con datos del comercial asociado.
   */
  async findAll(user: AuthenticatedUser) {
    const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };

    return this.prisma.proposal.findMany({
      where: { ...accessFilter, deletedAt: null },
      include: {
        user: { select: { name: true, nomenclature: true } },
        scenarios: {
          include: {
            scenarioItems: {
              where: { parentId: null },
              include: {
                item: true,
                children: { include: { item: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Clona una propuesta existente incluyendo ítems y escenarios.
   * NEW_VERSION: incrementa la versión (COT-LM0001-1 → COT-LM0001-2), conserva consecutiveSource.
   * NEW_PROPOSAL: genera nuevo código secuencial (COT-LM0002-1), siempre AUTO.
   */
  async cloneProposal(
    id: string,
    userId: string,
    cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL',
    user: AuthenticatedUser,
  ) {
    await this.verifyProposalOwnership(id, user);
    const original = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: true,
        scenarios: {
          include: {
            scenarioItems: {
              include: { children: true },
            },
          },
        },
      },
    });

    if (!original) throw new NotFoundException('Propuesta no encontrada.');

    return this.prisma.$transaction(async (tx) => {
      let newCode: string;

      if (cloneType === 'NEW_VERSION') {
        const groupPrefix = this.extractVersionGroupPrefix(
          original.proposalCode,
        );

        if (groupPrefix) {
          const groupCodes = await tx.proposal.findMany({
            where: { proposalCode: { startsWith: groupPrefix } },
            select: { proposalCode: true },
          });
          const maxVersion = this.calculateMaxVersion(groupCodes, groupPrefix);
          newCode = `${groupPrefix}${maxVersion + 1}`;

          await tx.proposal.updateMany({
            where: { proposalCode: { startsWith: groupPrefix } },
            data: { isLocked: true },
          });
        } else {
          newCode = `${original.proposalCode}-2`;
        }
      } else {
        const cloneUser = await this.validateUserAccess(userId);
        newCode = await this.generateProposalCode(
          cloneUser.nomenclature,
          userId,
        );
      }

      const clonedConsecutiveSource =
        cloneType === 'NEW_VERSION'
          ? original.consecutiveSource
          : ConsecutiveSource.AUTO;

      const ownerUserId =
        cloneType === 'NEW_VERSION' ? original.userId : userId;

      const cloned = await tx.proposal.create({
        data: {
          proposalCode: newCode,
          consecutiveSource: clonedConsecutiveSource,
          userId: ownerUserId,
          clientId: original.clientId,
          clientName: original.clientName,
          subject: original.subject,
          issueDate: new Date(),
          validityDays: original.validityDays,
          validityDate: original.validityDate,
          status: ProposalStatus.ELABORACION,
          isLocked: false,
        },
      });

      // Clone proposal items, mapping old IDs to new IDs
      const itemIdMap = new Map<string, string>();
      for (const item of original.proposalItems) {
        const newItem = await tx.proposalItem.create({
          data: {
            proposalId: cloned.id,
            itemType: item.itemType,
            name: item.name,
            description: item.description,
            brand: item.brand,
            partNumber: item.partNumber,
            quantity: item.quantity,
            unitCost: item.unitCost,
            costCurrency: item.costCurrency,
            deliveryDays: item.deliveryDays,
            marginPct: item.marginPct,
            unitPrice: item.unitPrice,
            isTaxable: item.isTaxable,
            technicalSpecs: item.technicalSpecs as object | undefined,
            internalCosts: item.internalCosts as object | undefined,
            sortOrder: item.sortOrder,
          },
        });
        itemIdMap.set(item.id, newItem.id);
      }

      // Clone scenarios with items
      for (const scenario of original.scenarios) {
        const newScenario = await tx.scenario.create({
          data: {
            proposalId: cloned.id,
            name: scenario.name,
            currency: scenario.currency,
            description: scenario.description,
            sortOrder: scenario.sortOrder,
          },
        });

        // Clone root scenario items (parentId = null)
        const rootItems = scenario.scenarioItems.filter((si) => !si.parentId);
        const scenarioItemIdMap = new Map<string, string>();

        for (const si of rootItems) {
          const newItemId = itemIdMap.get(si.itemId) || si.itemId;
          const newSi = await tx.scenarioItem.create({
            data: {
              scenarioId: newScenario.id,
              itemId: newItemId,
              quantity: si.quantity,
              marginPctOverride: si.marginPctOverride,
            },
          });
          scenarioItemIdMap.set(si.id, newSi.id);
        }

        // Clone child scenario items
        const childItems = scenario.scenarioItems.filter((si) => si.parentId);
        for (const child of childItems) {
          const newParentId =
            scenarioItemIdMap.get(child.parentId!) || child.parentId;
          const newItemId = itemIdMap.get(child.itemId) || child.itemId;
          await tx.scenarioItem.create({
            data: {
              scenarioId: newScenario.id,
              itemId: newItemId,
              parentId: newParentId,
              quantity: child.quantity,
              marginPctOverride: child.marginPctOverride,
            },
          });
        }
      }

      return cloned;
    });
  }

  /**
   * Soft delete: marca deletedAt en lugar de borrar fisicamente.
   * La propuesta queda inaccesible (verifyProposalOwnership la rechaza) y se
   * recupera desde la papelera con restoreProposal. No toca dependencias.
   * El candado isLocked solo aplica a COMMERCIAL; ADMIN elimina cualquier
   * version, incluidas las historicas bloqueadas (ADR-034).
   */
  async deleteProposal(id: string, user: AuthenticatedUser) {
    const proposal = await this.verifyProposalOwnership(id, user);
    if (user.role !== 'ADMIN') assertProposalNotLocked(proposal);
    return this.prisma.proposal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Lista las propuestas eliminadas (papelera). Solo ADMIN.
   * Sin filtro de owner: el admin recupera cualquier propuesta.
   */
  async findDeleted() {
    return this.prisma.proposal.findMany({
      where: { deletedAt: { not: null } },
      include: {
        user: { select: { name: true, nomenclature: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Restaura una propuesta eliminada (deletedAt -> null). Solo ADMIN.
   * Query directo: verifyProposalOwnership rechazaria una eliminada.
   * Conserva isLocked. Falla si no existe o si no estaba eliminada.
   */
  async restoreProposal(id: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
    if (!proposal.deletedAt) {
      throw new BadRequestException('La propuesta no est\u00e1 eliminada.');
    }
    return this.prisma.proposal.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Extrae el prefijo del grupo de versiones de un proposalCode.
   * Ej: 'COT-LMA05001-3' → 'COT-LMA05001-'
   */
  private extractVersionGroupPrefix(
    proposalCode: string | null,
  ): string | null {
    if (!proposalCode) return null;
    const lastDashIndex = proposalCode.lastIndexOf('-');
    if (lastDashIndex === -1) return null;
    const suffix = proposalCode.substring(lastDashIndex + 1);
    if (!/^\d+$/.test(suffix)) return null;
    return proposalCode.substring(0, lastDashIndex + 1);
  }

  /**
   * Calcula la versión máxima dentro de un grupo de propuestas.
   */
  private calculateMaxVersion(
    groupCodes: { proposalCode: string | null }[],
    groupPrefix: string,
  ): number {
    return groupCodes.reduce((max, row) => {
      if (!row.proposalCode) return max;
      const suffix = row.proposalCode.substring(groupPrefix.length);
      const version = parseInt(suffix, 10);
      return Number.isNaN(version) ? max : Math.max(max, version);
    }, 0);
  }
}
