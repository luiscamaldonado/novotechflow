import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete, UseInterceptors, UploadedFile, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ProposalsService } from './proposals.service';
import { ScenariosService } from './scenarios.service';
import { PagesService } from './pages.service';
import { TrmService } from './trm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { validateImageMagicBytes, validateImageFileSize, sanitizeFilename } from '../common/upload-validation';
import { SkipThrottle } from '@nestjs/throttler';
import {
    CreateProposalDto,
    UpdateProposalDto,
    CreateProposalItemDto,
    UpdateProposalItemDto,
    CreateScenarioDto,
    UpdateScenarioDto,
    AddScenarioItemDto,
    UpdateScenarioItemDto,
    ApplyMarginDto,
    CloneProposalDto,
    CreatePageDto,
    UpdatePageDto,
    ReorderPagesDto,
    CreateBlockDto,
    UpdateBlockDto,
    ReorderBlocksDto,
} from './dto/proposals.dto';

/**
 * @class ProposalsController
 * Controlador REST para el ciclo de vida completo de propuestas comerciales.
 * Todos los endpoints requieren autenticación JWT.
 *
 * @route /proposals
 */
@ApiTags('Proposals')
@ApiBearerAuth()
@Controller('proposals')
export class ProposalsController {
    constructor(
        private readonly proposalsService: ProposalsService,
        private readonly scenariosService: ScenariosService,
        private readonly pagesService: PagesService,
        private readonly trmService: TrmService,
    ) {}

    @SkipThrottle()
    @UseGuards(JwtAuthGuard)
    @Get('trm-extra')
    async getExtraTrm() {
        return this.trmService.getExtraTrmValues();
    }

    @UseGuards(JwtAuthGuard)
    @Get('client-history')
    async getClientHistory(@Query('clientName') query: string) {
        return this.proposalsService.findPotentialConflicts(query);
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Request() req: { user: AuthenticatedUser }, @Body() createProposalDto: CreateProposalDto) {
        return this.proposalsService.createProposal(req.user.id, createProposalDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async getById(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.getProposalById(id, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateData: UpdateProposalDto, @Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.updateProposal(id, updateData, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/items')
    async addItem(@Param('id', ParseUUIDPipe) id: string, @Body() itemData: CreateProposalItemDto, @Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.addProposalItem(id, itemData, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('items/:itemId')
    async removeItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.removeProposalItem(itemId, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('items/:itemId')
    async updateItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() itemData: UpdateProposalItemDto, @Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.updateProposalItem(itemId, itemData, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.deleteProposal(id, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/clone')
    async clone(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }, @Body() data: CloneProposalDto) {
        return this.proposalsService.cloneProposal(id, req.user.id, data.cloneType, req.user);
    }

    // --- ENDPOINTS DE ESCENARIOS ---

    @UseGuards(JwtAuthGuard)
    @Get(':id/scenarios')
    async getScenarios(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.getScenariosByProposalId(id, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/scenarios')
    async createScenario(@Param('id', ParseUUIDPipe) id: string, @Body() data: CreateScenarioDto, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.createScenario(id, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId')
    async updateScenario(@Param('scenarioId', ParseUUIDPipe) scenarioId: string, @Body() data: UpdateScenarioDto, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.updateScenario(scenarioId, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/:scenarioId')
    async deleteScenario(@Param('scenarioId', ParseUUIDPipe) scenarioId: string, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.deleteScenario(scenarioId, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/clone')
    async cloneScenario(@Param('scenarioId', ParseUUIDPipe) scenarioId: string, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.cloneScenario(scenarioId, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/items')
    async addScenarioItem(@Param('scenarioId', ParseUUIDPipe) scenarioId: string, @Body() data: AddScenarioItemDto, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.addScenarioItem(scenarioId, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/items/:itemId')
    async updateScenarioItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() data: UpdateScenarioItemDto, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.updateScenarioItem(itemId, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/items/:itemId')
    async removeScenarioItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.removeScenarioItem(itemId, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId/apply-margin')
    async applyMarginToScenario(@Param('scenarioId', ParseUUIDPipe) id: string, @Body() data: ApplyMarginDto, @Request() req: { user: AuthenticatedUser }) {
        return this.scenariosService.applyMarginToEntireScenario(id, data.marginPct, req.user);
    }

    // --- ENDPOINTS DE PÁGINAS ---

    @UseGuards(JwtAuthGuard)
    @Get(':id/pages')
    async getPages(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.getPagesByProposalId(id, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/pages/initialize')
    async initializePages(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.initializeDefaultPages(id, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/pages')
    async createPage(@Param('id', ParseUUIDPipe) id: string, @Body() data: CreatePageDto, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.createCustomPage(id, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/:pageId')
    async updatePage(@Param('pageId', ParseUUIDPipe) pageId: string, @Body() data: UpdatePageDto, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.updatePage(pageId, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('pages/:pageId')
    async deletePage(@Param('pageId', ParseUUIDPipe) pageId: string, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.deletePage(pageId, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/pages/reorder')
    async reorderPages(@Param('id', ParseUUIDPipe) id: string, @Body() data: ReorderPagesDto, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.reorderPages(id, data, req.user);
    }

    // --- ENDPOINTS DE BLOQUES ---

    @UseGuards(JwtAuthGuard)
    @Post('pages/:pageId/blocks')
    async createBlock(@Param('pageId', ParseUUIDPipe) pageId: string, @Body() data: CreateBlockDto, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.createBlock(pageId, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/blocks/:blockId')
    async updateBlock(@Param('blockId', ParseUUIDPipe) blockId: string, @Body() data: UpdateBlockDto, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.updateBlock(blockId, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('pages/blocks/:blockId')
    async deleteBlock(@Param('blockId', ParseUUIDPipe) blockId: string, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.deleteBlock(blockId, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/:pageId/blocks/reorder')
    async reorderBlocks(@Param('pageId', ParseUUIDPipe) pageId: string, @Body() data: ReorderBlocksDto, @Request() req: { user: AuthenticatedUser }) {
        return this.pagesService.reorderBlocks(pageId, data, req.user);
    }

    // --- UPLOAD DE IMÁGENES ---

    @UseGuards(JwtAuthGuard)
    @Post('pages/upload-image')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: join(process.cwd(), 'uploads'),
            filename: (_req, file, cb) => {
                const safeName = sanitizeFilename(file.originalname);
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, uniqueSuffix + extname(safeName));
            },
        }),
        fileFilter: (_req, file, cb) => {
            const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowed.includes(file.mimetype)) {
                cb(new BadRequestException('Solo se permiten im\u00e1genes JPEG, PNG, GIF o WebP'), false);
                return;
            }
            cb(null, true);
        },
        limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        await validateImageFileSize(file);
        await validateImageMagicBytes(file);
        return { url: `/uploads/${file.filename}`, originalName: file.originalname };
    }
}
