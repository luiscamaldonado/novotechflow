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
            secretOrKey: process.env.JWT_SECRET || 'super-secret-novotechflow-key-change-me',
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
