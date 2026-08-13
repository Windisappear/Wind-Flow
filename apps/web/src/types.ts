export type NodeKind = 'text' | 'image' | 'video' | 'audio' | 'file';
export type RunState = 'draft' | 'ready' | 'awaiting_confirmation' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'stale';
export interface NodeParameters extends Record<string, unknown> { ratio?: string; resolution?: string; quality?: string; outputs?: number; duration?: number; fps?: number; temperature?: number; maxTokens?: number; generateAudio?: boolean; watermark?: boolean; returnLastFrame?: boolean; }
export interface NodeReference { nodeId: string; kind: NodeKind; title: string; outputText?: string; preview?: string; }
export interface CanvasNodeData extends Record<string, unknown> { kind: NodeKind; title: string; prompt: string; outputText?: string; error?: string; model: string; provider: string; state: RunState; progress?: number; preview?: string; jobId?: string; parameters?: NodeParameters; attachments?: Array<{ name: string; type: string; url: string }>; references?: NodeReference[]; featureIds?: string[]; }
export interface ModelItem { value: string; label: string; provider: string; kind: NodeKind; disabled?: boolean; }
