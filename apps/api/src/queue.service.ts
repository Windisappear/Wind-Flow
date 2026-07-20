import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class GenerationQueueService implements OnModuleInit, OnModuleDestroy {
  enabled = Boolean(process.env.REDIS_URL);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;
  async onModuleInit() {
    if (!this.enabled) return;
    try {
      this.connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
      this.queue = new Queue('generation', { connection: this.connection });
      this.worker = new Worker('generation', async (job) => ({ jobId: job.id, state: 'running' }), { connection: this.connection });
      await this.queue.waitUntilReady();
    } catch { this.enabled = false; await this.close(); }
  }
  async enqueue(data: Record<string, unknown>) { if (!this.queue) return null; const job = await this.queue.add('generation', data, { removeOnComplete: 100, removeOnFail: 100 }); return job.id; }
  async close() { await this.worker?.close(); await this.queue?.close(); await this.connection?.quit(); }
  async onModuleDestroy() { await this.close(); }
}
