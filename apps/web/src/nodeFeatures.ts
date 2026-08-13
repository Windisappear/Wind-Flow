import { useEffect, useState } from 'react';
import type { NodeKind } from './types';

export type FeatureGroup = 'module' | 'style' | 'constraint';
export type NodeFeature = { id: string; kind: NodeKind; group: FeatureGroup; name: string; summary: string; systemPrompt: string; source: 'builtin' | 'skill' | 'custom' };

const storageKey = 'wind-flow.node-features';
const changedEvent = 'wind-flow.node-features.changed';
const feature = (id: string, kind: NodeKind, group: FeatureGroup, name: string, systemPrompt: string): NodeFeature => ({ id, kind, group, name, summary: systemPrompt.slice(0, 72), systemPrompt, source: 'builtin' });
export const defaultNodeFeatures: NodeFeature[] = [
  feature('text-script-split','text','module','拆分剧本','你是专业剧本分析师。将用户内容拆分为场次、人物、动作、对白和关键情节点，保持原意并输出清晰结构。'),
  feature('text-shot-script','text','module','分镜脚本','你是影视分镜师。把内容改写为可拍摄的分镜脚本，逐镜列出景别、画面、动作、对白、镜头运动和时长。'),
  feature('text-storyboard','text','module','故事板分镜','你是故事板导演。将故事整理为连续视觉叙事单元，每格明确主体、场景、构图、动作、情绪与镜头衔接。'),
  feature('text-grid-9','text','module','九宫格分镜','将内容拆分为九个连续分镜，确保人物和场景一致，每格给出画面描述、景别、动作和叙事目的。'),
  feature('text-grid-12','text','module','十二宫格分镜','将内容拆分为十二个连续分镜，覆盖开场、发展、转折和结尾，并保持视觉连续性。'),
  feature('text-grid-16','text','module','十六宫格分镜','将内容拆分为十六个细化分镜，给出构图、景别、动作、光线和镜头运动。'),
  feature('image-style-real','image','style','真人风格','使用真实摄影审美，保持自然皮肤纹理、可信光线、物理正确材质与电影级镜头表现。'),
  feature('image-style-2d','image','style','2D风格','使用精致二维绘画与动画美术风格，轮廓清晰、色块统一、构图具有设计感。'),
  feature('image-style-3d','image','style','3D风格','使用高质量三维渲染风格，材质、灯光、体积和空间关系明确，细节统一。'),
  feature('image-turnaround','image','module','人物三视图','生成同一角色的正面、侧面和背面三视图，服装、比例、发型和身份特征严格一致。'),
  feature('image-scene-4','image','module','场景四视图','生成同一场景的四个方位视图，空间结构、材质、时间和光线保持一致。'),
  feature('image-grid-9','image','module','九宫格分镜','生成九宫格连续分镜，人物、场景和风格一致，镜头具有明确叙事顺序。'),
  feature('image-storyboard','image','module','故事板分镜','生成专业故事板分镜，突出构图、动作、景别和镜头衔接，保持视觉连续性。'),
  feature('image-cinematic-light','image','module','电影灯光','采用电影级布光，明确主光、辅光、轮廓光和环境光，服务于情绪与叙事。'),
  feature('video-constraint-consistency','video','constraint','角色一致','视频全程保持角色面部、服装、体型和身份特征一致，避免变形、闪烁和身份漂移。'),
  feature('video-constraint-camera','video','constraint','镜头稳定','镜头运动平滑且符合物理规律，避免无意义抖动、跳切、穿模和画面撕裂。'),
  feature('video-style-real','video','style','真人电影','使用真实电影摄影风格，自然动作、可信光影、真实材质和连贯运动。'),
  feature('video-style-animation','video','style','动画风格','使用统一动画美术风格，保持角色造型、色彩、线条和运动节奏一致。'),
];

export function readNodeFeatures(): NodeFeature[] { try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); return Array.isArray(saved) ? saved : defaultNodeFeatures; } catch { return defaultNodeFeatures; } }
export function writeNodeFeatures(items: NodeFeature[]) { localStorage.setItem(storageKey, JSON.stringify(items)); window.dispatchEvent(new Event(changedEvent)); }
export function useNodeFeatures() { const [items, setItems] = useState<NodeFeature[]>(readNodeFeatures); useEffect(() => { const update = () => setItems(readNodeFeatures()); window.addEventListener(changedEvent, update); return () => window.removeEventListener(changedEvent, update); }, []); return items; }
export function featurePrompt(ids: string[] | undefined, items = readNodeFeatures()) { return (ids || []).map((id) => items.find((item) => item.id === id)?.systemPrompt).filter(Boolean).join('\n\n'); }
export async function featureFromSkill(file: File, kind: NodeKind, group: FeatureGroup): Promise<NodeFeature> { const content = await file.text(); const name = file.name.replace(/\.(md|txt|yaml|yml)$/i, ''); return { id: crypto.randomUUID(), kind, group, name, summary: content.replace(/[#*_`>-]/g, '').trim().slice(0, 120), systemPrompt: content, source: 'skill' }; }
