import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSupplierFieldRequirementsDto } from './dto/update-supplier-field-requirements.dto';

/** Key used to store the inactivity timeout setting */
export const INACTIVITY_TIMEOUT_KEY = 'inactivity_timeout_minutes';

/** Key del mensaje del banner de mantenimiento. */
export const MAINTENANCE_BANNER_MESSAGE_KEY = 'maintenance_banner_message';

/** Key del flag on/off del banner de mantenimiento. */
export const MAINTENANCE_BANNER_ACTIVE_KEY = 'maintenance_banner_active';

/** Key del piso mínimo de precio unitario en COP (alerta de validación). */
export const COP_MIN_UNIT_PRICE_KEY = 'cop_min_unit_price';

/** Key del techo máximo de precio unitario en USD (alerta de validación). */
export const USD_MAX_UNIT_PRICE_KEY = 'usd_max_unit_price';

/** Key del flag de obligatoriedad del nombre de contacto del proveedor. */
export const SUPPLIER_CONTACT_NAME_REQUIRED_KEY = 'supplier_contact_name_required';

/** Key del flag de obligatoriedad del telefono de contacto del proveedor. */
export const SUPPLIER_CONTACT_PHONE_REQUIRED_KEY = 'supplier_contact_phone_required';

/** Key del flag de obligatoriedad del correo de contacto del proveedor. */
export const SUPPLIER_CONTACT_EMAIL_REQUIRED_KEY = 'supplier_contact_email_required';

/** Default timeout in minutes when no setting exists yet */
const DEFAULT_INACTIVITY_MINUTES = 5;

/** Default del piso COP cuando no existe el registro aún. */
const DEFAULT_COP_MIN_UNIT_PRICE = 50000;

/** Default del techo USD cuando no existe el registro aún. */
const DEFAULT_USD_MAX_UNIT_PRICE = 100000;

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

/** Umbrales de validación de precio unitario expuestos a la app. */
export interface PriceThresholds {
  copMinUnitPrice: number;
  usdMaxUnitPrice: number;
}

/** Obligatoriedad de los campos de contacto de proveedor expuesta a la app. */
export interface SupplierFieldRequirements {
  nameRequired: boolean;
  phoneRequired: boolean;
  emailRequired: boolean;
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
        description:
          'Minutos de inactividad antes de cerrar sesión automáticamente',
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
  async updateInactivityTimeoutMinutes(
    minutes: number,
    userId: string,
  ): Promise<number> {
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
   * Obtiene el banner de mantenimiento. Lectura pura: si alguna key no existe
   * aun, devuelve los defaults en memoria sin escribir en la base de datos.
   */
  async getMaintenanceBanner(): Promise<MaintenanceBanner> {
    const settings = await this.prisma.appSetting.findMany({
      where: {
        key: { in: [MAINTENANCE_BANNER_MESSAGE_KEY, MAINTENANCE_BANNER_ACTIVE_KEY] },
      },
    });

    const messageSetting = settings.find((s) => s.key === MAINTENANCE_BANNER_MESSAGE_KEY);
    const activeSetting = settings.find((s) => s.key === MAINTENANCE_BANNER_ACTIVE_KEY);

    return {
      message: messageSetting?.value ?? '',
      active: activeSetting?.value === 'true',
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
    await this.prisma.appSetting.upsert({
      where: { key: MAINTENANCE_BANNER_MESSAGE_KEY },
      update: { value: message, updatedById: userId },
      create: {
        key: MAINTENANCE_BANNER_MESSAGE_KEY,
        value: message,
        description: 'Mensaje del banner de mantenimiento programado',
        updatedById: userId,
      },
    });

    await this.prisma.appSetting.upsert({
      where: { key: MAINTENANCE_BANNER_ACTIVE_KEY },
      update: { value: String(active), updatedById: userId },
      create: {
        key: MAINTENANCE_BANNER_ACTIVE_KEY,
        value: String(active),
        description: 'Indica si el banner de mantenimiento está visible',
        updatedById: userId,
      },
    });

    return { message, active };
  }

  /**
   * Obtiene los umbrales de validación de precio unitario.
   * Crea ambas keys con sus defaults si no existen (idempotente).
   */
  async getPriceThresholds(): Promise<PriceThresholds> {
    const copSetting = await this.prisma.appSetting.upsert({
      where: { key: COP_MIN_UNIT_PRICE_KEY },
      update: {},
      create: {
        key: COP_MIN_UNIT_PRICE_KEY,
        value: String(DEFAULT_COP_MIN_UNIT_PRICE),
        description:
          'Piso m\u00ednimo de precio unitario en COP para alertar valores sospechosamente bajos',
      },
    });

    const usdSetting = await this.prisma.appSetting.upsert({
      where: { key: USD_MAX_UNIT_PRICE_KEY },
      update: {},
      create: {
        key: USD_MAX_UNIT_PRICE_KEY,
        value: String(DEFAULT_USD_MAX_UNIT_PRICE),
        description:
          'Techo m\u00e1ximo de precio unitario en USD para alertar valores sospechosamente altos',
      },
    });

    return {
      copMinUnitPrice: Number(copSetting.value),
      usdMaxUnitPrice: Number(usdSetting.value),
    };
  }

  /**
   * Actualiza los umbrales de validación de precio unitario.
   * @param copMinUnitPrice — piso COP (ya validado por DTO).
   * @param usdMaxUnitPrice — techo USD (ya validado por DTO).
   * @param userId — ID del admin que realiza el cambio (audit trail).
   */
  async updatePriceThresholds(
    copMinUnitPrice: number,
    usdMaxUnitPrice: number,
    userId: string,
  ): Promise<PriceThresholds> {
    await this.prisma.appSetting.update({
      where: { key: COP_MIN_UNIT_PRICE_KEY },
      data: { value: String(copMinUnitPrice), updatedById: userId },
    });

    await this.prisma.appSetting.update({
      where: { key: USD_MAX_UNIT_PRICE_KEY },
      data: { value: String(usdMaxUnitPrice), updatedById: userId },
    });

    return { copMinUnitPrice, usdMaxUnitPrice };
  }

  /**
   * Obtiene la obligatoriedad de los campos de contacto de proveedor.
   * Crea las 3 keys con default 'true' si no existen (idempotente).
   */
  async getSupplierFieldRequirements(): Promise<SupplierFieldRequirements> {
    const nameSetting = await this.prisma.appSetting.upsert({
      where: { key: SUPPLIER_CONTACT_NAME_REQUIRED_KEY },
      update: {},
      create: {
        key: SUPPLIER_CONTACT_NAME_REQUIRED_KEY,
        value: 'true',
        description:
          'Indica si el nombre de contacto del proveedor es obligatorio',
      },
    });

    const phoneSetting = await this.prisma.appSetting.upsert({
      where: { key: SUPPLIER_CONTACT_PHONE_REQUIRED_KEY },
      update: {},
      create: {
        key: SUPPLIER_CONTACT_PHONE_REQUIRED_KEY,
        value: 'true',
        description:
          'Indica si el telefono de contacto del proveedor es obligatorio',
      },
    });

    const emailSetting = await this.prisma.appSetting.upsert({
      where: { key: SUPPLIER_CONTACT_EMAIL_REQUIRED_KEY },
      update: {},
      create: {
        key: SUPPLIER_CONTACT_EMAIL_REQUIRED_KEY,
        value: 'true',
        description:
          'Indica si el correo de contacto del proveedor es obligatorio',
      },
    });

    return {
      nameRequired: nameSetting.value === 'true',
      phoneRequired: phoneSetting.value === 'true',
      emailRequired: emailSetting.value === 'true',
    };
  }

  /**
   * Actualiza la obligatoriedad de los campos de contacto de proveedor.
   * Solo toca las keys presentes en el dto (PATCH parcial).
   */
  async updateSupplierFieldRequirements(
    dto: UpdateSupplierFieldRequirementsDto,
    userId: string,
  ): Promise<SupplierFieldRequirements> {
    if (dto.nameRequired !== undefined) {
      await this.prisma.appSetting.upsert({
        where: { key: SUPPLIER_CONTACT_NAME_REQUIRED_KEY },
        update: { value: String(dto.nameRequired), updatedById: userId },
        create: {
          key: SUPPLIER_CONTACT_NAME_REQUIRED_KEY,
          value: String(dto.nameRequired),
          description:
            'Indica si el nombre de contacto del proveedor es obligatorio',
          updatedById: userId,
        },
      });
    }

    if (dto.phoneRequired !== undefined) {
      await this.prisma.appSetting.upsert({
        where: { key: SUPPLIER_CONTACT_PHONE_REQUIRED_KEY },
        update: { value: String(dto.phoneRequired), updatedById: userId },
        create: {
          key: SUPPLIER_CONTACT_PHONE_REQUIRED_KEY,
          value: String(dto.phoneRequired),
          description:
            'Indica si el telefono de contacto del proveedor es obligatorio',
          updatedById: userId,
        },
      });
    }

    if (dto.emailRequired !== undefined) {
      await this.prisma.appSetting.upsert({
        where: { key: SUPPLIER_CONTACT_EMAIL_REQUIRED_KEY },
        update: { value: String(dto.emailRequired), updatedById: userId },
        create: {
          key: SUPPLIER_CONTACT_EMAIL_REQUIRED_KEY,
          value: String(dto.emailRequired),
          description:
            'Indica si el correo de contacto del proveedor es obligatorio',
          updatedById: userId,
        },
      });
    }

    return this.getSupplierFieldRequirements();
  }
}
