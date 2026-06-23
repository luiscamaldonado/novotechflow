import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { ExternalJwtPayload, ExternalAuthUser } from './dto/external-auth.dto';

@Injectable()
export class ExternalJwtStrategy extends PassportStrategy(Strategy, 'jwt-external') {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        if (!process.env.EXTERNAL_JWT_SECRET)
          throw new Error('EXTERNAL_JWT_SECRET env var is required');
        return process.env.EXTERNAL_JWT_SECRET;
      })(),
    });
  }

  async validate(payload: ExternalJwtPayload): Promise<ExternalAuthUser> {
    const user = await this.usersService.findOneById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive or deleted');
    }
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
