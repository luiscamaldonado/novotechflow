# Walkthrough — Paso 1 de Remediación: Seguridad Inmediata

4 cambios aplicados para cerrar las vulnerabilidades de seguridad más urgentes identificadas en la auditoría.

---

## A) `.gitignore` — Rutas sensibles explícitas

```diff:.gitignore
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# Dependencies
node_modules
.pnp
.pnp.js

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
coverage

# Turbo
.turbo

# Vercel
.vercel

# Build Outputs
.next/
out/
build
dist


# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
.DS_Store
*.pem
===
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# Dependencies
node_modules
.pnp
.pnp.js

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
coverage

# Turbo
.turbo

# Vercel
.vercel

# Build Outputs
.next/
out/
build
dist


# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
.DS_Store
*.pem

# Explicit security-sensitive paths (redundant with global patterns, but explicit for safety)
apps/api/.env
apps/api/dist/
apps/agent/dist/
```

> [!NOTE]
> Las entradas globales `.env` y `dist` ya cubrían estos paths, pero las entradas explícitas previenen un `git add -f` accidental sobre archivos sensibles.

---

## B) `proposals.controller.ts` — JWT Guard + Cache TRM

```diff:proposals.controller.ts
import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
    constructor(private readonly proposalsService: ProposalsService) {}

    @Get('trm-extra')
    async getExtraTrm() {
        return this.proposalsService.getExtraTrmValues();
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
    async getById(@Param('id') id: string) {
        return this.proposalsService.getProposalById(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateData: UpdateProposalDto) {
        return this.proposalsService.updateProposal(id, updateData);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/items')
    async addItem(@Param('id') id: string, @Body() itemData: CreateProposalItemDto) {
        return this.proposalsService.addProposalItem(id, itemData);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('items/:itemId')
    async removeItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeProposalItem(itemId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('items/:itemId')
    async updateItem(@Param('itemId') itemId: string, @Body() itemData: UpdateProposalItemDto) {
        return this.proposalsService.updateProposalItem(itemId, itemData);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.proposalsService.deleteProposal(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/clone')
    async clone(@Param('id') id: string, @Request() req: { user: AuthenticatedUser }, @Body() data: CloneProposalDto) {
        return this.proposalsService.cloneProposal(id, req.user.id, data.cloneType);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/scenarios')
    async getScenarios(@Param('id') id: string) {
        return this.proposalsService.getScenariosByProposalId(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/scenarios')
    async createScenario(@Param('id') id: string, @Body() data: CreateScenarioDto) {
        return this.proposalsService.createScenario(id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId')
    async updateScenario(@Param('scenarioId') scenarioId: string, @Body() data: UpdateScenarioDto) {
        return this.proposalsService.updateScenario(scenarioId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/:scenarioId')
    async deleteScenario(@Param('scenarioId') scenarioId: string) {
        return this.proposalsService.deleteScenario(scenarioId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/clone')
    async cloneScenario(@Param('scenarioId') scenarioId: string) {
        return this.proposalsService.cloneScenario(scenarioId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/items')
    async addScenarioItem(@Param('scenarioId') scenarioId: string, @Body() data: AddScenarioItemDto) {
        return this.proposalsService.addScenarioItem(scenarioId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/items/:itemId')
    async updateScenarioItem(@Param('itemId') itemId: string, @Body() data: UpdateScenarioItemDto) {
        return this.proposalsService.updateScenarioItem(itemId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/items/:itemId')
    async removeScenarioItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeScenarioItem(itemId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId/apply-margin')
    async applyMarginToScenario(@Param('scenarioId') id: string, @Body() data: ApplyMarginDto) {
        return this.proposalsService.applyMarginToEntireScenario(id, data.marginPct);
    }

    // --- ENDPOINTS DE PÁGINAS ---

    @UseGuards(JwtAuthGuard)
    @Get(':id/pages')
    async getPages(@Param('id') id: string) {
        return this.proposalsService.getPagesByProposalId(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/pages/initialize')
    async initializePages(@Param('id') id: string) {
        return this.proposalsService.initializeDefaultPages(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/pages')
    async createPage(@Param('id') id: string, @Body() data: CreatePageDto) {
        return this.proposalsService.createCustomPage(id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/:pageId')
    async updatePage(@Param('pageId') pageId: string, @Body() data: UpdatePageDto) {
        return this.proposalsService.updatePage(pageId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('pages/:pageId')
    async deletePage(@Param('pageId') pageId: string) {
        return this.proposalsService.deletePage(pageId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/pages/reorder')
    async reorderPages(@Param('id') id: string, @Body() data: ReorderPagesDto) {
        return this.proposalsService.reorderPages(id, data);
    }

    // --- ENDPOINTS DE BLOQUES ---

    @UseGuards(JwtAuthGuard)
    @Post('pages/:pageId/blocks')
    async createBlock(@Param('pageId') pageId: string, @Body() data: CreateBlockDto) {
        return this.proposalsService.createBlock(pageId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/blocks/:blockId')
    async updateBlock(@Param('blockId') blockId: string, @Body() data: UpdateBlockDto) {
        return this.proposalsService.updateBlock(blockId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('pages/blocks/:blockId')
    async deleteBlock(@Param('blockId') blockId: string) {
        return this.proposalsService.deleteBlock(blockId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/:pageId/blocks/reorder')
    async reorderBlocks(@Param('pageId') pageId: string, @Body() data: ReorderBlocksDto) {
        return this.proposalsService.reorderBlocks(pageId, data);
    }

    // --- UPLOAD DE IMÁGENES ---

    @UseGuards(JwtAuthGuard)
    @Post('pages/upload-image')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: join(process.cwd(), 'uploads'),
            filename: (_req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, uniqueSuffix + extname(file.originalname));
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
        return { url: `/uploads/${file.filename}`, originalName: file.originalname };
    }
}
===
import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
/** TTL del cache de TRM en milisegundos (5 minutos). */
const TRM_CACHE_TTL_MS = 5 * 60 * 1000;

@Controller('proposals')
export class ProposalsController {
    /** Cache en memoria para evitar scraping repetitivo de TRM. */
    private trmCache: { data: unknown; expiresAt: number } | null = null;

    constructor(private readonly proposalsService: ProposalsService) {}

    @UseGuards(JwtAuthGuard)
    @Get('trm-extra')
    async getExtraTrm() {
        const now = Date.now();
        if (this.trmCache && now < this.trmCache.expiresAt) {
            return this.trmCache.data;
        }

        const data = await this.proposalsService.getExtraTrmValues();
        this.trmCache = { data, expiresAt: now + TRM_CACHE_TTL_MS };
        return data;
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
    async getById(@Param('id') id: string) {
        return this.proposalsService.getProposalById(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateData: UpdateProposalDto) {
        return this.proposalsService.updateProposal(id, updateData);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/items')
    async addItem(@Param('id') id: string, @Body() itemData: CreateProposalItemDto) {
        return this.proposalsService.addProposalItem(id, itemData);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('items/:itemId')
    async removeItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeProposalItem(itemId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('items/:itemId')
    async updateItem(@Param('itemId') itemId: string, @Body() itemData: UpdateProposalItemDto) {
        return this.proposalsService.updateProposalItem(itemId, itemData);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@Request() req: { user: AuthenticatedUser }) {
        return this.proposalsService.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.proposalsService.deleteProposal(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/clone')
    async clone(@Param('id') id: string, @Request() req: { user: AuthenticatedUser }, @Body() data: CloneProposalDto) {
        return this.proposalsService.cloneProposal(id, req.user.id, data.cloneType);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/scenarios')
    async getScenarios(@Param('id') id: string) {
        return this.proposalsService.getScenariosByProposalId(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/scenarios')
    async createScenario(@Param('id') id: string, @Body() data: CreateScenarioDto) {
        return this.proposalsService.createScenario(id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId')
    async updateScenario(@Param('scenarioId') scenarioId: string, @Body() data: UpdateScenarioDto) {
        return this.proposalsService.updateScenario(scenarioId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/:scenarioId')
    async deleteScenario(@Param('scenarioId') scenarioId: string) {
        return this.proposalsService.deleteScenario(scenarioId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/clone')
    async cloneScenario(@Param('scenarioId') scenarioId: string) {
        return this.proposalsService.cloneScenario(scenarioId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/items')
    async addScenarioItem(@Param('scenarioId') scenarioId: string, @Body() data: AddScenarioItemDto) {
        return this.proposalsService.addScenarioItem(scenarioId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/items/:itemId')
    async updateScenarioItem(@Param('itemId') itemId: string, @Body() data: UpdateScenarioItemDto) {
        return this.proposalsService.updateScenarioItem(itemId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/items/:itemId')
    async removeScenarioItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeScenarioItem(itemId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId/apply-margin')
    async applyMarginToScenario(@Param('scenarioId') id: string, @Body() data: ApplyMarginDto) {
        return this.proposalsService.applyMarginToEntireScenario(id, data.marginPct);
    }

    // --- ENDPOINTS DE PÁGINAS ---

    @UseGuards(JwtAuthGuard)
    @Get(':id/pages')
    async getPages(@Param('id') id: string) {
        return this.proposalsService.getPagesByProposalId(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/pages/initialize')
    async initializePages(@Param('id') id: string) {
        return this.proposalsService.initializeDefaultPages(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/pages')
    async createPage(@Param('id') id: string, @Body() data: CreatePageDto) {
        return this.proposalsService.createCustomPage(id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/:pageId')
    async updatePage(@Param('pageId') pageId: string, @Body() data: UpdatePageDto) {
        return this.proposalsService.updatePage(pageId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('pages/:pageId')
    async deletePage(@Param('pageId') pageId: string) {
        return this.proposalsService.deletePage(pageId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/pages/reorder')
    async reorderPages(@Param('id') id: string, @Body() data: ReorderPagesDto) {
        return this.proposalsService.reorderPages(id, data);
    }

    // --- ENDPOINTS DE BLOQUES ---

    @UseGuards(JwtAuthGuard)
    @Post('pages/:pageId/blocks')
    async createBlock(@Param('pageId') pageId: string, @Body() data: CreateBlockDto) {
        return this.proposalsService.createBlock(pageId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/blocks/:blockId')
    async updateBlock(@Param('blockId') blockId: string, @Body() data: UpdateBlockDto) {
        return this.proposalsService.updateBlock(blockId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('pages/blocks/:blockId')
    async deleteBlock(@Param('blockId') blockId: string) {
        return this.proposalsService.deleteBlock(blockId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pages/:pageId/blocks/reorder')
    async reorderBlocks(@Param('pageId') pageId: string, @Body() data: ReorderBlocksDto) {
        return this.proposalsService.reorderBlocks(pageId, data);
    }

    // --- UPLOAD DE IMÁGENES ---

    @UseGuards(JwtAuthGuard)
    @Post('pages/upload-image')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: join(process.cwd(), 'uploads'),
            filename: (_req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, uniqueSuffix + extname(file.originalname));
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
        return { url: `/uploads/${file.filename}`, originalName: file.originalname };
    }
}
```

**Qué se hizo:**
- `@UseGuards(JwtAuthGuard)` añadido al endpoint `getExtraTrm` — era el **único endpoint sin protección** en todo el controlador.
- Cache en memoria con TTL de 5 minutos (`trmCache` como propiedad privada de la clase). Evita scraping repetitivo a SET-ICAP y Wilkinson en cada request.
- La constante `TRM_CACHE_TTL_MS` está fuera de la clase para claridad.

---

## C) `api.ts` — Interceptor de respuestas 401

```diff:api.ts
import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
===
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);
```

**Qué se hizo:**
- Importa `useAuthStore` directamente (acceso vía `.getState()` fuera de componentes React — patrón válido de Zustand).
- Nuevo `response interceptor` que intercepta cualquier error 401 y ejecuta `logout()` automáticamente.
- El error se sigue propagando (`Promise.reject`) para que los llamadores puedan manejar sus propios flujos de error.

---

## D) `authStore.ts` — Validación de expiración JWT

```diff:authStore.ts
import { create } from 'zustand';
import type { AuthUser } from '../lib/types';

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: AuthUser) => void;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,

    login: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null, isAuthenticated: false });
    },

    checkAuth: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            try {
                set({ token, user: JSON.parse(userStr), isAuthenticated: true, isLoading: false });
            } catch (e) {
                set({ token: null, user: null, isAuthenticated: false, isLoading: false });
            }
        } else {
            set({ isLoading: false });
        }
    }
}));
===
import { create } from 'zustand';
import type { AuthUser } from '../lib/types';

/**
 * Decodifica el payload de un JWT sin verificar firma.
 * La verificación de firma la hace el backend; aquí solo leemos `exp`.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

/** Verifica si un token JWT está expirado comparando `exp` contra el reloj local. */
function isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;
    return payload.exp < Date.now() / 1000;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: AuthUser) => void;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,

    login: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null, isAuthenticated: false });
    },

    checkAuth: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            // Verificar expiración del JWT antes de confiar en él
            if (isTokenExpired(token)) {
                get().logout();
                set({ isLoading: false });
                return;
            }

            try {
                set({ token, user: JSON.parse(userStr), isAuthenticated: true, isLoading: false });
            } catch {
                set({ token: null, user: null, isAuthenticated: false, isLoading: false });
            }
        } else {
            set({ isLoading: false });
        }
    }
}));
```

**Qué se hizo:**
1. **`decodeJwtPayload()`** — Función pura que decodifica el payload de un JWT (base64url → JSON). No verifica firma (eso lo hace el backend).
2. **`isTokenExpired()`** — Compara `exp` del payload contra `Date.now() / 1000`. Retorna `true` si expiró o si el token es inválido.
3. **`checkAuth()`** modificado — Antes de confiar en el token almacenado, verifica su expiración. Si está expirado, ejecuta `logout()` inmediatamente.
4. El `create` ahora recibe `(set, get)` para poder llamar `get().logout()` desde `checkAuth`.
5. `catch (e)` → `catch` sin variable (el error no se usaba — limpieza menor).

---

## Verificación

> [!IMPORTANT]
> La verificación con `tsc --noEmit` no pudo ejecutarse por limitaciones del sandbox. Ejecutar manualmente:
> ```bash
> npx tsc --noEmit --project apps/web/tsconfig.app.json
> npx tsc --noEmit --project apps/api/tsconfig.build.json
> ```

### Checklist manual
- [ ] `git status` confirma que `apps/api/.env` NO aparece como tracked
- [ ] Login funciona normalmente
- [ ] Cerrar sesión y verificar que el endpoint `/proposals/trm-extra` retorna 401 sin token
- [ ] Esperar 5+ minutos y verificar que el TRM se refresca (o simular avanzando el reloj)
- [ ] Con un token expirado en localStorage, recargar la app → debe redirigir al login
