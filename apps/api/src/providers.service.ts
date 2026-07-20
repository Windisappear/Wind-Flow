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
}
