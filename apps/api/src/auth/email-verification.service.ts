import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const CODE_LENGTH = 6;
const BCRYPT_ROUNDS = 10;
const CODE_EXPIRATION_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 3;

@Injectable()
export class EmailVerificationService {
  private resend: Resend;

  constructor(private prisma: PrismaService) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is required');
    this.resend = new Resend(apiKey);
  }

  /**
   * Generates a 6-digit code, hashes it with bcrypt, stores it in DB,
   * invalidates any previous codes for this user, and sends it via email.
   */
  async sendVerificationCode(
    userId: string,
    email: string,
    userName: string,
  ): Promise<void> {
    await this.prisma.verificationCode.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    // Must be a CSPRNG: this code is the only secret exchanged for a JWT.
    const code = crypto
      .randomInt(Math.pow(10, CODE_LENGTH - 1), Math.pow(10, CODE_LENGTH))
      .toString();

    // bcrypt y no sha256 pelado: el espacio del codigo es 10^6, asi que un
    // sha256 sin KDF se invierte al instante con la base en la mano. El costo
    // de bcrypt lo hace inviable, y su compare es de tiempo constante.
    const hashedCode = await bcrypt.hash(code, BCRYPT_ROUNDS);

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt: new Date(Date.now() + CODE_EXPIRATION_MS),
      },
    });

    const from =
      process.env.RESEND_FROM || 'NovoTechFlow <onboarding@resend.dev>';

    await this.resend.emails.send({
      from,
      to: [email],
      subject: 'C\u00f3digo de verificaci\u00f3n - NovoTechFlow',
      html: this.buildEmailHtml(userName, code),
    });
  }

  /**
   * Validates a code against the stored hash.
   * Throws if invalid, expired, or too many attempts.
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'C\u00f3digo expirado o no encontrado. Solicita uno nuevo.',
      );
    }

    // Consume one attempt atomically BEFORE comparing the code: the conditional
    // UPDATE is the cap check, so concurrent requests cannot each get a free
    // guess by reading the same stale `attempts` value. Postgres re-evaluates
    // the WHERE after taking the row lock, so at most MAX_ATTEMPTS increments
    // can succeed per code.
    const consumed = await this.prisma.verificationCode.updateMany({
      where: {
        id: record.id,
        used: false,
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });

    if (consumed.count === 0) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { used: true },
      });
      throw new BadRequestException(
        'M\u00e1ximo de intentos alcanzado. Solicita un nuevo c\u00f3digo.',
      );
    }

    if (!(await bcrypt.compare(code, record.code))) {
      // The attempt was already consumed above; read the counter back so the
      // message is not derived from the stale `record` read.
      const current = await this.prisma.verificationCode.findUnique({
        where: { id: record.id },
        select: { attempts: true },
      });

      const remaining = MAX_ATTEMPTS - (current?.attempts ?? MAX_ATTEMPTS);
      throw new UnauthorizedException(
        remaining > 0
          ? `C\u00f3digo incorrecto. Te quedan ${remaining} intento(s).`
          : 'C\u00f3digo incorrecto. Solicita un nuevo c\u00f3digo.',
      );
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    });

    return true;
  }

  /**
   * Checks if user can request a new code (max 3 codes in last 15 minutes).
   */
  async canResendCode(userId: string): Promise<boolean> {
    const recentCodes = await this.prisma.verificationCode.count({
      where: {
        userId,
        createdAt: {
          gt: new Date(Date.now() - RESEND_WINDOW_MS),
        },
      },
    });
    return recentCodes < MAX_CODES_PER_WINDOW;
  }

  /** Builds the branded HTML email body for the verification code. */
  private buildEmailHtml(userName: string, code: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #E8590C; margin-bottom: 8px;">NovoTechFlow</h2>
        <p style="color: #333; font-size: 16px;">Hola ${userName},</p>
        <p style="color: #666; font-size: 14px;">Tu c\u00f3digo de verificaci\u00f3n es:</p>
        <div style="background: #FFF3E0; border: 2px solid #E8590C; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #E8590C;">${code}</span>
        </div>
        <p style="color: #666; font-size: 13px;">Este c\u00f3digo expira en <strong>5 minutos</strong>.</p>
        <p style="color: #999; font-size: 12px;">Si no solicitaste este c\u00f3digo, ignora este mensaje.</p>
      </div>
    `;
  }
}
