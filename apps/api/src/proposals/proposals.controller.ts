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
@UseGuards(JwtAuthGuard)
export class ProposalsController {
    constructor(private readonly proposalsService: ProposalsService) {}

    /**
     * Busca propuestas recientes que puedan representar un cruce de cuenta.
     * Filtra por coincidencia parcial en nombre de cliente o asunto.
     *
     * @param {string} query - Término de búsqueda (nombre del cliente o asunto).
     * @returns {Promise<any[]>} Lista de propuestas candidatas a conflicto.
     *
     * @example GET /proposals/client-history?clientName=SURA
     */
    @Get('client-history')
    async getClientHistory(@Query('clientName') query: string) {
        return this.proposalsService.findPotentialConflicts(query);
    }

    /**
     * Crea una nueva propuesta comercial en estado borrador (DRAFT).
     * Registra automáticamente al cliente si no existe en el maestro.
     *
     * @param {Request} req - Request con el usuario autenticado (JWT payload).
     * @param {any} createProposalDto - Payload con datos de la propuesta.
     * @returns La propuesta recién creada con su código generado.
     */
    @Post()
    async create(@Request() req: any, @Body() createProposalDto: any) {
        return this.proposalsService.createProposal(req.user.id, createProposalDto);
    }

    /**
     * Obtiene una propuesta con todos sus ítems asociados.
     *
     * @param {string} id - UUID de la propuesta.
     * @returns La propuesta con sus ítems ordenados por sortOrder.
     * @throws {NotFoundException} Si la propuesta no existe.
     */
    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.proposalsService.getProposalById(id);
    }

    /**
     * Actualiza los datos generales de una propuesta existente.
     *
     * @param {string} id - UUID de la propuesta.
     * @param {any} updateData - Campos a actualizar (asunto, fechas, validez).
     */
    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateData: any) {
        return this.proposalsService.updateProposal(id, updateData);
    }

    /**
     * Añade un nuevo ítem (producto, software o servicio) a una propuesta.
     *
     * @param {string} id - UUID de la propuesta padre.
     * @param {any} itemData - Datos del ítem (nombre, marca, cantidades, precios).
     */
    @Post(':id/items')
    async addItem(@Param('id') id: string, @Body() itemData: any) {
        return this.proposalsService.addProposalItem(id, itemData);
    }

    /**
     * Elimina un ítem específico de una propuesta.
     *
     * @param {string} itemId - UUID del ítem a eliminar.
     */
    @Delete('items/:itemId')
    async removeItem(@Param('itemId') itemId: string) {
        return this.proposalsService.removeProposalItem(itemId);
    }

    /**
     * Actualiza un ítem específico de una propuesta.
     *
     * @param {string} itemId - UUID del ítem a actualizar.
     * @param {any} itemData - Datos del ítem a actualizar.
     */
    @Patch('items/:itemId')
    async updateItem(@Param('itemId') itemId: string, @Body() itemData: any) {
        return this.proposalsService.updateProposalItem(itemId, itemData);
    }

    /**
     * Lista todas las propuestas: ADMIN ve todas, COMERCIAL solo las propias.
     *
     * @param {Request} req - Request con el usuario autenticado.
     * @returns Lista de propuestas filtrada por rol.
     */
    @Get()
    async findAll(@Request() req: any) {
        return this.proposalsService.findAll(req.user);
    }

    /**
     * Elimina una propuesta y todos sus ítems asociados.
     *
     * @param {string} id - UUID de la propuesta a eliminar.
     */
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.proposalsService.deleteProposal(id);
    }
}
