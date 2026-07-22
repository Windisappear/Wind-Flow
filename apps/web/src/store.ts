import { create } from 'zustand';
import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { CanvasNodeData, NodeKind } from './types';
import { api } from './api';

const demoNodes: Node<CanvasNodeData>[] = [];
const demoEdges: Edge[] = [];
const titles: Record<NodeKind, string> = { text: '文本对话', image: '图像生成', video: '视频生成', audio: '音频（待接入）', file: '本地素材' };
const defaultParameters = (kind: NodeKind) => kind === 'text' ? { temperature: 0.7, maxTokens: 2048 } : kind === 'video' ? { ratio: '16:9', resolution: '720P', duration: 5, generateAudio: true, watermark: false, returnLastFrame: false } : kind === 'image' ? { ratio: '1:1', resolution: '1K', quality: '标准', outputs: 1 } : {};

interface CanvasStore {
  nodes: Node<CanvasNodeData>[]; edges: Edge[]; selected?: string; version: number;
  setNodes: (nodes: Node<CanvasNodeData>[]) => void; setEdges: (edges: Edge[]) => void; select: (id?: string) => void;
  hydrate: () => Promise<void>; persist: () => Promise<boolean>;
  addNode: (kind: NodeKind, position: XYPosition, sourceId?: string) => string;
  patch: (id: string, data: Partial<CanvasNodeData>) => void; remove: (id: string) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: demoNodes, edges: demoEdges, selected: undefined, version: 0,
  setNodes: (nodes) => set({ nodes }), setEdges: (edges) => set({ edges }), select: (selected) => set({ selected }),
  hydrate: async () => { try { const snapshot = await api.snapshot('default'); set({ nodes: snapshot.nodes, edges: snapshot.edges, version: snapshot.version }); } catch { /* local empty canvas fallback */ } },
  persist: async () => { try { const result = await api.saveSnapshot('default', { baseVersion: get().version, nodes: get().nodes, edges: get().edges }); if (result.ok && result.snapshot) { set({ version: result.snapshot.version }); return true; } return false; } catch { return false; } },
  addNode: (kind, position, sourceId) => {
    const id = crypto.randomUUID();
    const node: Node<CanvasNodeData> = { id, type: 'creative', position, data: { kind, title: titles[kind], prompt: '', provider: '', model: '', state: 'draft', progress: 0, parameters: defaultParameters(kind) } };
    const edge = sourceId ? { id: `e-${sourceId}-${id}`, source: sourceId, target: id, animated: true } : undefined;
    set({ nodes: [...get().nodes, node], edges: edge ? [...get().edges, edge] : get().edges, selected: id });
    return id;
  },
  patch: (id, data) => set({ nodes: get().nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...data } } : node) }),
  remove: (id) => set({ nodes: get().nodes.filter((node) => node.id !== id), edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id), selected: undefined }),
}));
