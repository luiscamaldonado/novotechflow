import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AppSettingsService } from './app-settings.service';
import { UpdateInactivityTimeoutDto } from './dto/update-inactivity-timeout.dto';
import { UpdateMaintenanceBannerDto } from './dto/update-maintenance-banner.dto';
import { UpdatePriceThresholdsDto } from './dto/update-price-thresholds.dto';
import type {
  MaintenanceBanner,
  PriceThresholds,
} from './app-settings.service';

/** Typed request after JWT authentication — mirrors the pattern in users.controller.ts */
interface AuthenticatedRequest {
  user: { id: string; role: string };
}

/**
 * @class AppSettingsController
 * Controlador REST para configuraciones globales de la aplicación.
 * GET endpoints disponibles para cualquier usuario autenticado.
 * PATCH endpoints restringidos a administradores.
 */
@Controller('app-settings')
@ApiTags('app-settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get('inactivity-timeout')
  @ApiOperation({ summary: 'Obtener timeout de inactividad (minutos)' })
  async getInactivityTimeout(): Promise<{ minutes: number }> {
    const minutes = await this.appSettingsService.getInactivityTimeoutMinutes();
    return { minutes };
  }

  @Patch('inactivity-timeout')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Actualizar timeout de inactividad (solo admin)' })
  async updateInactivityTimeout(
    @Body() dto: UpdateInactivityTimeoutDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ minutes: number }> {
    const minutes =
      await this.appSettingsService.updateInactivityTimeoutMinutes(
        dto.minutes,
        req.user.id,
      );
    return { minutes };
  }

  @Get('maintenance-banner')
  @SkipThrottle()
  @ApiOperation({ summary: 'Obtener el banner de mantenimiento' })
  async getMaintenanceBanner(): Promise<MaintenanceBanner> {
    return this.appSettingsService.getMaintenanceBanner();
  }

  @Patch('maintenance-banner')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Actualizar el banner de mantenimiento (solo admin)',
  })
  async updateMaintenanceBanner(
    @Body() dto: UpdateMaintenanceBannerDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MaintenanceBanner> {
    return this.appSettingsService.updateMaintenanceBanner(
      dto.message,
      dto.active,
      req.user.id,
    );
  }

  @Get('price-thresholds')
  @ApiOperation({
    summary: 'Obtener umbrales de validaci\u00f3n de precio unitario',
  })
  async getPriceThresholds(): Promise<PriceThresholds> {
    return this.appSettingsService.getPriceThresholds();
  }

  @Patch('price-thresholds')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Actualizar umbrales de precio unitario (solo admin)',
  })
  async updatePriceThresholds(
    @Body() dto: UpdatePriceThresholdsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PriceThresholds> {
    return this.appSettingsService.updatePriceThresholds(
      dto.copMinUnitPrice,
      dto.usdMaxUnitPrice,
      req.user.id,
    );
  }
}
