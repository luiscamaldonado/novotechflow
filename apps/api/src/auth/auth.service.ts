import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import type { JwtPayload, LoginResponse } from './dto/auth.dto';
import { EmailVerificationService } from './email-verification.service';

/** Response when login credentials are valid but 2FA is pending. */
export interface VerificationPendingResponse {
  requiresVerification: true;
  userId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailVerificationService: EmailVerificationService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (isMatch) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Validates credentials and sends a 2FA code via email.
   * Does NOT return a JWT — the client must call verifyAndLogin next.
   */
  async login(user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'COMMERCIAL';
    nomenclature: string;
    name: string;
  }): Promise<VerificationPendingResponse> {
    await this.emailVerificationService.sendVerificationCode(
      user.id,
      user.email,
      user.name,
    );

    return {
      requiresVerification: true,
      userId: user.id,
      email: user.email,
    };
  }

  /**
   * Validates the 2FA code and issues the JWT if correct.
   */
  async verifyAndLogin(
    userId: string,
    code: string,
  ): Promise<LoginResponse> {
    await this.emailVerificationService.verifyCode(userId, code);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      nomenclature: user.nomenclature,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        nomenclature: user.nomenclature,
      },
    };
  }

  /**
   * Re-sends a verification code if the user hasn't exceeded the rate limit.
   */
  async resendCode(
    userId: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const canResend =
      await this.emailVerificationService.canResendCode(userId);

    if (!canResend) {
      throw new BadRequestException(
        'Has solicitado demasiados c\u00f3digos. Espera 15 minutos.',
      );
    }

    await this.emailVerificationService.sendVerificationCode(
      user.id,
      user.email,
      user.name,
    );

    return { message: 'C\u00f3digo reenviado exitosamente.' };
  }
}
