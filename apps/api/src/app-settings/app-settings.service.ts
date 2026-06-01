import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Key used to store the inactivity timeout setting */
export const INACTIVITY_TIMEOUT_KEY = 'inactivity_timeout_minutes';

/** Key del mensaje del banner de mantenimiento. */
export const MAINTENANCE_BANNER_MESSAGE_KEY = 'maintenance_banner_message';

/** Key del flag on/off del banner de mantenimiento. */
export const MAINTENANCE_BANNER_ACTIVE_KEY = 'maintenance_banner_active';

/** Default timeout in minutes when no setting exists yet */
const DEFAULT_INACTIVITY_MINUTES = 5;

/**
 * @class AppSettingsService
 * Servicio para gestionar configuraciones globales de la aplicación.
 * Cada setting es un par key-value en la tabla `app_settings`.
 */
/** Estado del banner de mantenimiento expuesto a la app. */
export interface MaintenanceBanner {
  message: string;
  active: boolean;
}

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

  /**
   * Obtiene el banner de mantenimiento. Crea ambas keys con valores por defecto
   * si no existen (idempotente), igual que el timeout de inactividad.
   */
  async getMaintenanceBanner(): Promise<MaintenanceBanner> {
    const messageSetting = await this.prisma.appSetting.upsert({
      where: { key: MAINTENANCE_BANNER_MESSAGE_KEY },
      update: {},
      create: {
        key: MAINTENANCE_BANNER_MESSAGE_KEY,
        value: '',
        description: 'Mensaje del banner de mantenimiento programado',
      },
    });

    const activeSetting = await this.prisma.appSetting.upsert({
      where: { key: MAINTENANCE_BANNER_ACTIVE_KEY },
      update: {},
      create: {
        key: MAINTENANCE_BANNER_ACTIVE_KEY,
        value: 'false',
        description: 'Indica si el banner de mantenimiento est\u00e1 visible',
      },
    });

    return {
      message: messageSetting.value,
      active: activeSetting.value === 'true',
    };
  }

  /**
   * Actualiza el banner de mantenimiento (mensaje + flag activo).
   * @param message \u2014 texto del banner (ya validado por DTO).
   * @param active \u2014 visibilidad del banner (ya validado por DTO).
   * @param userId \u2014 ID del admin que realiza el cambio (audit trail).
   */
  async updateMaintenanceBanner(
    message: string,
    active: boolean,
    userId: string,
  ): Promise<MaintenanceBanner> {
    await this.prisma.appSetting.update({
      where: { key: MAINTENANCE_BANNER_MESSAGE_KEY },
      data: { value: message, updatedById: userId },
    });

    await this.prisma.appSetting.update({
      where: { key: MAINTENANCE_BANNER_ACTIVE_KEY },
      data: { value: String(active), updatedById: userId },
    });

    return { message, active };
  }
}
