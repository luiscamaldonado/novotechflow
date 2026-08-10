import { Module } from '@nestjs/common';
import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';

/**
 * @module AppSettingsModule
 * Módulo NestJS para la gestión de configuraciones globales de la aplicación.
 *
 * @description
 * Responsabilidades:
 * - Lectura de settings para cualquier usuario autenticado.
 * - Escritura de settings restringida a administradores.
 * - Actualmente gestiona: inactivity_timeout_minutes.
 */
@Module({
  controllers: [AppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
