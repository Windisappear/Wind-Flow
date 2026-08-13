import { useEffect, useState } from 'react';
import type { ModelItem, NodeKind } from './types';

export type ProviderSetting = {
  id: string; kind: Exclude<NodeKind, 'audio' | 'file'>; provider: string; displayName: string;
  modelId: string; baseUrl: string; apiKey?: string; hasCredential?: boolean;
  apiMode?: 'openai-chat' | 'openai-images' | 'ark-video'; endpointPath?: string;
};

const changedEvent = 'wind-flow.provider-settings.changed';
const request = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error((await response.text()).slice(0, 240) || `API ${response.status}`);
  return response.json() as Promise<T>;
};

export const readProviderSettings = async () => request<ProviderSetting[]>('/provider-configurations');
export const writeProviderSetting = async (setting: ProviderSetting) => {
  const saved = await request<ProviderSetting>('/provider-configurations', { method: 'POST', body: JSON.stringify(setting) });
  window.dispatchEvent(new Event(changedEvent)); return saved;
};
export const removeProviderSetting = async (id: string) => { await request(`/provider-configurations/${id}`, { method: 'DELETE' }); window.dispatchEvent(new Event(changedEvent)); };
export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSetting[]>([]);
  useEffect(() => { let active = true; const update = () => { void readProviderSettings().then((items) => { if (active) setSettings(items); }).catch(() => { if (active) setSettings([]); }); }; update(); window.addEventListener(changedEvent, update); return () => { active = false; window.removeEventListener(changedEvent, update); }; }, []);
  return settings;
}
export const settingToModel = (setting: ProviderSetting): ModelItem => ({ kind: setting.kind, provider: setting.provider, value: setting.id, label: setting.displayName });
