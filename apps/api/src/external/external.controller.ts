import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ExternalAuthService } from './external-auth.service';
import {
  ExternalLoginDto,
  ExternalVerifyCodeDto,
  ExternalResendCodeDto,
} from './dto/external-auth.dto';

@ApiTags('external')
@Controller('external')
export class ExternalController {
  constructor(private externalAuthService: ExternalAuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: ExternalLoginDto) {
    return this.externalAuthService.login(dto.email, dto.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-code')
  async verifyCode(@Body() dto: ExternalVerifyCodeDto) {
    return this.externalAuthService.verifyAndLogin(dto.userId, dto.code);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-code')
  async resendCode(@Body() dto: ExternalResendCodeDto) {
    return this.externalAuthService.resendCode(dto.userId);
  }
}
