import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  BillingProjectionsService,
  CreateBillingProjectionDto,
  UpdateBillingProjectionDto,
} from './billing-projections.service';
import { ReporterReadOnlyGuard } from '../common/guards/reporter.guard';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

@ApiTags('Billing Projections')
@ApiBearerAuth()
@UseGuards(ReporterReadOnlyGuard)
@Controller('billing-projections')
export class BillingProjectionsController {
  constructor(private readonly service: BillingProjectionsService) {}

  @Get()
  async findAll(@Request() req: { user: AuthenticatedUser }) {
    return this.service.findAll(req.user);
  }

  @Post()
  async create(
    @Request() req: { user: AuthenticatedUser },
    @Body() data: CreateBillingProjectionDto,
  ) {
    return this.service.create(req.user.id, data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateBillingProjectionDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.service.update(id, data, req.user);
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.service.delete(id, req.user);
  }
}
