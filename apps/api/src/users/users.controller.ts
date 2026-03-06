import { Controller, Get, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

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
    async create(@Body() createUserDto: any) {
        // En una app real de NestJS se usarían clases DTO con class-validator. 
        // Para este MVP pasaremos el body directo. 
        // Nota: Asegúrate de mandar passwordHash desde el frontend o cambiar la lógica.
        // Aquí ajustamos para recibir "password" y enviarlo como passwordHash
        return this.usersService.createUser({
            email: createUserDto.email,
            name: createUserDto.name,
            role: createUserDto.role,
            nomenclature: createUserDto.nomenclature,
            passwordHash: createUserDto.password, // El servicio de usuarios lo va a hashear
        });
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    async remove(@Param('id') id: string) {
        return this.usersService.deleteUser(id);
    }
}
