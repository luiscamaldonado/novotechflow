import { Module } from '@nestjs/common';
import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * @module AppSettingsModule
 * Módulo NestJS para la gestión de configuraciones globales de la aplicación.
 *
 * @description
 * Responsabilidades:
 * - Lectura de settings para cualquier usuario autenticado.
 * - Escritura de settings restringida a administradores.
 * - Actualmente gestiona: inactivity_timeout_minutes.
 *
 * @dependencies PrismaModule (acceso a base de datos).
 */
@Module({
  imports: [PrismaModule],
  controllers: [AppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
