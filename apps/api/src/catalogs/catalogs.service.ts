import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * @class CatalogsService
 * Servicio para recuperar datos maestros y listas de valores.
 */
@Injectable()
export class CatalogsService {
  private readonly logger = new Logger(CatalogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todos los valores activos para una categoría específica.
   * 
   * @param {string} category - Nombre de la categoría (ej. FORMATO, FABRICANTE).
   * @returns Lista de valores ordenados alfabéticamente.
   */
  async findByCategory(category: string) {
    return this.prisma.catalog.findMany({
      where: { 
        category: category.toUpperCase(),
        isActive: true 
      },
      orderBy: { value: 'asc' },
      select: { value: true }
    });
  }

  /**
   * Obtiene múltiples categorías de una sola vez. Useful para inicializar formularios complejos.
   * 
   * @param {string[]} categories - Lista de categorías.
   * @returns Objeto con las listas de valores indexadas por categoría.
   */
  async findMultipleCategories(categories: string[]) {
    const results = await this.prisma.catalog.findMany({
      where: {
        category: { in: categories.map(c => c.toUpperCase()) },
        isActive: true
      },
      orderBy: { value: 'asc' },
      select: { category: true, value: true }
    });

    // Agrupar resultados por categoría
    return results.reduce((acc, current) => {
      const cat = current.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(current.value);
      return acc;
    }, {} as Record<string, string[]>);
  }
}
