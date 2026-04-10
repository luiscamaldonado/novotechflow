import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

/**
 * Guard que extiende JwtAuthGuard para restringir acceso exclusivamente a administradores.
 * Primero verifica autenticación JWT y luego valida que el rol sea ADMIN.
 */
@Injectable()
export class AdminGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest();

    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo administradores pueden acceder a este recurso.',
      );
    }

    return true;
  }
}
