import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  enabled = Boolean(process.env.DATABASE_URL);
  async onModuleInit() {
    if (!this.enabled) return;
    try { await this.$connect(); } catch { this.enabled = false; }
  }
  async onModuleDestroy() { if (this.enabled) await this.$disconnect(); }
}
