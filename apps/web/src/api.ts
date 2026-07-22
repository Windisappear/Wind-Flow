import type { Edge, Node } from '@xyflow/react';
import type { CanvasNodeData } from './types';
import { findProviderSetting } from './providerSettings';
const request = async <T>(path: string, init?: RequestInit): Promise<T> => { const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init }); if (!response.ok) { const detail = await response.text().catch(() => ''); throw new Error(`API ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`); } return response.json(); };
export type SnapshotResponse = { version: number; nodes: Node<CanvasNodeData>[]; edges: Edge[]; savedAt: string };
export const api = { snapshot: (id: string) => request<SnapshotResponse>(`/projects/${id}/snapshot`), saveSnapshot: (id: string, body: { baseVersion: number; nodes: Node<CanvasNodeData>[]; edges: Edge[] }) => request<{ ok: boolean; conflict?: boolean; snapshot?: SnapshotResponse }>(`/projects/${id}/snapshot`, { method: 'POST', body: JSON.stringify(body) }) };
const configuredModel = (model: string) => { const setting = findProviderSetting(model); return setting ? { model: setting.modelId, connection: { baseUrl: setting.baseUrl, apiKey: setting.apiKey } } : { model }; };
const runGeneration = async (kind: 'text' | 'image', model: string, input: Record<string, unknown>) => { const configured = configuredModel(model); const result = await request<{ output: any }>('/generation-jobs/run', { method: 'POST', body: JSON.stringify({ kind, ...configured, input }) }); return result.output; };
export const generateText = (body: { model: string; prompt: string; temperature?: number }) => runGeneration('text', body.model, { temperature: body.temperature, messages: [{ role: 'user', content: body.prompt }] });
export const generateImage = (body: { model: string; prompt: string; ratio?: string; resolution?: string; n?: number; image?: string[] }) => runGeneration('image', body.model, { prompt: body.prompt, ratio: body.ratio, resolution: body.resolution, n: body.n, image: body.image });
const videoHeaders = (model: string): Record<string, string> => { const setting = findProviderSetting(model); return setting ? { 'X-Provider-Base-Url': setting.baseUrl, 'X-Provider-Api-Key': setting.apiKey } : {}; };
export const generateVideo = async (body: { model: string; prompt: string; attachments?: Array<{ url: string; type: string }>; ratio?: string; resolution?: string; duration?: number; generateAudio?: boolean; watermark?: boolean; returnLastFrame?: boolean; onStatus?: (status: string, progress: number) => void }) => {
  const configured = configuredModel(body.model);
  const task = await request<{ id: string }>('/providers/volcengine/videos/tasks', { method: 'POST', body: JSON.stringify({ ...body, ...configured }) });
  for (let attempt = 0; attempt < 720; attempt += 1) {
    const current = await request<any>(`/providers/volcengine/videos/tasks/${task.id}`, { headers: videoHeaders(body.model) });
    const progress = current.status === 'queued' ? 15 : current.status === 'running' ? Math.min(94, 45 + attempt) : 100;
    body.onStatus?.(current.status, progress);
    if (current.status === 'succeeded') return current;
    if (['failed', 'cancelled', 'expired'].includes(current.status)) throw new Error(current.error?.message || `视频任务${current.status}`);
    await new Promise((resolve) => window.setTimeout(resolve, 5000));
  }
  throw new Error('视频任务查询超时');
};
export const cancelVideoTask = (id: string, model: string) => request(`/providers/volcengine/videos/tasks/${id}/cancel`, { method: 'POST', headers: videoHeaders(model) });
export const createAsset = (body: Record<string, unknown>) => request<any>('/assets', { method: 'POST', body: JSON.stringify(body) });
export const listAssets = () => request<any[]>('/assets');
export const listGenerationJobs = () => request<any[]>('/generation-jobs');
