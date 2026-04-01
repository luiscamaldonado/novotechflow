import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Request } from '@nestjs/common';
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
    async update(@Param('id') id: string, @Body() data: UpdateBillingProjectionDto) {
        return this.service.update(id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.service.delete(id);
    }
}
