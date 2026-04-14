import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateCsvCellValue } from '../common/upload-validation';
import type { CreateClientDto, UpdateClientDto } from './dto/clients.dto';

/**
 * @interface ISearchResponse
 * Define la estructura de respuesta para las búsquedas de clientes.
 */
export interface ISearchResponse {
  results: Array<{ id: string; name: string; nit?: string }>;
  suggestion: string | null;
}

/**
 * @class ClientsService
 * Servicio de búsqueda inteligente de clientes con ranking de relevancia.
 * Implementa tokenización, priorización por coincidencia y sugerencias tipo Google.
 */
@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Realiza una búsqueda de clientes con ranking de relevancia.
   * 
   * @param {string} query - Término de búsqueda.
   * @returns {Promise<ISearchResponse>} Resultados rankeados y sugerencias.
   * 
   * @description
   * El ranking funciona así:
   * 1. Prioridad ALTA: Nombres que EMPIEZAN por el término buscado.
   * 2. Prioridad MEDIA: Nombres que CONTIENEN el término como palabra completa.
   * 3. Prioridad BAJA: Nombres que CONTIENEN el término en cualquier parte.
   */
  async search(query: string): Promise<ISearchResponse> {
    const normalizedQuery = query?.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
    const rawQuery = normalizedQuery.toUpperCase();

    if (rawQuery.trim().length < 2) {
      return { results: [], suggestion: null };
    }

    try {
      const results = await this.findWithRelevanceRanking(rawQuery);

      if (results.length > 0) {
        return { results, suggestion: null };
      }

      // Si no hay resultados directos, buscamos sugerencia inteligente
      const suggestion = await this.getSmartSuggestion(rawQuery.trim());
      return { results: [], suggestion };
    } catch (error) {
      this.logger.error(`Error en búsqueda: "${query}": ${error instanceof Error ? error.message : String(error)}`);
      return { results: [], suggestion: null };
    }
  }

  /**
   * Busca clientes con ranking de relevancia.
   * Obtiene un pool amplio y lo ordena por prioridad antes de devolverlo.
   * @private
   */
  private async findWithRelevanceRanking(query: string) {
    const terms = query.split(' ').filter(t => t.length > 0);
    const searchTerm = query.trim();

    // Traemos un pool más grande para luego rankear
    const candidates = await this.prisma.client.findMany({
      where: {
        AND: terms.map(term => ({
          name: { contains: term, mode: 'insensitive' },
        })),
        isActive: true,
      },
      take: 100,
      select: { id: true, name: true, nit: true },
    });

    // Asignar puntaje de relevancia a cada candidato
    const scored = candidates.map(client => ({
      ...client,
      score: this.calculateRelevanceScore(client.name, searchTerm),
    }));

    // Ordenar por relevancia descendente y devolver los top 15
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 15).map(({ score, ...client }) => client);
  }

  /**
   * Calcula un puntaje de relevancia para ranking de resultados.
   * 
   * @param {string} clientName - Nombre del cliente en la BD.
   * @param {string} searchTerm - Término que buscó el usuario.
   * @returns {number} Puntaje de 0 a 100 donde más alto = más relevante.
   * @private
   */
  private calculateRelevanceScore(clientName: string, searchTerm: string): number {
    const name = clientName.toUpperCase();
    const term = searchTerm.toUpperCase();
    let score = 0;

    // +50 si el nombre EMPIEZA por el término (máxima relevancia)
    if (name.startsWith(term)) {
      score += 50;
    }

    // +30 si alguna PALABRA del nombre empieza por el término
    const words = name.split(/\s+/);
    if (words.some(word => word.startsWith(term))) {
      score += 30;
    }

    // +20 si la longitud del nombre es similar al término (nombres cortos = más precisos)
    const lengthRatio = term.length / name.length;
    score += Math.round(lengthRatio * 20);

    // +10 si es una coincidencia exacta del nombre completo
    if (name === term) {
      score += 10;
    }

    return score;
  }

  /**
   * Motor de sugerencias "¿Quisiste decir...?" basado en similitud de bigramas.
   * @private
   */
  private async getSmartSuggestion(query: string): Promise<string | null> {
    if (query.length < 3) return null;

    const firstChar = query.charAt(0);
    const candidates = await this.prisma.client.findMany({
      where: {
        name: { startsWith: firstChar, mode: 'insensitive' },
        isActive: true,
      },
      take: 1000,
      select: { name: true },
    });

    if (candidates.length === 0) return null;

    const bestMatch = this.findBestSimilarityMatch(query, candidates.map(c => c.name));
    return bestMatch.score > 0.45 ? bestMatch.target : null;
  }

  /**
   * Compara contra múltiples candidatos y devuelve la mejor coincidencia.
   * @private
   */
  private findBestSimilarityMatch(mainString: string, targetStrings: string[]) {
    let bestMatch = { target: null, score: 0 };

    for (const target of targetStrings) {
      const score = this.calculateDiceCoefficient(mainString, target);
      if (score > bestMatch.score) {
        bestMatch = { target, score };
      }
      if (score > 0.95) break;
    }

    return bestMatch;
  }

  /**
   * Coeficiente de Sørensen–Dice para similitud textual.
   * @private
   */
  private calculateDiceCoefficient(s1: string, s2: string): number {
    const getPairs = (str: string) => {
      const pairs = new Set<string>();
      const sanitized = str.replace(/\s+/g, '');
      for (let i = 0; i < sanitized.length - 1; i++) {
        pairs.add(sanitized.substring(i, i + 2));
      }
      return pairs;
    };

    const pairs1 = getPairs(s1);
    const pairs2 = getPairs(s2);
    if (pairs1.size === 0 || pairs2.size === 0) return 0;

    const intersection = new Set([...pairs1].filter(x => pairs2.has(x)));
    return (2.0 * intersection.size) / (pairs1.size + pairs2.size);
  }

  // ─── MÉTODOS ADMIN ───────────────────────────────────────────

  /** Default page size for paginated admin queries. */
  private static readonly DEFAULT_PAGE_SIZE = 50;

  /**
   * Lista clientes con paginación y búsqueda opcional por nombre.
   * Incluye clientes inactivos para gestión admin.
   *
   * @returns Objeto con `data` (página actual) y `meta` (total, page, pageSize, totalPages).
   */
  async findAllAdmin(query?: string, page = 1, pageSize = ClientsService.DEFAULT_PAGE_SIZE) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 200);
    const skip = (safePage - 1) * safePageSize;

    const where = query
      ? { name: { contains: query, mode: 'insensitive' as const } }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize),
      },
    };
  }

  /**
   * Crea un nuevo cliente. Lanza ConflictException si el nombre ya existe.
   */
  async createClient(dto: CreateClientDto) {
    const existingClient = await this.prisma.client.findUnique({
      where: { name: dto.name },
    });

    if (existingClient) {
      throw new ConflictException(`Ya existe un cliente con el nombre "${dto.name}".`);
    }

    return this.prisma.client.create({ data: dto });
  }

  /**
   * Actualiza nombre, NIT o estado activo de un cliente.
   */
  async updateClient(id: string, dto: UpdateClientDto) {
    return this.prisma.client.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Hard-delete: elimina el cliente de la base de datos.
   */
  async removeClient(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }

  /**
   * Elimina múltiples clientes por sus IDs.
   */
  async bulkRemove(ids: string[]): Promise<{ deleted: number }> {
    const result = await this.prisma.client.deleteMany({
      where: { id: { in: ids } },
    });
    return { deleted: result.count };
  }

  /**
   * Crea múltiples clientes de una vez, ignorando duplicados.
   * Valida cada valor contra CSV injection antes de insertar (rechaza si detecta inyección).
   */
  async bulkCreate(items: CreateClientDto[]) {
    const validatedItems = items.map(item => {
      const name = String(item.name || '').trim();
      const nit = item.nit ? String(item.nit).trim() : undefined;
      validateCsvCellValue(name);
      if (nit) validateCsvCellValue(nit);
      return { name, ...(nit ? { nit } : {}) };
    });

    const result = await this.prisma.client.createMany({
      data: validatedItems,
      skipDuplicates: true,
    });

    this.logger.log(`Bulk create clientes: ${result.count} creados (${items.length} enviados)`);

    return { created: result.count, sent: items.length };
  }
}

