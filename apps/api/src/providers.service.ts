import { Injectable } from '@nestjs/common';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class ProvidersService {
  private readonly deepseekKey = process.env.DEEPSEEK_API_KEY;
  private readonly deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

  deepseekStatus() {
    return { provider: 'DeepSeek', configured: Boolean(this.deepseekKey), baseUrl: this.deepseekBaseUrl, models: ['deepseek-chat', 'deepseek-reasoner'] };
  }

  async chat(messages: ChatMessage[], model = 'deepseek-chat', temperature = 0.7) {
    if (!this.deepseekKey) throw new Error('DEEPSEEK_API_KEY is not configured');
    const response = await fetch(`${this.deepseekBaseUrl}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.deepseekKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });
    if (!response.ok) throw new Error(`DeepSeek API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }

  jimengStatus() {
    return { provider: 'Jimeng', configured: Boolean(process.env.JIMENG_API_KEY), baseUrl: process.env.JIMENG_BASE_URL || '', models: ['jimeng-4.0', 'jimeng-4.5'], protocol: 'openai-images' };
  }

  async generateJimeng(body: { model?: string; prompt: string; n?: number; size?: string; image?: string[]; ratio?: string; resolution?: string }) {
    const key = process.env.JIMENG_API_KEY;
    const baseUrl = (process.env.JIMENG_BASE_URL || '').replace(/\/$/, '');
    if (!key || !baseUrl) throw new Error('JIMENG_API_KEY and JIMENG_BASE_URL are required');
    const response = await fetch(`${baseUrl}/v1/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: body.model || process.env.JIMENG_MODEL || 'jimeng-4.5', prompt: body.prompt, n: body.n || 1, size: body.size || '1024*1024', image: body.image, ratio: body.ratio, resolution: body.resolution }) });
    if (!response.ok) throw new Error(`Jimeng API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }
}
