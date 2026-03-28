import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { JwtPayload, LoginResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) { }

    async validateUser(email: string, pass: string) {
        const user = await this.usersService.findOneByEmail(email);
        if (!user) {
            return null;
        }

        const isMatch = await bcrypt.compare(pass, user.passwordHash);
        if (isMatch) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: { id: string; email: string; role: 'ADMIN' | 'COMMERCIAL'; nomenclature: string; name: string }): Promise<LoginResponse> {
        const payload: JwtPayload = {
            email: user.email,
            sub: user.id,
            role: user.role,
            nomenclature: user.nomenclature
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                nomenclature: user.nomenclature
            }
        };
    }
}
