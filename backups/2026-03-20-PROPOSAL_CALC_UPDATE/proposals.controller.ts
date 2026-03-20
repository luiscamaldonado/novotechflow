import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    async create(@Request() req: any, @Body() createProposalDto: any) {
        return this.proposalsService.createProposal(req.user.id, createProposalDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.proposalsService.getProposalById(id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateData: any) {
        return this.proposalsService.updateProposal(id, updateData);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/items')
    async addItem(@Param('id') id: string, @Body() itemData: any) {
        return this.proposalsService.addProposalItem(id, itemData);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('items/:itemId')
    async removeItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeProposalItem(itemId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('items/:itemId')
    async updateItem(@Param('itemId') itemId: string, @Body() itemData: any) {
        return this.proposalsService.updateProposalItem(itemId, itemData);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@Request() req: any) {
        return this.proposalsService.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.proposalsService.deleteProposal(id);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/scenarios')
    async getScenarios(@Param('id') id: string) {
        return this.proposalsService.getScenariosByProposalId(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/scenarios')
    async createScenario(@Param('id') id: string, @Body() data: any) {
        return this.proposalsService.createScenario(id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId')
    async updateScenario(@Param('scenarioId') scenarioId: string, @Body() data: any) {
        return this.proposalsService.updateScenario(scenarioId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/:scenarioId')
    async deleteScenario(@Param('scenarioId') scenarioId: string) {
        return this.proposalsService.deleteScenario(scenarioId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('scenarios/:scenarioId/items')
    async addScenarioItem(@Param('scenarioId') scenarioId: string, @Body() data: any) {
        return this.proposalsService.addScenarioItem(scenarioId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/items/:itemId')
    async updateScenarioItem(@Param('itemId') itemId: string, @Body() data: any) {
        return this.proposalsService.updateScenarioItem(itemId, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('scenarios/items/:itemId')
    async removeScenarioItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeScenarioItem(itemId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('scenarios/:scenarioId/apply-margin')
    async applyMarginToScenario(@Param('scenarioId') id: string, @Body() data: { marginPct: number }) {
        return this.proposalsService.applyMarginToEntireScenario(id, data.marginPct);
    }
}
