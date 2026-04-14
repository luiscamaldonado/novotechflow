import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';
import * as crypto from 'crypto';

const CODE_LENGTH = 6;
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
   * Generates a 6-digit code, hashes it, stores it in DB,
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

    const code = Math.floor(
      Math.pow(10, CODE_LENGTH - 1) +
        Math.random() * 9 * Math.pow(10, CODE_LENGTH - 1),
    ).toString();

    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt: new Date(Date.now() + CODE_EXPIRATION_MS),
      },
    });

    const from =
      process.env.RESEND_FROM ||
      'NovoTechFlow <onboarding@resend.dev>';

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

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { used: true },
      });
      throw new BadRequestException(
        'M\u00e1ximo de intentos alcanzado. Solicita un nuevo c\u00f3digo.',
      );
    }

    const hashedInput = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    if (hashedInput !== record.code) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining = MAX_ATTEMPTS - 1 - record.attempts;
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
