import { Injectable } from '@nestjs/common';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ProviderConnection = { baseUrl?: string; apiKey?: string };
type VideoInput = { model?: string; prompt: string; attachments?: Array<{ url: string; type: string }>; ratio?: string; resolution?: string; duration?: number; generateAudio?: boolean; watermark?: boolean; returnLastFrame?: boolean; serviceTier?: 'default' | 'flex'; priority?: number; connection?: ProviderConnection };

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

  volcengineVideoStatus() { return { provider: 'Volcengine Ark', configured: Boolean(process.env.ARK_API_KEY), baseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-seedance-2-0-260128'], protocol: 'ark-content-generation' }; }

  private videoConnection(connection?: ProviderConnection) {
    const apiKey = connection?.apiKey || process.env.ARK_API_KEY;
    const baseUrl = (connection?.baseUrl || process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
    if (!apiKey) throw new Error('ARK_API_KEY is not configured');
    return { apiKey, baseUrl };
  }

  private async videoRequest(path: string, init: RequestInit, connection?: ProviderConnection) {
    const { apiKey, baseUrl } = this.videoConnection(connection);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`Volcengine Ark video API ${response.status}: ${(await response.text()).slice(0, 800)}`);
    return response.json();
  }

  createVideoTask(input: VideoInput) {
    const content: Array<Record<string, unknown>> = input.prompt.trim() ? [{ type: 'text', text: input.prompt }] : [];
    for (const attachment of input.attachments || []) {
      if (!/^https?:\/\//.test(attachment.url)) continue;
      if (attachment.type.startsWith('image/')) content.push({ type: 'image_url', image_url: { url: attachment.url }, role: 'reference_image' });
      if (attachment.type.startsWith('video/')) content.push({ type: 'video_url', video_url: { url: attachment.url }, role: 'reference_video' });
      if (attachment.type.startsWith('audio/')) content.push({ type: 'audio_url', audio_url: { url: attachment.url }, role: 'reference_audio' });
    }
    if (!content.length) throw new Error('Video prompt or remote reference media is required');
    return this.videoRequest('/contents/generations/tasks', { method: 'POST', body: JSON.stringify({ model: input.model || 'doubao-seedance-2-0-260128', content, ratio: input.ratio, resolution: input.resolution?.toLowerCase(), duration: input.duration, generate_audio: input.generateAudio, watermark: input.watermark, return_last_frame: input.returnLastFrame, service_tier: input.serviceTier, priority: input.priority }) }, input.connection);
  }

  getVideoTask(id: string, connection?: ProviderConnection) { return this.videoRequest(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'GET' }, connection); }
  listVideoTasks(query: { pageNum?: number; pageSize?: number; status?: string; model?: string; serviceTier?: string }, connection?: ProviderConnection) { const params = new URLSearchParams(); params.set('page_num', String(query.pageNum || 1)); params.set('page_size', String(query.pageSize || 20)); if (query.status) params.set('filter.status', query.status); if (query.model) params.set('filter.model', query.model); if (query.serviceTier) params.set('filter.service_tier', query.serviceTier); return this.videoRequest(`/contents/generations/tasks?${params}`, { method: 'GET' }, connection); }
  cancelVideoTask(id: string, connection?: ProviderConnection) { return this.videoRequest(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }, connection); }
}
