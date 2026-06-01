import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Ventana (ms) dentro de la cual un usuario se considera con sesi\u00f3n activa. */
const PRESENCE_ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;

/** Usuario con sesi\u00f3n activa, proyecci\u00f3n m\u00ednima para el panel del admin. */
export interface ActiveUser {
  name: string;
  nomenclature: string;
  lastSeenAt: Date | null;
}

/**
 * @class PresenceService
 * Gestiona la presencia de usuarios v\u00eda heartbeat.
 */
@Injectable()
export class PresenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra actividad del usuario actualizando su lastSeenAt a ahora. */
  async updateHeartbeat(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  }

  /** Devuelve los usuarios activos (lastSeenAt dentro del umbral) y habilitados. */
  async getActiveUsers(): Promise<ActiveUser[]> {
    const threshold = new Date(Date.now() - PRESENCE_ACTIVE_THRESHOLD_MS);
    return this.prisma.user.findMany({
      where: { isActive: true, lastSeenAt: { gte: threshold } },
      select: { name: true, nomenclature: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }
}
