import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// req.ip y no X-Real-IP: ese header lo escribe el cliente y su saneamiento
// depende de que el edge lo sobrescriba, propiedad no contractual del
// proveedor. Con trust proxy 2 (medicion 2026-08-20: el edge appendea su
// propio salto a la derecha, XFF = "IP del cliente, salto interno rotante")
// req.ip resuelve la IP real del cliente por posicion, asi que una entrada
// forjada queda siempre a la izquierda del truncado, sobrescriba o appendee
// el edge. Ver ADR-071 (por que se abandono req.ip con trust proxy 1) y el
// ADR que cierra F9.
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: {
    ip?: string;
    socket?: { remoteAddress?: string };
  }): Promise<string> {
    // Fallback al socket: si XFF faltara, sobre-limita (todos comparten
    // tracker) en vez de dejar de contar. Falla cerrado, nunca abierto.
    return req.ip ?? req.socket?.remoteAddress ?? '';
  }
}
