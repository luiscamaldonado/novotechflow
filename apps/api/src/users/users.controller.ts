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
