import { Controller, Post, Get, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PresenceService, type ActiveUser } from './presence.service';

/** Request tipado tras JWT \u2014 mismo patr\u00f3n que app-settings.controller.ts */
interface AuthenticatedRequest {
  user: { id: string; role: string };
}

@Controller('presence')
@ApiTags('presence')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('heartbeat')
  @SkipThrottle()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Registrar actividad del usuario (heartbeat)' })
  async heartbeat(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.presenceService.updateHeartbeat(req.user.id);
  }

  @Get('active')
  @SkipThrottle()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Listar usuarios con sesi\u00f3n activa (solo admin)' })
  async getActive(): Promise<ActiveUser[]> {
    return this.presenceService.getActiveUsers();
  }
}
