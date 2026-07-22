import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * @module SuppliersModule
 * Catalogo global de proveedores (empresas + contactos).
 * Lectura y creacion para cualquier usuario autenticado (sin AdminGuard).
 */
@Module({
  imports: [PrismaModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
