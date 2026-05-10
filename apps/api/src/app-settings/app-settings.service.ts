import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Key used to store the inactivity timeout setting */
export const INACTIVITY_TIMEOUT_KEY = 'inactivity_timeout_minutes';

/** Default timeout in minutes when no setting exists yet */
const DEFAULT_INACTIVITY_MINUTES = 5;

/**
 * @class AppSettingsService
 * Servicio para gestionar configuraciones globales de la aplicación.
 * Cada setting es un par key-value en la tabla `app_settings`.
 */
@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el timeout de inactividad en minutos.
   * Si el registro no existe, lo crea con el valor por defecto (idempotente).
   */
  async getInactivityTimeoutMinutes(): Promise<number> {
    const setting = await this.prisma.appSetting.upsert({
      where: { key: INACTIVITY_TIMEOUT_KEY },
      update: {},
      create: {
        key: INACTIVITY_TIMEOUT_KEY,
        value: String(DEFAULT_INACTIVITY_MINUTES),
        description: 'Minutos de inactividad antes de cerrar sesión automáticamente',
      },
    });

    return Number(setting.value);
  }

  /**
   * Actualiza el timeout de inactividad.
   * @param minutes — nuevo valor en minutos (ya validado por DTO: 2..60).
   * @param userId — ID del admin que realiza el cambio (audit trail).
   * @returns el nuevo valor en minutos.
   */
  async updateInactivityTimeoutMinutes(minutes: number, userId: string): Promise<number> {
    const updated = await this.prisma.appSetting.update({
      where: { key: INACTIVITY_TIMEOUT_KEY },
      data: {
        value: String(minutes),
        updatedById: userId,
      },
    });

    return Number(updated.value);
  }
}
