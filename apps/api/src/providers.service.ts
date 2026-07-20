import { Injectable } from '@nestjs/common';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ProviderConnection = { baseUrl?: string; apiKey?: string };

@Injectable()
export class ProvidersService {
  private readonly deepseekKey = process.env.DEEPSEEK_API_KEY;
  private readonly deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

  deepseekStatus() {
    return { provider: 'DeepSeek', configured: Boolean(this.deepseekKey), baseUrl: this.deepseekBaseUrl, models: ['deepseek-chat', 'deepseek-reasoner'] };
  }

  async chat(messages: ChatMessage[], model = 'deepseek-chat', temperature = 0.7, connection?: ProviderConnection) {
    const apiKey = connection?.apiKey || this.deepseekKey;
    const baseUrl = (connection?.baseUrl || this.deepseekBaseUrl).replace(/\/$/, '');
    if (!apiKey) throw new Error('Provider API key is not configured');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });
    if (!response.ok) throw new Error(`DeepSeek API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }

  jimengStatus() {
    return { provider: 'Seedream', configured: Boolean(process.env.JIMENG_API_KEY), baseUrl: process.env.JIMENG_BASE_URL || '', models: ['seedream-4.0', 'seedream-4.5', 'seedream-5.0'], protocol: 'openai-images' };
  }

  async generateJimeng(body: { model?: string; prompt: string; n?: number; size?: string; image?: string[]; ratio?: string; resolution?: string; connection?: ProviderConnection }) {
    const key = body.connection?.apiKey || process.env.JIMENG_API_KEY;
    const baseUrl = (body.connection?.baseUrl || process.env.JIMENG_BASE_URL || '').replace(/\/$/, '');
    if (!key || !baseUrl) throw new Error('JIMENG_API_KEY and JIMENG_BASE_URL are required');
    const requestedModel = body.model || process.env.JIMENG_MODEL || 'seedream-4.5';
    const providerModels: Record<string, string> = {
      'seedream-4.0': 'doubao-seedream-4-0-250828',
      'seedream-4.5': 'doubao-seedream-4-5-251128',
      'seedream-5.0': 'doubao-seedream-5-0-260128',
    };
    const providerModel = providerModels[requestedModel] || requestedModel;
    const size = body.resolution?.toLowerCase() || body.size?.replace('*', 'x') || '1k';
    const response = await fetch(`${baseUrl}/v1/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: providerModel, prompt: body.prompt, n: body.n || 1, size, image: body.image, ratio: body.ratio }) });
    if (!response.ok) throw new Error(`Jimeng API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }
}
