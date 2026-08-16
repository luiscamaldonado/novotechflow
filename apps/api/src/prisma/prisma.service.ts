import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = process.env.DATABASE_URL ?? '';
    let max: number | undefined;
    let connectionTimeoutMillis: number | undefined;
    try {
      const params = new URL(url).searchParams;
      const limit = params.get('connection_limit');
      const timeout = params.get('pool_timeout');
      max = limit ? Number(limit) : undefined;
      connectionTimeoutMillis = timeout ? Number(timeout) * 1000 : undefined;
    } catch {
      // URL invalida o vacia: el adapter fallara al conectar y lo reportara
    }
    const adapter = new PrismaPg({
      connectionString: url,
      max,
      connectionTimeoutMillis,
    });
    super({
      adapter,
      log: ['info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
