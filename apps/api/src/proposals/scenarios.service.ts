import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizePlainText } from '../common/sanitize';
import { assertProposalNotLocked } from './proposals-lock.helper';
import {
    CreateScenarioDto,
    UpdateScenarioDto,
    AddScenarioItemDto,
    UpdateScenarioItemDto,
    ReorderScenarioItemsDto,
} from './dto/proposals.dto';


@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Verifica ownership a través de un escenario.
   * Busca el scenario → obtiene proposalId → verifica ownership.
   */
  private async verifyScenarioOwnership(scenarioId: string, user: AuthenticatedUser) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Escenario no encontrado.');
    const proposal = await this.proposalsService.verifyProposalOwnership(scenario.proposalId, user);
    assertProposalNotLocked(proposal);
    return scenario;
  }

  /**
   * Recupera todos los escenarios para una propuesta con sus ítems asociados.
   */
  async getScenariosByProposalId(proposalId: string, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    return this.prisma.scenario.findMany({
      where: { proposalId },
      include: {
        scenarioItems: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            item: true,
            children: {
              include: { item: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea un nuevo escenario para una propuesta.
   */
  async createScenario(proposalId: string, data: CreateScenarioDto, user: AuthenticatedUser) {
    const proposal = await this.proposalsService.verifyProposalOwnership(proposalId, user);
    assertProposalNotLocked(proposal);
    const aggregate = await this.prisma.scenario.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.scenario.create({
      data: {
        proposalId,
        name: data.name,
        currency: data.currency || 'COP',
        conversionTrm: data.conversionTrm ?? undefined,
        description: data.description ? sanitizePlainText(data.description) : undefined,
        sortOrder: nextOrder
      }
    });
  }

  /**
   * Actualiza un escenario existente.
   */
  async updateScenario(id: string, data: UpdateScenarioDto, user: AuthenticatedUser) {
    const scenario = await this.verifyScenarioOwnership(id, user);

    const updateData = {
      name: data.name,
      currency: data.currency,
      conversionTrm: data.conversionTrm,
      description: data.description ? sanitizePlainText(data.description) : data.description,
    };

    const isCurrencyChanging =
      data.currency !== undefined && data.currency !== scenario.currency;

    if (isCurrencyChanging) {
      return this.prisma.$transaction(async (tx) => {
        await tx.scenarioItem.updateMany({
          where: { scenarioId: id },
          data: { unitPriceOverride: null },
        });
        return tx.scenario.update({ where: { id }, data: updateData });
      });
    }

    return this.prisma.scenario.update({ where: { id }, data: updateData });
  }

  /**
   * Elimina un escenario.
   * La cascada (onDelete: Cascade) elimina automáticamente los scenarioItems.
   */
  async deleteScenario(id: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(id, user);
    return this.prisma.scenario.delete({ where: { id } });
  }

  /**
   * Clona un escenario existente con todos sus ítems y sub-ítems.
   */
  async cloneScenario(scenarioId: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    const original = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        scenarioItems: {
          include: { children: true },
        },
      },
    });

    if (!original) throw new NotFoundException('Escenario no encontrado.');

    const aggregate = await this.prisma.scenario.aggregate({
      where: { proposalId: original.proposalId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    const cloned = await this.prisma.scenario.create({
      data: {
        proposalId: original.proposalId,
        name: `${original.name} (Copia)`,
        currency: original.currency,
        conversionTrm: original.conversionTrm,
        description: original.description,
        sortOrder: nextOrder,
      },
    });

    // Clone root items (parentId = null)
    const rootItems = original.scenarioItems.filter(si => !si.parentId);
    const siIdMap = new Map<string, string>();

    for (const si of rootItems) {
      const newSi = await this.prisma.scenarioItem.create({
        data: {
          scenarioId: cloned.id,
          itemId: si.itemId,
          quantity: si.quantity,
          marginPctOverride: si.marginPctOverride,
          unitPriceOverride: si.unitPriceOverride,
          isDiluted: si.isDiluted,
          sortOrder: si.sortOrder,
        },
      });
      siIdMap.set(si.id, newSi.id);
    }

    // Clone child items
    const childItems = original.scenarioItems.filter(si => si.parentId);
    for (const child of childItems) {
      const newParentId = siIdMap.get(child.parentId!) || child.parentId;
      await this.prisma.scenarioItem.create({
        data: {
          scenarioId: cloned.id,
          itemId: child.itemId,
          parentId: newParentId,
          quantity: child.quantity,
          marginPctOverride: child.marginPctOverride,
          unitPriceOverride: child.unitPriceOverride,
          isDiluted: child.isDiluted,
        },
      });
    }

    // Return the full cloned scenario with items
    return this.prisma.scenario.findUnique({
      where: { id: cloned.id },
      include: {
        scenarioItems: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            item: true,
            children: { include: { item: true } },
          },
        },
      },
    });
  }

  /**
   * Vincula un item de propuesta a un escenario.
   */
  async addScenarioItem(scenarioId: string, data: AddScenarioItemDto, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);

    const isParent = data.parentId === null || data.parentId === undefined;
    let nextOrder = 0;
    if (isParent) {
      const aggregate = await this.prisma.scenarioItem.aggregate({
        where: { scenarioId, parentId: null },
        _max: { sortOrder: true },
      });
      nextOrder = (aggregate._max.sortOrder || 0) + 1;
    }

    return this.prisma.scenarioItem.create({
      data: {
        scenarioId,
        itemId: data.itemId,
        parentId: data.parentId ?? undefined,
        quantity: data.quantity || 1,
        marginPctOverride: data.marginPct ?? undefined,
        ...(isParent ? { sortOrder: nextOrder } : {}),
      },
      include: {
        item: true,
        children: { include: { item: true } },
      },
    });
  }

  /**
   * Actualiza un ítem dentro de un escenario.
   */
  async updateScenarioItem(id: string, data: UpdateScenarioItemDto, user: AuthenticatedUser) {
    const scenarioItem = await this.prisma.scenarioItem.findUnique({ where: { id } });
    if (!scenarioItem) throw new NotFoundException('\u00cdtem de escenario no encontrado.');
    await this.verifyScenarioOwnership(scenarioItem.scenarioId, user);
    return this.prisma.scenarioItem.update({
      where: { id },
      data: {
        quantity: data.quantity,
        marginPctOverride: data.marginPct,
        unitPriceOverride: data.unitPriceOverride === undefined
          ? undefined
          : data.unitPriceOverride,
        isDiluted: data.isDiluted,
      }
    });
  }

  /**
   * Elimina un ítem específico de un escenario.
   */
  async removeScenarioItem(id: string, user: AuthenticatedUser) {
    const scenarioItem = await this.prisma.scenarioItem.findUnique({ where: { id } });
    if (!scenarioItem) throw new NotFoundException('\u00cdtem de escenario no encontrado.');
    await this.verifyScenarioOwnership(scenarioItem.scenarioId, user);
    // Cascade: delete children first, then the item itself
    await this.prisma.scenarioItem.deleteMany({ where: { parentId: id } });
    return this.prisma.scenarioItem.delete({ where: { id } });
  }

  /**
   * Aplica un margen global a todos los ítems de un escenario específico.
   * Esto sobreescribe cualquier margen individual previo.
   */
  async applyMarginToEntireScenario(scenarioId: string, marginPct: number, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    return this.prisma.scenarioItem.updateMany({
      where: { scenarioId },
      data: {
        marginPctOverride: marginPct,
        unitPriceOverride: null,
      }
    });
  }

  /**
   * Reordena los ítems padre de un escenario.
   */
  async reorderScenarioItems(scenarioId: string, data: ReorderScenarioItemsDto, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);

    const count = await this.prisma.scenarioItem.count({
      where: { id: { in: data.itemIds }, scenarioId, parentId: null },
    });
    if (count !== data.itemIds.length) {
      throw new BadRequestException('IDs de ítems inválidos para este escenario.');
    }

    await this.prisma.$transaction(
      data.itemIds.map((id, index) =>
        this.prisma.scenarioItem.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    return this.prisma.scenarioItem.findMany({
      where: { scenarioId, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        item: true,
        children: { include: { item: true } },
      },
    });
  }
}
