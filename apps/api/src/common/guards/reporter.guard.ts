import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Injectable()
export class ReporterReadOnlyGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    if (request.user?.role === 'REPORTER' && request.method !== 'GET') {
      throw new ForbiddenException(
        'El rol REPORTER es de solo lectura: no puede crear, modificar ni eliminar.',
      );
    }
    return true;
  }
}
