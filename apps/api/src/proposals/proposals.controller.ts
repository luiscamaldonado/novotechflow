import { Controller, Get, Post, Body, UseGuards, Query, Request, Param, Patch, Delete } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('proposals')
@UseGuards(JwtAuthGuard)
export class ProposalsController {
    constructor(private readonly proposalsService: ProposalsService) { }

    @Get('clients/search')
    async searchClients(@Query('q') query: string) {
        return this.proposalsService.searchClients(query);
    }

    @Get('client-history')
    async getClientHistory(@Query('clientName') clientName: string) {
        return this.proposalsService.getRecentProposalsByClient(clientName);
    }

    @Post()
    async create(@Request() req, @Body() createProposalDto: any) {
        return this.proposalsService.createProposal(req.user.id, createProposalDto);
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.proposalsService.getProposalById(id);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateData: any) {
        return this.proposalsService.updateProposal(id, updateData);
    }

    @Post(':id/items')
    async addItem(@Param('id') id: string, @Body() itemData: any) {
        return this.proposalsService.addProposalItem(id, itemData);
    }

    @Delete('items/:itemId')
    async removeItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeProposalItem(itemId);
    }

    @Get()
    async findAll(@Request() req) {
        return this.proposalsService.findAll(req.user);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.proposalsService.deleteProposal(id);
    }
}
