import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { EmailVerificationService } from '../auth/email-verification.service';
import { UsersService } from '../users/users.service';
import type {
  ExternalJwtPayload,
  ExternalVerificationPendingResponse,
  ExternalLoginResponse,
} from './dto/external-auth.dto';

@Injectable()
export class ExternalAuthService {
  constructor(
    private authService: AuthService,
    private emailVerificationService: EmailVerificationService,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<ExternalVerificationPendingResponse> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  async verifyAndLogin(
    userId: string,
    code: string,
  ): Promise<ExternalLoginResponse> {
    await this.emailVerificationService.verifyCode(userId, code);

    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: ExternalJwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async resendCode(userId: string): Promise<{ message: string }> {
    return this.authService.resendCode(userId);
  }
}
