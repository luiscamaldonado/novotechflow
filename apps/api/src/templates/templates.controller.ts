import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { validateImageMagicBytes, sanitizeFilename } from '../common/upload-validation';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ReorderTemplatesDto,
  CreateTemplateBlockDto,
  UpdateTemplateBlockDto,
} from './dto/templates.dto';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  /** List all active templates. */
  @Get()
  async findAll(@Req() req: any) {
    // Seed defaults if empty (first time admin opens the page)
    await this.templatesService.seedDefaultsIfEmpty(req.user.id);
    return this.templatesService.findAll();
  }

  /** Get one template by ID. */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(id);
  }

  /** Create a new template. */
  @Post()
  async create(
    @Req() req: any,
    @Body() body: CreateTemplateDto,
  ) {
    return this.templatesService.create({
      name: body.name,
      templateType: body.templateType as any,
      sortOrder: body.sortOrder,
      createdBy: req.user.id,
    });
  }

  /** Update a template (name, sortOrder, isActive). */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, body);
  }

  /** Delete a template. */
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.remove(id);
  }

  /** Reorder templates. */
  @Patch('reorder')
  async reorder(@Body() body: ReorderTemplatesDto) {
    return this.templatesService.reorder(body.templateIds);
  }

  // ── Block Operations ─────────────────────────────────────

  /** Add a block to a template. */
  @Post(':id/blocks')
  async addBlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTemplateBlockDto,
  ) {
    return this.templatesService.addBlock(id, {
      blockType: body.blockType,
      content: body.content || {},
    });
  }

  /** Update a block's content. */
  @Patch(':templateId/blocks/:blockId')
  async updateBlock(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() body: UpdateTemplateBlockDto,
  ) {
    return this.templatesService.updateBlock(templateId, blockId, body.content);
  }

  /** Delete a block. */
  @Delete(':templateId/blocks/:blockId')
  async deleteBlock(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.templatesService.deleteBlock(templateId, blockId);
  }

  /** Upload image for a block. */
  @Post(':templateId/blocks/:blockId/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'templates'),
      filename: (_req, file, cb) => {
        const safeName = sanitizeFilename(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'tpl-' + uniqueSuffix + extname(safeName));
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
        cb(new Error('Solo se permiten im\u00e1genes'), false);
      } else {
        cb(null, true);
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadBlockImage(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await validateImageMagicBytes(file);
    const imageUrl = `/uploads/templates/${file.filename}`;
    return this.templatesService.updateBlockImage(templateId, blockId, imageUrl);
  }
}
