# Swagger / OpenAPI Integration

## Summary

Integrated `@nestjs/swagger` into the NovoTechFlow API with base structure: tags per controller and bearer auth annotation. Swagger UI is available at `/api/docs`.

## Changes Made

### 1. `main.ts` — Swagger bootstrap

```diff:main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Ensure upload directories exist
  const uploadsPath = join(process.cwd(), 'uploads');
  const signaturesPath = join(uploadsPath, 'signatures');
  const defaultsPath = join(uploadsPath, 'defaults');
  const templatesPath = join(uploadsPath, 'templates');
  for (const dir of [uploadsPath, signaturesPath, defaultsPath, templatesPath]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Serve uploaded images as static files
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

===
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Ensure upload directories exist
  const uploadsPath = join(process.cwd(), 'uploads');
  const signaturesPath = join(uploadsPath, 'signatures');
  const defaultsPath = join(uploadsPath, 'defaults');
  const templatesPath = join(uploadsPath, 'templates');
  for (const dir of [uploadsPath, signaturesPath, defaultsPath, templatesPath]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Serve uploaded images as static files
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NovoTechFlow API')
    .setDescription('API de cotizaciones comerciales para NOVOTECHNO')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

```

---

### 2. `auth.controller.ts` — `@ApiTags('Auth')` only (no `@ApiBearerAuth`)

```diff:auth.controller.ts
import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() signInDto: LoginDto) {
        const user = await this.authService.validateUser(signInDto.email, signInDto.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user);
    }
}

===
import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() signInDto: LoginDto) {
        const user = await this.authService.validateUser(signInDto.email, signInDto.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user);
    }
}

```

---

### 3. `proposals.controller.ts` — `@ApiTags('Proposals')` + `@ApiBearerAuth()`

```diff:proposals.controller.ts
import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete, UseInterceptors, UploadedFile, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ProposalsService } from './proposals.service';
import { ScenariosService } from './scenarios.service';
import { PagesService } from './pages.service';
import { TrmService } from './trm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { validateImageMagicBytes, sanitizeFilename } from '../common/upload-validation';
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
            if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
                cb(new Error('Solo se permiten imágenes'), false);
            } else {
                cb(null, true);
            }
        },
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        await validateImageMagicBytes(file);
        return { url: `/uploads/${file.filename}`, originalName: file.originalname };
    }
}
===
import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete, UseInterceptors, UploadedFile, ParseUUIDPipe } from '@nestjs/common';
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
import { validateImageMagicBytes, sanitizeFilename } from '../common/upload-validation';
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
            if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
                cb(new Error('Solo se permiten imágenes'), false);
            } else {
                cb(null, true);
            }
        },
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        await validateImageMagicBytes(file);
        return { url: `/uploads/${file.filename}`, originalName: file.originalname };
    }
}
```

---

### 4. `users.controller.ts` — `@ApiTags('Users')` + `@ApiBearerAuth()`

```diff:users.controller.ts
import { Controller, Get, Post, Body, UseGuards, Delete, Param, UseInterceptors, UploadedFile, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { validateImageMagicBytes, sanitizeFilename } from '../common/upload-validation';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN)
    async findAll() {
        return this.usersService.findAll();
    }

    @Post()
    @Roles(Role.ADMIN)
    async create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.createUser({
            email: createUserDto.email,
            name: createUserDto.name,
            role: createUserDto.role,
            nomenclature: createUserDto.nomenclature,
            passwordHash: createUserDto.password,
        });
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.deleteUser(id);
    }

    @Post(':id/signature')
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: join(process.cwd(), 'uploads', 'signatures'),
            filename: (_req, file, cb) => {
                const safeName = sanitizeFilename(file.originalname);
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, 'signature-' + uniqueSuffix + extname(safeName));
            },
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
                cb(new Error('Solo se permiten imágenes'), false);
            } else {
                cb(null, true);
            }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }))
    async uploadSignature(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        await validateImageMagicBytes(file);
        const signatureUrl = `/uploads/signatures/${file.filename}`;
        return this.usersService.updateSignature(id, signatureUrl);
    }

    @Delete(':id/signature')
    @Roles(Role.ADMIN)
    async deleteSignature(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.deleteSignature(id);
    }
}
===
import { Controller, Get, Post, Body, UseGuards, Delete, Param, UseInterceptors, UploadedFile, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { validateImageMagicBytes, sanitizeFilename } from '../common/upload-validation';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN)
    async findAll() {
        return this.usersService.findAll();
    }

    @Post()
    @Roles(Role.ADMIN)
    async create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.createUser({
            email: createUserDto.email,
            name: createUserDto.name,
            role: createUserDto.role,
            nomenclature: createUserDto.nomenclature,
            passwordHash: createUserDto.password,
        });
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.deleteUser(id);
    }

    @Post(':id/signature')
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: join(process.cwd(), 'uploads', 'signatures'),
            filename: (_req, file, cb) => {
                const safeName = sanitizeFilename(file.originalname);
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, 'signature-' + uniqueSuffix + extname(safeName));
            },
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
                cb(new Error('Solo se permiten imágenes'), false);
            } else {
                cb(null, true);
            }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }))
    async uploadSignature(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        await validateImageMagicBytes(file);
        const signatureUrl = `/uploads/signatures/${file.filename}`;
        return this.usersService.updateSignature(id, signatureUrl);
    }

    @Delete(':id/signature')
    @Roles(Role.ADMIN)
    async deleteSignature(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.deleteSignature(id);
    }
}
```

---

### 5. `clients.controller.ts` — `@ApiTags('Clients')` + `@ApiBearerAuth()`

```diff:clients.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClientsService, ISearchResponse } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class ClientsController
 * Controlador REST para la gestión de búsquedas de clientes.
 * Expone endpoints protegidos por JWT para consultar el maestro de clientes.
 *
 * @route /clients
 */
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * Busca clientes por coincidencia parcial con ranking de relevancia.
   * También puede devolver sugerencias tipo "¿Quisiste decir...?" si no hay coincidencias.
   *
   * @param {string} query - Término de búsqueda ingresado por el usuario (mín. 2 caracteres).
   * @returns {Promise<ISearchResponse>} Objeto con resultados rankeados y sugerencia opcional.
   *
   * @example GET /clients/search?q=SURA
   */
  @Get('search')
  async search(@Query('q') query: string): Promise<ISearchResponse> {
    return this.clientsService.search(query);
  }
}
===
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService, ISearchResponse } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class ClientsController
 * Controlador REST para la gestión de búsquedas de clientes.
 * Expone endpoints protegidos por JWT para consultar el maestro de clientes.
 *
 * @route /clients
 */
@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * Busca clientes por coincidencia parcial con ranking de relevancia.
   * También puede devolver sugerencias tipo "¿Quisiste decir...?" si no hay coincidencias.
   *
   * @param {string} query - Término de búsqueda ingresado por el usuario (mín. 2 caracteres).
   * @returns {Promise<ISearchResponse>} Objeto con resultados rankeados y sugerencia opcional.
   *
   * @example GET /clients/search?q=SURA
   */
  @Get('search')
  async search(@Query('q') query: string): Promise<ISearchResponse> {
    return this.clientsService.search(query);
  }
}
```

---

### 6. `catalogs.controller.ts` — `@ApiTags('Catalogs')` + `@ApiBearerAuth()`

```diff:catalogs.controller.ts
import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class CatalogsController
 * Controlador para acceder a los datos maestros del sistema.
 */
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  /**
   * Obtiene los valores de una categoría.
   * @example GET /catalogs/category/FABRICANTE
   */
  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    return this.catalogsService.findByCategory(category);
  }

  /**
   * Obtiene especificaciones para PCs (múltiples categorías).
   * @example GET /catalogs/pc-specs
   */
  @Get('pc-specs')
  async getPcSpecs() {
    const categories = [
      'FORMATO', 'FABRICANTE', 'MODELO', 'PROCESADOR', 'SISTEMA_OPERATIVO',
      'GRAFICOS', 'MEMORIA_RAM', 'ALMACENAMIENTO', 'PANTALLA', 'NETWORK',
      'SEGURIDAD', 'GARANTIA_BATERIA', 'GARANTIA_EQUIPO',
      'ACC_TIPO', 'ACC_GARANTIA',
      'SVC_TIPO', 'SVC_RESPONSABLE', 'SVC_UM',
      'SW_TIPO', 'SW_UM',
      'INFRA_TIPO', 'INFRA_GARANTIA',
      'INFRA_SVC_TIPO', 'INFRA_SVC_RESPONSABLE', 'INFRA_SVC_UM'
    ];
    return this.catalogsService.findMultipleCategories(categories);
  }
}
===
import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * @class CatalogsController
 * Controlador para acceder a los datos maestros del sistema.
 */
@ApiTags('Catalogs')
@ApiBearerAuth()
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  /**
   * Obtiene los valores de una categoría.
   * @example GET /catalogs/category/FABRICANTE
   */
  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    return this.catalogsService.findByCategory(category);
  }

  /**
   * Obtiene especificaciones para PCs (múltiples categorías).
   * @example GET /catalogs/pc-specs
   */
  @Get('pc-specs')
  async getPcSpecs() {
    const categories = [
      'FORMATO', 'FABRICANTE', 'MODELO', 'PROCESADOR', 'SISTEMA_OPERATIVO',
      'GRAFICOS', 'MEMORIA_RAM', 'ALMACENAMIENTO', 'PANTALLA', 'NETWORK',
      'SEGURIDAD', 'GARANTIA_BATERIA', 'GARANTIA_EQUIPO',
      'ACC_TIPO', 'ACC_GARANTIA',
      'SVC_TIPO', 'SVC_RESPONSABLE', 'SVC_UM',
      'SW_TIPO', 'SW_UM',
      'INFRA_TIPO', 'INFRA_GARANTIA',
      'INFRA_SVC_TIPO', 'INFRA_SVC_RESPONSABLE', 'INFRA_SVC_UM'
    ];
    return this.catalogsService.findMultipleCategories(categories);
  }
}
```

---

### 7. `templates.controller.ts` — `@ApiTags('Templates')` + `@ApiBearerAuth()`

```diff:templates.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, ParseUUIDPipe,
} from '@nestjs/common';
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
        cb(new Error('Solo se permiten imágenes'), false);
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
===
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
        cb(new Error('Solo se permiten imágenes'), false);
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
```

---

### 8. `billing-projections.controller.ts` — `@ApiTags('Billing Projections')` + `@ApiBearerAuth()`

```diff:billing-projections.controller.ts
import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { BillingProjectionsService, CreateBillingProjectionDto, UpdateBillingProjectionDto } from './billing-projections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

@Controller('billing-projections')
export class BillingProjectionsController {
    constructor(private readonly service: BillingProjectionsService) {}

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@Request() req: { user: AuthenticatedUser }) {
        return this.service.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Request() req: { user: AuthenticatedUser }, @Body() data: CreateBillingProjectionDto) {
        return this.service.create(req.user.id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateBillingProjectionDto, @Request() req: { user: AuthenticatedUser }) {
        return this.service.update(id, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.service.delete(id, req.user);
    }
}
===
import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingProjectionsService, CreateBillingProjectionDto, UpdateBillingProjectionDto } from './billing-projections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

@ApiTags('Billing Projections')
@ApiBearerAuth()
@Controller('billing-projections')
export class BillingProjectionsController {
    constructor(private readonly service: BillingProjectionsService) {}

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@Request() req: { user: AuthenticatedUser }) {
        return this.service.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Request() req: { user: AuthenticatedUser }, @Body() data: CreateBillingProjectionDto) {
        return this.service.create(req.user.id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateBillingProjectionDto, @Request() req: { user: AuthenticatedUser }) {
        return this.service.update(id, data, req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: AuthenticatedUser }) {
        return this.service.delete(id, req.user);
    }
}
```

## Result

| Controller | `@ApiTags` | `@ApiBearerAuth` |
|---|---|---|
| AuthController | `'Auth'` | ✗ (público) |
| ProposalsController | `'Proposals'` | ✓ |
| UsersController | `'Users'` | ✓ |
| ClientsController | `'Clients'` | ✓ |
| CatalogsController | `'Catalogs'` | ✓ |
| TemplatesController | `'Templates'` | ✓ |
| BillingProjectionsController | `'Billing Projections'` | ✓ |

> [!TIP]
> Con el servidor corriendo, accede a **`http://localhost:3000/api/docs`** para ver la documentación Swagger UI interactiva.
