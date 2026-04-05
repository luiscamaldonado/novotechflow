import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './dto/auth.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private usersService: UsersService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: (() => {
                if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
                return process.env.JWT_SECRET;
            })(),
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.usersService.findOneById(payload.sub);
        if (!user || (!user.isActive)) {
            throw new UnauthorizedException('User is inactive or deleted');
        }
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            nomenclature: payload.nomenclature
        };
    }
}
