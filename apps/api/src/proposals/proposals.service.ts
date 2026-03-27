import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProposalStatus, BlockType, PageType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import {
    CreateProposalDto,
    UpdateProposalDto,
    CreateProposalItemDto,
    UpdateProposalItemDto,
    CreateScenarioDto,
    UpdateScenarioDto,
    AddScenarioItemDto,
    UpdateScenarioItemDto,
    CreatePageDto,
    UpdatePageDto,
    ReorderPagesDto,
    CreateBlockDto,
    UpdateBlockDto,
    ReorderBlocksDto,
} from './dto/proposals.dto';


@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca propuestas recientes (último año) que coincidan parcial o totalmente 
   * con el término de búsqueda, ya sea en el nombre del cliente o en el asunto.
   * 
   * @param {string} query - Término de búsqueda (Nombre o parte del nombre).
   * @returns {Promise<any[]>} Lista de propuestas que podrían representar un cruce de cuenta.
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
          { subject: { contains: normalizedQuery, mode: 'insensitive' } }
        ],
        createdAt: { gte: oneYearAgo },
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
   * 
   * @param {string} userId - ID del usuario comercial que crea la oferta.
   * @param {ICreateProposalInput} data - Payload con la información de la propuesta.
   * @throws {NotFoundException} Si el usuario no existe.
   */
  async createProposal(userId: string, data: CreateProposalDto) {
    try {
      const user = await this.validateUserAccess(userId);
      const clientId = await this.ensureClientExists(data.clientName, data.clientId);
      const proposalCode = await this.generateProposalCode(user.nomenclature, userId);

      return await this.prisma.proposal.create({
        data: {
          proposalCode,
          userId,
          clientId,
          clientName: data.clientName.trim().toUpperCase(),
          subject: data.subject,
          issueDate: new Date(data.issueDate),
          validityDays: typeof data.validityDays === 'string' ? parseInt(data.validityDays, 10) : data.validityDays,
          validityDate: new Date(data.validityDate),
          status: ProposalStatus.ELABORACION,
        },
      });
    } catch (error) {
      this.logger.error(`Falla al crear propuesta para usuario ${userId}: ${error.message}`);
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
      throw new NotFoundException(`El usuario con ID ${userId} no fue encontrado en el sistema.`);
    }
    
    return user;
  }

  /**
   * Garantiza que el cliente esté registrado en la base de datos centralizada (Master Data).
   * Implementa un patrón Upsert para evitar duplicidad de nombres normalizados.
   * @private
   */
  private async ensureClientExists(name: string, existingId?: string): Promise<string> {
    const normalizedName = name.trim().toUpperCase();
    
    // Si ya tenemos un ID verificado, lo usamos directamente (OCP)
    if (existingId) return existingId;

    // Si no, realizamos un registro automático
    const client = await this.prisma.client.upsert({
      where: { name: normalizedName },
      update: {}, 
      create: {
        name: normalizedName,
        isActive: true
      }
    });

    return client.id;
  }

  /**
   * Genera un código de propuesta único siguiendo el estándar corporativo COT-[NOMENCLATURA][SECUENCIAL]-[VERSION].
   * @private
   */
  private async generateProposalCode(nomenclature: string, userId: string): Promise<string> {
    const prefix = nomenclature || 'XX';
    
    // Buscamos la última propuesta de este usuario para obtener el número secuencial más alto
    const lastProposal = await this.prisma.proposal.findFirst({
      where: { userId },
      orderBy: { proposalCode: 'desc' },
      select: { proposalCode: true }
    });
    
    let nextNumber = 1;
    
    if (lastProposal?.proposalCode) {
      // Extraemos el número del formato COT-PREFIX0001-1 usando regex
      // El patrón busca dígitos antes del guion de la versión final
      const match = lastProposal.proposalCode.match(/(\d+)-\d+$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const sequential = nextNumber.toString().padStart(4, '0');
    
    // El "-1" representa la versión inicial del borrador
    return `COT-${prefix}${sequential}-1`;
  }

  /**
   * Recupera una propuesta con sus ítems asociados para edición.
   */
  async getProposalById(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
    return proposal;
  }

  /**
   * Actualiza los datos generales de una propuesta existente.
   * 
   * @param {string} id - UUID de la propuesta.
   * @param {any} data - Nuevos datos (asunto, fechas, etc).
   */
  async updateProposal(id: string, data: UpdateProposalDto) {
    return this.prisma.proposal.update({
      where: { id },
      data: {
        subject: data.subject,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        validityDays: data.validityDays ?? undefined,
        validityDate: data.validityDate ? new Date(data.validityDate) : undefined,
        status: data.status ?? undefined,
        closeDate: data.closeDate ? new Date(data.closeDate) : data.closeDate === null ? null : undefined,
        billingDate: data.billingDate ? new Date(data.billingDate) : data.billingDate === null ? null : undefined,
      },
    });
  }

  /**
   * Añade un nuevo ítem (producto/servicio) a la propuesta.
   * Gestiona el correlativo de orden (sortOrder) automáticamente.
   */
  async addProposalItem(proposalId: string, data: CreateProposalItemDto) {
    const aggregate = await this.prisma.proposalItem.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
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
        marginPct: data.marginPct || 0,
        unitPrice: data.unitPrice || 0,
        isTaxable: data.isTaxable ?? true,
        technicalSpecs: (data.technicalSpecs || {}) as object,
        internalCosts: (data.internalCosts || {}) as object,
        sortOrder: nextOrder,
      }
    });
  }

  /**
   * Elimina un ítem específico de una propuesta.
   */
  async removeProposalItem(itemId: string) {
    return this.prisma.proposalItem.delete({
      where: { id: itemId }
    });
  }

  /**
   * Actualiza un ítem específico de una propuesta.
   */
  async updateProposalItem(itemId: string, data: UpdateProposalItemDto) {
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
        marginPct: data.marginPct,
        unitPrice: data.unitPrice,
        isTaxable: data.isTaxable,
        technicalSpecs: data.technicalSpecs as object | undefined,
        internalCosts: data.internalCosts as object | undefined,
      }
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
      where: accessFilter,
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
   * NEW_VERSION: incrementa la versión (COT-LM0001-1 → COT-LM0001-2)
   * NEW_PROPOSAL: genera nuevo código secuencial (COT-LM0002-1)
   */
  async cloneProposal(id: string, userId: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') {
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

    let newCode: string;

    if (cloneType === 'NEW_VERSION') {
      // Increment version: COT-LM0001-1 → COT-LM0001-2
      const baseParts = original.proposalCode?.match(/^(.+)-(\d+)$/);
      if (baseParts) {
        const nextVersion = parseInt(baseParts[2], 10) + 1;
        newCode = `${baseParts[1]}-${nextVersion}`;
      } else {
        newCode = `${original.proposalCode}-2`;
      }
    } else {
      // NEW_PROPOSAL: Generate new sequential code
      const user = await this.validateUserAccess(userId);
      newCode = await this.generateProposalCode(user.nomenclature, userId);
    }

    // Create the new proposal
    const cloned = await this.prisma.proposal.create({
      data: {
        proposalCode: newCode,
        userId,
        clientId: original.clientId,
        clientName: original.clientName,
        subject: original.subject,
        issueDate: new Date(),
        validityDays: original.validityDays,
        validityDate: original.validityDate,
        status: ProposalStatus.ELABORACION,
      },
    });

    // Clone proposal items, mapping old IDs to new IDs
    const itemIdMap = new Map<string, string>();
    for (const item of original.proposalItems) {
      const newItem = await this.prisma.proposalItem.create({
        data: {
          proposalId: cloned.id,
          itemType: item.itemType,
          name: item.name,
          description: item.description,
          brand: item.brand,
          partNumber: item.partNumber,
          quantity: item.quantity,
          unitCost: item.unitCost,
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
      const newScenario = await this.prisma.scenario.create({
        data: {
          proposalId: cloned.id,
          name: scenario.name,
          currency: scenario.currency,
          description: scenario.description,
          sortOrder: scenario.sortOrder,
        },
      });

      // Clone root scenario items (parentId = null)
      const rootItems = scenario.scenarioItems.filter(si => !si.parentId);
      const scenarioItemIdMap = new Map<string, string>();

      for (const si of rootItems) {
        const newItemId = itemIdMap.get(si.itemId) || si.itemId;
        const newSi = await this.prisma.scenarioItem.create({
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
      const childItems = scenario.scenarioItems.filter(si => si.parentId);
      for (const child of childItems) {
        const newParentId = scenarioItemIdMap.get(child.parentId!) || child.parentId;
        const newItemId = itemIdMap.get(child.itemId) || child.itemId;
        await this.prisma.scenarioItem.create({
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
  }

  /**
   * Elimina una propuesta completa y sus dependencias.
   * Implementa limpieza manual de ítems previa a la eliminación de la cabecera.
   */
  async deleteProposal(id: string) {
    // Delete linked scenario items first
    await this.prisma.scenarioItem.deleteMany({
      where: { scenario: { proposalId: id } }
    });

    // Delete scenarios
    await this.prisma.scenario.deleteMany({
      where: { proposalId: id }
    });

    // Delete regular items
    await this.prisma.proposalItem.deleteMany({
      where: { proposalId: id },
    });

    // Delete proposal
    return this.prisma.proposal.delete({
      where: { id },
    });
  }

  /**
   * Obtiene valores extra de TRM (Promedio SET-ICAP y Spot Wilkinson)
   */
  async getExtraTrmValues() {
    const today = new Date().toISOString().split('T')[0];
    const results = {
      setIcapAverage: null,
      wilkinsonSpot: null
    };

    // 1. SET-ICAP Average (POST API)
    try {
      const setIcapRes = await axios.post('https://proxy.set-icap.com/seticap/api/estadisticas/estadisticasPromedioCierre/', {
        fecha: today,
        mercado: 71,
        delay: 15
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://dolar.set-icap.com/'
        },
        timeout: 5000
      });
      if (setIcapRes.data?.data?.avg) {
        results.setIcapAverage = this.parseCurrencyString(setIcapRes.data.data.avg);
      }
    } catch (e) {
      this.logger.error(`Error fetching SET-ICAP average: ${(e as Error).message}`);
    }

    // 2. Wilkinson Spot Average (Scraping)
    try {
      const wilkinsonRes = await axios.get('https://dolar.wilkinsonpc.com.co/dolar-hoy-spot-minuto-a-minuto/', {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        },
        timeout: 5000
      });
      const $ = cheerio.load(wilkinsonRes.data);
      const spotText = $('.display-5.fw-bold.text-dark.lh-1.my-1 span').first().text();
      if (spotText) {
        results.wilkinsonSpot = this.parseCurrencyString(spotText);
      }
    } catch (e) {
      this.logger.error(`Error fetching Wilkinson spot: ${(e as Error).message}`);
    }

    return results;
  }

  /**
   * Normaliza y parsea cadenas de moneda (pudiendo tener . o , como separadores)
   */
  private parseCurrencyString(val: string): number {
    if (!val) return 0;
    // Remueve todo menos dígitos, puntos y comas
    let clean = val.replace(/[^0-9.,]/g, '');
    
    // Si tiene coma Y punto: la última suele ser el decimal
    const lastComma = clean.lastIndexOf(',');
    const lastPoint = clean.lastIndexOf('.');
    
    if (lastComma > lastPoint) {
      // Formato latino 3.704,17
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (lastPoint > lastComma) {
      // Formato USA 3,704.17
      clean = clean.replace(/,/g, '');
    } else {
      // Solo uno de los dos o ninguno
      if (lastComma !== -1) clean = clean.replace(',', '.');
    }
    
    return parseFloat(clean);
  }

  // --- MÉTODOS DE ESCENARIOS ---

  /**
   * Recupera todos los escenarios para una propuesta con sus ítems asociados.
   */
  async getScenariosByProposalId(proposalId: string) {
    return this.prisma.scenario.findMany({
      where: { proposalId },
      include: {
        scenarioItems: {
          where: { parentId: null },
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
  async createScenario(proposalId: string, data: CreateScenarioDto) {
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
        description: data.description,
        sortOrder: nextOrder
      }
    });
  }

  /**
   * Actualiza un escenario existente.
   */
  async updateScenario(id: string, data: UpdateScenarioDto) {
    return this.prisma.scenario.update({
      where: { id },
      data: {
        name: data.name,
        currency: data.currency,
        description: data.description
      }
    });
  }

  /**
   * Elimina un escenario y sus items vinculados.
   */
  async deleteScenario(id: string) {
    await this.prisma.scenarioItem.deleteMany({ where: { scenarioId: id } });
    return this.prisma.scenario.delete({ where: { id } });
  }

  /**
   * Clona un escenario existente con todos sus ítems y sub-ítems.
   */
  async cloneScenario(scenarioId: string) {
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
          isDilpidate: si.isDilpidate,
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
          isDilpidate: child.isDilpidate,
        },
      });
    }

    // Return the full cloned scenario with items
    return this.prisma.scenario.findUnique({
      where: { id: cloned.id },
      include: {
        scenarioItems: {
          where: { parentId: null },
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
  async addScenarioItem(scenarioId: string, data: AddScenarioItemDto) {
    return this.prisma.scenarioItem.create({
      data: {
        scenarioId,
        itemId: data.itemId,
        parentId: data.parentId ?? undefined,
        quantity: data.quantity || 1,
        marginPctOverride: data.marginPct ?? undefined,
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
  async updateScenarioItem(id: string, data: UpdateScenarioItemDto) {
    return this.prisma.scenarioItem.update({
      where: { id },
      data: {
        quantity: data.quantity,
        marginPctOverride: data.marginPct,
        isDilpidate: data.isDilpidate,
      }
    });
  }

  /**
   * Elimina un ítem específico de un escenario.
   */
  async removeScenarioItem(id: string) {
    // Cascade: delete children first, then the item itself
    await this.prisma.scenarioItem.deleteMany({ where: { parentId: id } });
    return this.prisma.scenarioItem.delete({ where: { id } });
  }

  /**
   * Aplica un margen global a todos los ítems de un escenario específico.
   * Esto sobreescribe cualquier margen individual previo.
   */
  async applyMarginToEntireScenario(scenarioId: string, marginPct: number) {
    return this.prisma.scenarioItem.updateMany({
      where: { scenarioId },
      data: {
        marginPctOverride: marginPct
      }
    });
  }

  // --- MÉTODOS DE PÁGINAS DE PROPUESTA ---

  /**
   * Inicializa las páginas predeterminadas para una propuesta.
   */
  async initializeDefaultPages(proposalId: string) {
    const existingLocked = await this.prisma.proposalPage.findMany({
      where: { proposalId, isLocked: true },
      select: { pageType: true },
    });
    const existingTypes = new Set(existingLocked.map(p => p.pageType));

    const defaults: { pageType: PageType; title: string; sortOrder: number }[] = [
      { pageType: 'COVER', title: 'Portada', sortOrder: 1 },
      { pageType: 'INTRO', title: 'Introducción', sortOrder: 2 },
      { pageType: 'TERMS', title: 'Términos y Condiciones', sortOrder: 1000 },
    ];

    for (const page of defaults) {
      if (!existingTypes.has(page.pageType)) {
        await this.prisma.proposalPage.create({
          data: { proposalId, ...page, isLocked: true },
        });
      }
    }

    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Retorna todas las páginas con sus bloques para una propuesta.
   */
  async getPagesByProposalId(proposalId: string) {
    return this.prisma.proposalPage.findMany({
      where: { proposalId },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea una página personalizada.
   */
  async createCustomPage(proposalId: string, data: CreatePageDto) {
    // Insert before TERMS (sortOrder 1000) but after everything else
    const aggregate = await this.prisma.proposalPage.aggregate({
      where: { proposalId, pageType: { not: 'TERMS' } },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalPage.create({
      data: {
        proposalId,
        pageType: 'CUSTOM',
        title: data.title,
        isLocked: false,
        sortOrder: nextOrder,
      },
      include: { blocks: true },
    });
  }

  /**
   * Actualiza una página (título o variables).
   */
  async updatePage(pageId: string, data: UpdatePageDto) {
    return this.prisma.proposalPage.update({
      where: { id: pageId },
      data: {
        title: data.title,
        variables: data.variables as object | undefined,
      },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  /**
   * Elimina una página (solo si no es predeterminada).
   */
  async deletePage(pageId: string) {
    const page = await this.prisma.proposalPage.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Página no encontrada.');
    if (page.isLocked) throw new Error('No se puede eliminar una página predeterminada.');

    await this.prisma.proposalPageBlock.deleteMany({ where: { pageId } });
    return this.prisma.proposalPage.delete({ where: { id: pageId } });
  }

  /**
   * Reordena las páginas respetando las posiciones fijas de predeterminadas.
   */
  async reorderPages(proposalId: string, data: ReorderPagesDto) {
    const updates = data.pageIds.map((id, index) =>
      this.prisma.proposalPage.updateMany({
        where: { id, proposalId, isLocked: false },
        data: { sortOrder: index + 100 },
      }),
    );
    await Promise.all(updates);
    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Crea un bloque dentro de una página.
   */
  async createBlock(pageId: string, data: CreateBlockDto) {
    const aggregate = await this.prisma.proposalPageBlock.aggregate({
      where: { pageId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalPageBlock.create({
      data: {
        pageId,
        blockType: data.blockType as BlockType,
        content: (data.content || {}) as object,
        sortOrder: nextOrder,
      },
    });
  }

  /**
   * Actualiza el contenido de un bloque.
   */
  async updateBlock(blockId: string, data: UpdateBlockDto) {
    return this.prisma.proposalPageBlock.update({
      where: { id: blockId },
      data: { content: data.content as object | undefined },
    });
  }

  /**
   * Elimina un bloque.
   */
  async deleteBlock(blockId: string) {
    return this.prisma.proposalPageBlock.delete({ where: { id: blockId } });
  }

  /**
   * Reordena los bloques dentro de una página.
   */
  async reorderBlocks(pageId: string, data: ReorderBlocksDto) {
    const updates = data.blockIds.map((id, index) =>
      this.prisma.proposalPageBlock.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    );
    await Promise.all(updates);
    return this.prisma.proposalPageBlock.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
