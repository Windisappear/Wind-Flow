import type { Edge, Node } from '@xyflow/react';
import type { CanvasNodeData } from './types';
const request = async <T>(path: string, init?: RequestInit): Promise<T> => { const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init }); if (!response.ok) { const detail = await response.text().catch(() => ''); throw new Error(`API ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`); } return response.json(); };
export type SnapshotResponse = { version: number; nodes: Node<CanvasNodeData>[]; edges: Edge[]; savedAt: string };
export const api = { snapshot: (id: string) => request<SnapshotResponse>(`/projects/${id}/snapshot`), saveSnapshot: (id: string, body: { baseVersion: number; nodes: Node<CanvasNodeData>[]; edges: Edge[] }) => request<{ ok: boolean; conflict?: boolean; snapshot?: SnapshotResponse }>(`/projects/${id}/snapshot`, { method: 'POST', body: JSON.stringify(body) }) };
const configuredModel = (model: string) => ({ model });
const runGeneration = async (kind: 'text' | 'image', model: string, input: Record<string, unknown>) => { const configured = configuredModel(model); const result = await request<{ output: any }>('/generation-jobs/run', { method: 'POST', body: JSON.stringify({ kind, ...configured, input }) }); return result.output; };
export const generateText = (body: { model: string; prompt: string; systemPrompt?: string; temperature?: number }) => runGeneration('text', body.model, { temperature: body.temperature, messages: [...(body.systemPrompt ? [{ role: 'system', content: body.systemPrompt }] : []), { role: 'user', content: body.prompt }] });
export const generateImage = (body: { model: string; prompt: string; ratio?: string; resolution?: string; n?: number; image?: string[] }) => runGeneration('image', body.model, { prompt: body.prompt, ratio: body.ratio, resolution: body.resolution, n: body.n, image: body.image });
export const generateVideo = async (body: { model: string; prompt: string; attachments?: Array<{ url: string; type: string }>; ratio?: string; resolution?: string; duration?: number; generateAudio?: boolean; watermark?: boolean; returnLastFrame?: boolean; onCreated?: (jobId: string) => void; onStatus?: (status: string, progress: number) => void }) => {
  const created = await request<{ job: { id: string }; task: { id: string } }>('/generation-jobs/video', { method: 'POST', body: JSON.stringify({ model: body.model, input: body }) });
  body.onCreated?.(created.job.id);
  for (let attempt = 0; attempt < 720; attempt += 1) {
    const current = await request<{ ok?: boolean; job?: { state: string }; task?: any }>(`/generation-jobs/${created.job.id}/video-status`);
    if (!current.task) throw new Error('视频任务记录不存在');
    const task = current.task;
    const progress = task.status === 'queued' ? 15 : task.status === 'running' ? Math.min(94, 45 + attempt) : 100;
    body.onStatus?.(task.status, progress);
    if (task.status === 'succeeded') return { ...task, windFlowJobId: created.job.id };
    if (task.status === 'cancelled') throw new Error('VIDEO_TASK_CANCELLED');
    if (['failed', 'expired'].includes(task.status)) throw new Error(task.error?.message || `视频任务${task.status}`);
    await new Promise((resolve) => window.setTimeout(resolve, 5000));
  }
  throw new Error('视频任务查询超时');
};
export const cancelVideoTask = (jobId: string) => request(`/generation-jobs/${jobId}/cancel`, { method: 'POST' });
export const createAsset = (body: Record<string, unknown>) => request<any>('/assets', { method: 'POST', body: JSON.stringify(body) });
export const listAssets = () => request<any[]>('/assets');
export const listGenerationJobs = () => request<any[]>('/generation-jobs');
