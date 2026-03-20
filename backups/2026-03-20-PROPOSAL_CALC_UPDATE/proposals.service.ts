import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProposalStatus } from '@prisma/client';

/**
 * @interface ICreateProposalInput
 * DTO simplificado para la creación de una propuesta.
 */
interface ICreateProposalInput {
  userId: string;
  clientId?: string;
  clientName: string;
  subject: string;
  issueDate: string;
  validityDays: string;
  validityDate: string;
}

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
  async createProposal(userId: string, data: ICreateProposalInput) {
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
          status: ProposalStatus.DRAFT,
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
  async updateProposal(id: string, data: any) {
    return this.prisma.proposal.update({
      where: { id },
      data: {
        subject: data.subject,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        validityDays: data.validityDays ? parseInt(data.validityDays, 10) : undefined,
        validityDate: data.validityDate ? new Date(data.validityDate) : undefined,
      }
    });
  }

  /**
   * Añade un nuevo ítem (producto/servicio) a la propuesta.
   * Gestiona el correlativo de orden (sortOrder) automáticamente.
   */
  async addProposalItem(proposalId: string, data: any) {
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
        quantity: parseFloat(data.quantity) || 1,
        unitCost: parseFloat(data.unitCost) || 0,
        marginPct: parseFloat(data.marginPct) || 0,
        unitPrice: parseFloat(data.unitPrice) || 0,
        isTaxable: data.isTaxable ?? true,
        technicalSpecs: data.technicalSpecs || {},
        internalCosts: data.internalCosts || {},
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
  async updateProposalItem(itemId: string, data: any) {
    return this.prisma.proposalItem.update({
      where: { id: itemId },
      data: {
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity !== undefined ? parseFloat(data.quantity) : undefined,
        unitCost: data.unitCost !== undefined ? parseFloat(data.unitCost) : undefined,
        marginPct: data.marginPct !== undefined ? parseFloat(data.marginPct) : undefined,
        unitPrice: data.unitPrice !== undefined ? parseFloat(data.unitPrice) : undefined,
        isTaxable: data.isTaxable,
        technicalSpecs: data.technicalSpecs,
        internalCosts: data.internalCosts,
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
  async findAll(user: any) {
    // Si es ADMIN, ve todo. Si no, solo lo propio.
    const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };
    
    return this.prisma.proposal.findMany({
      where: accessFilter,
      include: {
        user: { select: { name: true, nomenclature: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
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
      console.error("Error fetching SET-ICAP average:", e.message);
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
      console.error("Error fetching Wilkinson spot:", e.message);
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
          include: {
            item: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Crea un nuevo escenario para una propuesta.
   */
  async createScenario(proposalId: string, data: any) {
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
  async updateScenario(id: string, data: any) {
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
   * Vincula un item de propuesta a un escenario.
   */
  async addScenarioItem(scenarioId: string, data: any) {
    return this.prisma.scenarioItem.create({
      data: {
        scenarioId,
        itemId: data.itemId,
        quantity: parseInt(data.quantity, 10) || 1,
        marginPctOverride: data.marginPct ? parseFloat(data.marginPct) : undefined,
      }
    });
  }

  /**
   * Actualiza un ítem dentro de un escenario.
   */
  async updateScenarioItem(id: string, data: any) {
    return this.prisma.scenarioItem.update({
      where: { id },
      data: {
        quantity: data.quantity !== undefined ? parseInt(data.quantity, 10) : undefined,
        marginPctOverride: data.marginPct !== undefined ? parseFloat(data.marginPct) : undefined,
      }
    });
  }

  /**
   * Elimina un ítem específico de un escenario.
   */
  async removeScenarioItem(id: string) {
    return this.prisma.scenarioItem.delete({
      where: { id }
    });
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
}
