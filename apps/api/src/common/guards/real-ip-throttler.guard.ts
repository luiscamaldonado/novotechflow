import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// X-Real-IP y no req.ip: el edge de Railway appendea su propio salto a la
// derecha de X-Forwarded-For, asi que con trust proxy 1 req.ip resuelve la
// IP interna del edge, que rota entre peticiones y deja cada contador en 1
// (probe 2026-07-25 sobre 3266dee). X-Real-IP trae la IP real del cliente
// y el edge la reemplaza si el cliente la forja, asi que no es spoofeable
// desde fuera. Evidencia: anexo "throttler inoperante y trust proxy" en
// docs/diagnostico-2026-07-24-deps-bundle.md.
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  }): Promise<string> {
    const raw = req.headers?.['x-real-ip'];
    const realIp = Array.isArray(raw) ? raw[0] : raw;
    // Fallback a req.ip: en local no hay edge y X-Real-IP no llega.
    return realIp || req.ip || '';
  }
}
