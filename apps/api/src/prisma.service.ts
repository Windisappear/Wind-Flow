import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  enabled = Boolean(process.env.DATABASE_URL);
  async onModuleInit() { if (this.enabled) this.enabled = false; }
  async onModuleDestroy() {}
}
