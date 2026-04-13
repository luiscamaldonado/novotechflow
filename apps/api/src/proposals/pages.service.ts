import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';
import { BlockType, PageType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizeRichText } from '../common/sanitize';
import {
    CreatePageDto,
    UpdatePageDto,
    ReorderPagesDto,
    CreateBlockDto,
    UpdateBlockDto,
    ReorderBlocksDto,
} from './dto/proposals.dto';


@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Verifica ownership a través de una página.
   * Busca la page → obtiene proposalId → verifica ownership.
   */
  private async verifyPageOwnership(pageId: string, user: AuthenticatedUser) {
    const page = await this.prisma.proposalPage.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('P\u00e1gina no encontrada.');
    await this.proposalsService.verifyProposalOwnership(page.proposalId, user);
    return page;
  }

  /**
   * Inicializa las páginas predeterminadas para una propuesta.
   * Lee las plantillas globales configuradas por el admin (PdfTemplate).
   * Si no hay plantillas, usa fallback hardcodeado mínimo.
   * Agrega la firma del comercial a la página de presentación.
   */
  async initializeDefaultPages(proposalId: string, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    // Check for ANY existing pages to prevent re-initialization
    const existingCount = await this.prisma.proposalPage.count({
      where: { proposalId },
    });

    if (existingCount > 0) {
      return this.getPagesByProposalId(proposalId);
    }

    // Fetch proposal with user to get signature
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: { select: { name: true, signatureUrl: true } } },
    });

    // Read global templates from admin configuration
    const templates = await this.prisma.pdfTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Build page definitions from templates or fallback
    let pageDefs: {
      pageType: string;
      title: string;
      sortOrder: number;
      blocks: { blockType: string; content: object }[];
    }[];

    if (templates.length > 0) {
      // Use admin-configured templates
      pageDefs = templates.map((t) => ({
        pageType: t.templateType,
        title: t.name,
        sortOrder: t.sortOrder,
        blocks: ((t.content as any[]) || []).map((b: any) => ({
          blockType: b.blockType,
          content: b.content || {},
        })),
      }));
    } else {
      // Fallback: minimal hardcoded defaults
      pageDefs = [
        { pageType: 'COVER', title: 'Portada', sortOrder: 1, blocks: [{ blockType: 'IMAGE', content: { url: '/uploads/defaults/portada.png', caption: '', fullPage: true } }] },
        { pageType: 'PRESENTATION', title: 'Carta de Presentaci\u00f3n', sortOrder: 2, blocks: [{ blockType: 'RICH_TEXT', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Carta de Presentaci\u00f3n' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Contenido de la carta de presentaci\u00f3n.' }] }] } }] },
        { pageType: 'COMPANY_INFO', title: 'Informaci\u00f3n General (1/2)', sortOrder: 3, blocks: [] },
        { pageType: 'COMPANY_INFO', title: 'Informaci\u00f3n General (2/2)', sortOrder: 4, blocks: [] },
        { pageType: 'INDEX', title: '\u00cdndice', sortOrder: 5, blocks: [] },
        { pageType: 'TERMS', title: 'T\u00e9rminos y Condiciones', sortOrder: 1000, blocks: [{ blockType: 'RICH_TEXT', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'T\u00e9rminos y Condiciones' }] }] } }] },
      ];
    }

    // For the PRESENTATION page, append the commercial user's signature if available
    if (proposal?.user?.signatureUrl) {
      const presentationIdx = pageDefs.findIndex(p => p.pageType === 'PRESENTATION');
      if (presentationIdx !== -1) {
        pageDefs[presentationIdx].blocks.push({
          blockType: 'IMAGE',
          content: { url: proposal.user.signatureUrl, caption: proposal.user.name || 'Firma Comercial' },
        });
      }
    }

    // Create pages and blocks
    for (const page of pageDefs) {
      const createdPage = await this.prisma.proposalPage.create({
        data: {
          proposalId,
          pageType: page.pageType as PageType,
          title: page.title,
          sortOrder: page.sortOrder,
          isLocked: true,
        },
      });

      if (page.blocks?.length) {
        for (let i = 0; i < page.blocks.length; i++) {
          await this.prisma.proposalPageBlock.create({
            data: {
              pageId: createdPage.id,
              blockType: page.blocks[i].blockType as BlockType,
              content: page.blocks[i].content as object,
              sortOrder: i + 1,
            },
          });
        }
      }
    }

    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Retorna todas las páginas con sus bloques para una propuesta.
   */
  async getPagesByProposalId(proposalId: string, user?: AuthenticatedUser) {
    if (user) await this.proposalsService.verifyProposalOwnership(proposalId, user);
    return this.prisma.proposalPage.findMany({
      where: { proposalId },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea una página personalizada.
   */
  async createCustomPage(proposalId: string, data: CreatePageDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
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
  async updatePage(pageId: string, data: UpdatePageDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
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
   * La cascada (onDelete: Cascade en ProposalPageBlock) elimina automáticamente los bloques.
   */
  async deletePage(pageId: string, user: AuthenticatedUser) {
    const page = await this.verifyPageOwnership(pageId, user);
    if (page.isLocked) throw new Error('No se puede eliminar una p\u00e1gina predeterminada.');

    return this.prisma.proposalPage.delete({ where: { id: pageId } });
  }

  /**
   * Reordena las páginas respetando las posiciones fijas de predeterminadas.
   */
  async reorderPages(proposalId: string, data: ReorderPagesDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    await this.prisma.$transaction(
      data.pageIds.map((id, index) =>
        this.prisma.proposalPage.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Crea un bloque dentro de una página.
   */
  async createBlock(pageId: string, data: CreateBlockDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    const aggregate = await this.prisma.proposalPageBlock.aggregate({
      where: { pageId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    const contentToSave = data.blockType === 'RICH_TEXT' && data.content
      ? { ...data.content as object, html: typeof (data.content as any).html === 'string' ? sanitizeRichText((data.content as any).html) : undefined }
      : (data.content || {});

    return this.prisma.proposalPageBlock.create({
      data: {
        pageId,
        blockType: data.blockType as BlockType,
        content: contentToSave as object,
        sortOrder: nextOrder,
      },
    });
  }

  /**
   * Actualiza el contenido de un bloque.
   */
  async updateBlock(blockId: string, data: UpdateBlockDto, user: AuthenticatedUser) {
    const block = await this.prisma.proposalPageBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Bloque no encontrado.');
    await this.verifyPageOwnership(block.pageId, user);

    const contentToSave = block.blockType === 'RICH_TEXT' && data.content
      ? { ...data.content as object, html: typeof (data.content as any).html === 'string' ? sanitizeRichText((data.content as any).html) : undefined }
      : data.content;

    return this.prisma.proposalPageBlock.update({
      where: { id: blockId },
      data: { content: contentToSave as object | undefined },
    });
  }

  /**
   * Elimina un bloque.
   */
  async deleteBlock(blockId: string, user: AuthenticatedUser) {
    const block = await this.prisma.proposalPageBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Bloque no encontrado.');
    await this.verifyPageOwnership(block.pageId, user);
    return this.prisma.proposalPageBlock.delete({ where: { id: blockId } });
  }

  /**
   * Reordena los bloques dentro de una página.
   */
  async reorderBlocks(pageId: string, data: ReorderBlocksDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    await this.prisma.$transaction(
      data.blockIds.map((id, index) =>
        this.prisma.proposalPageBlock.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.prisma.proposalPageBlock.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
