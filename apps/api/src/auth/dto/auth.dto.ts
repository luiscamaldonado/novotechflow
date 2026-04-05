import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO para la petición de login.
 */
export class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

/**
 * Payload del JWT decodificado.
 */
export interface JwtPayload {
    sub: string;
    email: string;
    role: 'ADMIN' | 'COMMERCIAL';
    nomenclature: string;
}

/**
 * Usuario autenticado inyectado en @Request() por Passport.
 */
export interface AuthenticatedUser {
    id: string;
    email: string;
    role: 'ADMIN' | 'COMMERCIAL';
    nomenclature: string;
}

/**
 * Respuesta del endpoint de login.
 */
export interface LoginResponse {
    access_token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        nomenclature: string;
    };
}
