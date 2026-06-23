import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ExternalJwtAuthGuard extends AuthGuard('jwt-external') {}
