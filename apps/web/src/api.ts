import type { Edge, Node } from '@xyflow/react';
import type { CanvasNodeData } from './types';
const request = async <T>(path: string, init?: RequestInit): Promise<T> => { const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init }); if (!response.ok) throw new Error(`API ${response.status}`); return response.json(); };
export type SnapshotResponse = { version: number; nodes: Node<CanvasNodeData>[]; edges: Edge[]; savedAt: string };
export const api = { snapshot: (id: string) => request<SnapshotResponse>(`/projects/${id}/snapshot`), saveSnapshot: (id: string, body: { baseVersion: number; nodes: Node<CanvasNodeData>[]; edges: Edge[] }) => request<{ ok: boolean; conflict?: boolean; snapshot?: SnapshotResponse }>(`/projects/${id}/snapshot`, { method: 'POST', body: JSON.stringify(body) }) };
