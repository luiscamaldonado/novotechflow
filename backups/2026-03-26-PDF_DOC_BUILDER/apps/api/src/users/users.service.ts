import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findOneByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findOneById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async createUser(data: Prisma.UserCreateInput): Promise<User> {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { nomenclature: data.nomenclature }],
            },
        });

        if (existingUser) {
            throw new ConflictException('Email or nomenclature already exists');
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(data.passwordHash, saltRounds);

        return this.prisma.user.create({
            data: {
                ...data,
                passwordHash,
            },
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                nomenclature: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({
            where: { id }
        });
    }
}
