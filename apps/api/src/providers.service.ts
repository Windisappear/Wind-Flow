import { Injectable } from '@nestjs/common';
import { CredentialsService } from './credentials.service';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type VideoInput = { model?: string; prompt: string; attachments?: Array<{ url: string; type: string }>; ratio?: string; resolution?: string; duration?: number; generateAudio?: boolean; watermark?: boolean; returnLastFrame?: boolean; serviceTier?: 'default' | 'flex'; priority?: number };

@Injectable()
export class ProvidersService {
  constructor(private readonly credentials: CredentialsService) {}
  private readonly deepseekKey = process.env.DEEPSEEK_API_KEY;
  private readonly deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

  deepseekStatus() { return { provider: 'DeepSeek', configured: Boolean(this.deepseekKey), baseUrl: this.deepseekBaseUrl, models: ['deepseek-chat', 'deepseek-reasoner'] }; }
  jimengStatus() { return { provider: 'Seedream', configured: Boolean(process.env.JIMENG_API_KEY), baseUrl: process.env.JIMENG_BASE_URL || '', models: ['seedream-4.0', 'seedream-4.5', 'seedream-5.0'], protocol: 'openai-images' }; }
  volcengineVideoStatus() { return { provider: 'Volcengine Ark', configured: Boolean(process.env.ARK_API_KEY), baseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-seedance-2-0-260128'], protocol: 'ark-content-generation' }; }

  private async configured(model: string, kind: 'text' | 'image' | 'video') {
    const config = await this.credentials.resolve(model);
    if (config && config.kind !== kind) throw new Error('Provider configuration does not match node type');
    return config;
  }
  private endpoint(baseUrl: string, configuredPath: string | undefined, fallback: string) {
    const path = configuredPath || fallback;
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('Provider endpoint path is invalid');
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  async chat(messages: ChatMessage[], model = 'deepseek-chat', temperature = 0.7) {
    const config = await this.configured(model, 'text');
    if (config && config.apiMode !== 'openai-chat') throw new Error('Text nodes require an OpenAI Chat compatible provider');
    const apiKey = config?.apiKey || this.deepseekKey;
    const baseUrl = config?.baseUrl || this.deepseekBaseUrl;
    if (!apiKey) throw new Error('Provider API key is not configured');
    const response = await fetch(this.endpoint(baseUrl, config?.endpointPath, '/chat/completions'), { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config?.modelId || model, messages, temperature, stream: false }) });
    if (!response.ok) throw new Error(`Text API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }

  async generateJimeng(body: { model?: string; prompt: string; n?: number; size?: string; image?: string[]; ratio?: string; resolution?: string }) {
    const config = await this.configured(body.model || '', 'image');
    if (config && config.apiMode !== 'openai-images') throw new Error('Image nodes require an OpenAI Images compatible provider');
    const key = config?.apiKey || process.env.JIMENG_API_KEY;
    const baseUrl = config?.baseUrl || process.env.JIMENG_BASE_URL || '';
    if (!key || !baseUrl) throw new Error('Image provider API Key and Base URL are required');
    const requestedModel = config?.modelId || body.model || process.env.JIMENG_MODEL || 'seedream-4.5';
    const aliases: Record<string, string> = { 'seedream-4.0': 'doubao-seedream-4-0-250828', 'seedream-4.5': 'doubao-seedream-4-5-251128', 'seedream-5.0': 'doubao-seedream-5-0-260128' };
    const size = body.resolution?.toLowerCase() || body.size?.replace('*', 'x') || '1k';
    const response = await fetch(this.endpoint(baseUrl, config?.endpointPath, '/v1/images/generations'), { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: aliases[requestedModel] || requestedModel, prompt: body.prompt, n: body.n || 1, size, image: body.image, ratio: body.ratio }) });
    if (!response.ok) throw new Error(`Image API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }

  private async videoConnection(model: string) {
    const config = await this.configured(model, 'video');
    if (config && config.apiMode !== 'ark-video') throw new Error('Video nodes require an Ark video task provider');
    const apiKey = config?.apiKey || process.env.ARK_API_KEY;
    if (!apiKey) throw new Error('ARK_API_KEY is not configured');
    return { apiKey, baseUrl: (config?.baseUrl || process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, ''), model: config?.modelId || model };
  }
  private async videoRequest(path: string, init: RequestInit, model: string) {
    const { apiKey, baseUrl } = await this.videoConnection(model);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`Volcengine Ark video API ${response.status}: ${(await response.text()).slice(0, 800)}`);
    return response.json();
  }
  async createVideoTask(input: VideoInput) {
    const content: Array<Record<string, unknown>> = input.prompt.trim() ? [{ type: 'text', text: input.prompt }] : [];
    for (const attachment of input.attachments || []) { if (!/^https?:\/\//.test(attachment.url)) continue; if (attachment.type.startsWith('image/')) content.push({ type: 'image_url', image_url: { url: attachment.url }, role: 'reference_image' }); if (attachment.type.startsWith('video/')) content.push({ type: 'video_url', video_url: { url: attachment.url }, role: 'reference_video' }); }
    if (!content.length) throw new Error('Video prompt or remote reference media is required');
    const requestedModel = input.model || 'doubao-seedance-2-0-260128'; const connection = await this.videoConnection(requestedModel);
    return this.videoRequest('/contents/generations/tasks', { method: 'POST', body: JSON.stringify({ model: connection.model, content, ratio: input.ratio, resolution: input.resolution?.toLowerCase(), duration: input.duration, generate_audio: input.generateAudio, watermark: input.watermark, return_last_frame: input.returnLastFrame, service_tier: input.serviceTier, priority: input.priority }) }, requestedModel);
  }
  getVideoTask(id: string, model: string) { return this.videoRequest(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'GET' }, model); }
  listVideoTasks(query: { pageNum?: number; pageSize?: number; status?: string; model?: string; serviceTier?: string }, model: string) { const params = new URLSearchParams(); params.set('page_num', String(query.pageNum || 1)); params.set('page_size', String(query.pageSize || 20)); if (query.status) params.set('filter.status', query.status); if (query.model) params.set('filter.model', query.model); if (query.serviceTier) params.set('filter.service_tier', query.serviceTier); return this.videoRequest(`/contents/generations/tasks?${params}`, { method: 'GET' }, model); }
  cancelVideoTask(id: string, model: string) { return this.videoRequest(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }, model); }
}
