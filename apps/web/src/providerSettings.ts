import { useEffect, useState } from 'react';
import type { ModelItem, NodeKind } from './types';

export type ProviderSetting = {
  id: string;
  kind: NodeKind;
  provider: string;
  displayName: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
};

const storageKey = 'wind-flow.provider-settings';
const changedEvent = 'wind-flow.provider-settings.changed';

export function readProviderSettings(): ProviderSetting[] {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
}

export function writeProviderSettings(settings: ProviderSetting[]) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
  window.dispatchEvent(new Event(changedEvent));
}

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSetting[]>(readProviderSettings);
  useEffect(() => { const update = () => setSettings(readProviderSettings()); window.addEventListener(changedEvent, update); return () => window.removeEventListener(changedEvent, update); }, []);
  return settings;
}

export const settingToModel = (setting: ProviderSetting): ModelItem => ({ kind: setting.kind, provider: setting.provider, value: setting.id, label: setting.displayName });
export const findProviderSetting = (id: string) => readProviderSettings().find((setting) => setting.id === id);
