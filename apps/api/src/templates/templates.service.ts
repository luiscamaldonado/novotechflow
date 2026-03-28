import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockType, PageType } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active templates ordered by sortOrder.
   */
  async findAll() {
    return this.prisma.pdfTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get one template by ID.
   */
  async findOne(id: string) {
    return this.prisma.pdfTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new default page template.
   * content stores the array of blocks: [{ blockType, content, sortOrder }]
   */
  async create(data: {
    name: string;
    templateType: PageType;
    sortOrder?: number;
    createdBy: string;
  }) {
    // Set default sortOrder based on template type if not provided
    const sortOrderMap: Record<string, number> = {
      COVER: 1,
      PRESENTATION: 2,
      COMPANY_INFO: 3,
      INDEX: 5,
      TERMS: 1000,
      CUSTOM: 100,
    };

    return this.prisma.pdfTemplate.create({
      data: {
        name: data.name,
        templateType: data.templateType,
        sortOrder: data.sortOrder ?? sortOrderMap[data.templateType] ?? 10,
        content: [], // Empty blocks array initially
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Update a template (name, sortOrder, isActive).
   */
  async update(id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.pdfTemplate.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a template.
   */
  async remove(id: string) {
    return this.prisma.pdfTemplate.delete({
      where: { id },
    });
  }

  /**
   * Add a block to a template's content array.
   */
  async addBlock(
    templateId: string,
    block: { blockType: string; content: object },
  ) {
    const template = await this.prisma.pdfTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new Error('Template not found');

    const blocks = (template.content as any[]) || [];
    const newBlock = {
      id: crypto.randomUUID(),
      blockType: block.blockType,
      content: block.content,
      sortOrder: blocks.length + 1,
    };
    blocks.push(newBlock);

    await this.prisma.pdfTemplate.update({
      where: { id: templateId },
      data: { content: blocks },
    });

    return newBlock;
  }

  /**
   * Update a block inside a template's content array.
   */
  async updateBlock(
    templateId: string,
    blockId: string,
    content: object,
  ) {
    const template = await this.prisma.pdfTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new Error('Template not found');

    const blocks = (template.content as any[]) || [];
    const idx = blocks.findIndex((b: any) => b.id === blockId);
    if (idx === -1) throw new Error('Block not found');

    blocks[idx].content = content;

    await this.prisma.pdfTemplate.update({
      where: { id: templateId },
      data: { content: blocks },
    });

    return blocks[idx];
  }

  /**
   * Delete a block from a template's content array.
   */
  async deleteBlock(templateId: string, blockId: string) {
    const template = await this.prisma.pdfTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new Error('Template not found');

    let blocks = (template.content as any[]) || [];
    blocks = blocks.filter((b: any) => b.id !== blockId);

    // Reorder
    blocks.forEach((b: any, i: number) => {
      b.sortOrder = i + 1;
    });

    await this.prisma.pdfTemplate.update({
      where: { id: templateId },
      data: { content: blocks },
    });

    return { success: true };
  }

  /**
   * Upload image for a block inside a template.
   */
  async updateBlockImage(
    templateId: string,
    blockId: string,
    imageUrl: string,
  ) {
    const template = await this.prisma.pdfTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new Error('Template not found');

    const blocks = (template.content as any[]) || [];
    const idx = blocks.findIndex((b: any) => b.id === blockId);
    if (idx === -1) throw new Error('Block not found');

    blocks[idx].content = { ...blocks[idx].content, url: imageUrl };

    await this.prisma.pdfTemplate.update({
      where: { id: templateId },
      data: { content: blocks },
    });

    return blocks[idx];
  }

  /**
   * Get all active templates to be used for initializing proposal pages.
   * Returns templates with their content blocks, ordered by sortOrder.
   */
  async getActiveTemplatesForInit() {
    const templates = await this.prisma.pdfTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return templates.map((t) => ({
      pageType: t.templateType,
      title: t.name,
      sortOrder: t.sortOrder,
      blocks: (t.content as any[]) || [],
    }));
  }

  /**
   * Seed defaults if no templates exist.
   */
  async seedDefaultsIfEmpty(userId: string) {
    const count = await this.prisma.pdfTemplate.count();
    if (count > 0) return;

    const defaults = [
      {
        name: 'Portada',
        templateType: 'COVER' as PageType,
        sortOrder: 1,
        content: [
          {
            id: crypto.randomUUID(),
            blockType: 'IMAGE',
            content: { url: '/uploads/defaults/portada.png', caption: '', fullPage: true },
            sortOrder: 1,
          },
        ],
      },
      {
        name: 'Carta de Presentación',
        templateType: 'PRESENTATION' as PageType,
        sortOrder: 2,
        content: [
          {
            id: crypto.randomUUID(),
            blockType: 'RICH_TEXT',
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Carta de Presentación' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Estimado cliente, nos complace presentar nuestra propuesta comercial para su consideración. NOVOTECHNO S.A.S es una empresa dedicada a ofrecer soluciones tecnológicas integrales que se adaptan a las necesidades específicas de cada organización.' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Nuestro equipo de profesionales altamente calificados está comprometido en brindar servicios de excelencia, acompañando a nuestros clientes en cada etapa de su transformación digital.' }] },
              ],
            },
            sortOrder: 1,
          },
        ],
      },
      {
        name: 'Información General (1/2)',
        templateType: 'COMPANY_INFO' as PageType,
        sortOrder: 3,
        content: [
          {
            id: crypto.randomUUID(),
            blockType: 'RICH_TEXT',
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Quiénes Somos' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'NOVOTECHNO S.A.S es una empresa colombiana especialista en soluciones de tecnología empresarial. Con amplia experiencia en el mercado, nos hemos consolidado como un aliado estratégico para empresas que buscan optimizar sus procesos a través de la innovación tecnológica.' }] },
              ],
            },
            sortOrder: 1,
          },
        ],
      },
      {
        name: 'Información General (2/2)',
        templateType: 'COMPANY_INFO' as PageType,
        sortOrder: 4,
        content: [
          {
            id: crypto.randomUUID(),
            blockType: 'RICH_TEXT',
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Nuestros Servicios' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Ofrecemos un portafolio integral de servicios tecnológicos que incluyen: suministro de equipos de cómputo, infraestructura de red, servicios de soporte técnico, licenciamiento de software y soluciones de seguridad informática.' }] },
              ],
            },
            sortOrder: 1,
          },
        ],
      },
      {
        name: 'Índice',
        templateType: 'INDEX' as PageType,
        sortOrder: 5,
        content: [],
      },
      {
        name: 'Términos y Condiciones',
        templateType: 'TERMS' as PageType,
        sortOrder: 1000,
        content: [
          {
            id: crypto.randomUUID(),
            blockType: 'RICH_TEXT',
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Términos y Condiciones' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Los precios y condiciones de esta oferta son válidos por el período indicado en la misma. Todos los precios están expresados en pesos colombianos (COP) e incluyen IVA donde aplique.' }] },
              ],
            },
            sortOrder: 1,
          },
        ],
      },
    ];

    for (const d of defaults) {
      await this.prisma.pdfTemplate.create({
        data: {
          name: d.name,
          templateType: d.templateType,
          sortOrder: d.sortOrder,
          content: d.content as any,
          createdBy: userId,
        },
      });
    }
  }

  /**
   * Reorder templates by updating their sortOrder.
   */
  async reorder(templateIds: string[]) {
    const updates = templateIds.map((id, index) =>
      this.prisma.pdfTemplate.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    );
    await Promise.all(updates);
    return this.findAll();
  }
}
