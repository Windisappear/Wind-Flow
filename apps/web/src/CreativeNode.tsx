import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  ActionIcon, Badge, Button, Divider, Group, Menu, Popover, Select,
  SegmentedControl, SimpleGrid, Stack, Text, Textarea, Tooltip,
} from '@mantine/core';
import {
  FileText, Image, Video, Volume2, File, MoreHorizontal, Trash2,
  Sparkles, Plus, Tag, Box, SlidersHorizontal, Send, Maximize2,
  LayoutGrid, UserRound, Clapperboard, Layers3, ScanFace, Package,
} from 'lucide-react';
import type { CanvasNodeData } from './types';
import { useCanvasStore } from './store';
import { models } from './modelCatalog';
import { settingToModel, useProviderSettings } from './providerSettings';
import { createAsset, generateImage, generateText } from './api';

const icons = { text: FileText, image: Image, video: Video, audio: Volume2, file: File };
const tones: Record<string, string> = { draft: 'gray', ready: 'cyan', awaiting_confirmation: 'yellow', queued: 'blue', running: 'blue', succeeded: 'teal', failed: 'red', stale: 'orange' };
const skills = [
  ['Storyboard', Clapperboard], ['25-grid storyboard', LayoutGrid], ['Four-panel storyboard', LayoutGrid],
  ['Character mood', UserRound], ['Cinematic lighting', Sparkles], ['720 panorama', Maximize2],
  ['Multi-view grid', LayoutGrid], ['Face close-up', ScanFace], ['Character sheet', UserRound],
  ['Character turnaround', UserRound], ['Scene sheet', Layers3], ['Product sheet', Package],
] as const;

function CreativeNodeView({ id, data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const Icon = icons[data.kind];
  const remove = useCanvasStore((state) => state.remove);
  const patch = useCanvasStore((state) => state.patch);
  const providerSettings = useProviderSettings();
  const compatible = [...providerSettings.map(settingToModel), ...models].filter((model) => model.kind === data.kind);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [quality, setQuality] = useState('High');
  const [resolution, setResolution] = useState(data.kind === 'video' ? '1080P' : '4K');
  const [ratio, setRatio] = useState('16:9');
  const [count, setCount] = useState('1');

  const run = async () => {
    if (!data.model || data.kind === 'audio') return;
    patch(id, { state: 'running', progress: 12 });
    try {
      const result = data.kind === 'text' ? await generateText({ model: data.model, prompt: data.prompt }) : await generateImage({ model: data.model, prompt: data.prompt, ratio, resolution, n: Number(count) });
      const text = result?.choices?.[0]?.message?.content;
      const preview = result?.data?.[0]?.url;
      if (preview) void createAsset({ kind: data.kind, name: data.title, objectKey: preview, source: 'jimeng', metadata: { model: data.model, prompt: data.prompt } }).catch(() => undefined);
      patch(id, { state: 'succeeded', progress: 100, ...(text ? { prompt: text } : {}), ...(preview ? { preview } : {}) });
    } catch (error) {
      patch(id, { state: 'failed', progress: 0, prompt: `${data.prompt}\n\n[Generation failed] ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  return <div className={`creative-node creative-node-${data.kind} ${selected ? 'selected' : ''}`}>
    <Handle type="target" position={Position.Left}/>
    <div className="node-title-row">
      <Group gap={7}><Icon size={14}/><strong>{data.title}</strong></Group>
      <Menu shadow="md" width={150}><Menu.Target><ActionIcon className="nodrag" variant="subtle" color="gray" size="sm"><MoreHorizontal size={15}/></ActionIcon></Menu.Target><Menu.Dropdown><Menu.Item leftSection={<Trash2 size={14}/>} color="red" onClick={() => remove(id)}>Delete node</Menu.Item></Menu.Dropdown></Menu>
    </div>

    <section className="result-stage">
      {data.preview ? <img className="node-preview" src={data.preview} alt="Generated result"/> : <div className="empty-result"><Icon size={48}/><Text size="sm" c="dimmed">Try:</Text><Button className="nodrag" variant="subtle" color="gray" leftSection={<Image size={15}/>}>Create from text</Button><Button className="nodrag" variant="subtle" color="gray" leftSection={<Sparkles size={15}/>}>Enhance result</Button></div>}
      <Badge className="result-state" color={tones[data.state]} variant="dot">{data.state === 'stale' ? 'Input changed' : data.state}</Badge>
    </section>

    {selected && <section className="prompt-composer nodrag">
      <Group gap={6} className="prompt-chips">
        <Button size="compact-xs" variant="default" leftSection={<Plus size={13}/>}>Reference</Button>
        <Button size="compact-xs" variant="default" leftSection={<Tag size={13}/>}>Tag</Button>
        <Button size="compact-xs" variant="default" leftSection={<Box size={13}/>}>Style</Button>
        <Tooltip label="Expand editor"><ActionIcon ml="auto" size="sm" variant="subtle" color="gray"><Maximize2 size={14}/></ActionIcon></Tooltip>
      </Group>
      <Textarea className="prompt-input" variant="unstyled" autosize minRows={3} maxRows={7} value={data.prompt} placeholder="Describe the result, type @ to reference a node or asset" onChange={(event) => patch(id, { prompt: event.currentTarget.value, state: data.state === 'succeeded' ? 'stale' : data.state })}/>
      <Group justify="space-between" wrap="nowrap" className="composer-footer">
        <Group gap={6} wrap="nowrap">
          <Select className="model-select" variant="unstyled" size="xs" data={compatible} value={data.model || null} placeholder="Select model" allowDeselect={false} onChange={(value) => { const model = compatible.find((item) => item.value === value); patch(id, { model: value || '', provider: model?.provider || '', state: 'ready' }); }}/>
          <Popover opened={settingsOpen} onChange={setSettingsOpen} position="bottom-start" width={350} shadow="xl">
            <Popover.Target><Button size="compact-sm" variant="default" leftSection={<SlidersHorizontal size={14}/>} onClick={() => setSettingsOpen((open) => !open)}>{ratio} · {quality} · {resolution} · {count}</Button></Popover.Target>
            <Popover.Dropdown className="settings-popover"><Stack gap="sm"><Setting label="Quality" value={quality} onChange={setQuality} options={['Draft', 'Standard', 'High']}/><Setting label="Resolution" value={resolution} onChange={setResolution} options={data.kind === 'video' ? ['720P', '1080P'] : ['1K', '2K', '4K']}/><div><Text size="sm" c="dimmed" mb={7}>Aspect ratio</Text><SimpleGrid cols={5} spacing={6}>{['1:1','1:2','2:1','9:16','16:9','3:4','4:3','3:2','2:3','21:9'].map((item) => <Button key={item} size="compact-xs" variant={ratio === item ? 'filled' : 'default'} onClick={() => setRatio(item)}>{item}</Button>)}</SimpleGrid></div><Setting label="Outputs" value={count} onChange={setCount} options={['1', '2', '4']}/></Stack></Popover.Dropdown>
          </Popover>
          <Popover opened={skillsOpen} onChange={setSkillsOpen} position="bottom-start" width={500} shadow="xl">
            <Popover.Target><Tooltip label="Creation modules"><ActionIcon variant="default" onClick={() => setSkillsOpen((open) => !open)}><LayoutGrid size={16}/></ActionIcon></Tooltip></Popover.Target>
            <Popover.Dropdown className="skill-popover"><SimpleGrid cols={2} spacing={5}>{skills.map(([label, SkillIcon]) => <Button key={label} variant="subtle" color="gray" justify="flex-start" leftSection={<SkillIcon size={16}/>} onClick={() => { patch(id, { prompt: `${data.prompt}${data.prompt ? '\n' : ''}/${label}` }); setSkillsOpen(false); }}>{label}</Button>)}</SimpleGrid></Popover.Dropdown>
          </Popover>
        </Group>
        <Group gap={8} wrap="nowrap"><Text size="xs" c="dimmed">{data.kind === 'video' ? '135' : '120'}</Text><ActionIcon size="lg" radius="xl" color="gray" variant="filled" disabled={!data.model || data.kind === 'audio' || data.state === 'running'} onClick={run}><Send size={16}/></ActionIcon></Group>
      </Group>
    </section>}
    <Handle type="source" position={Position.Right}/>
  </div>;
}

function Setting({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <div><Text size="sm" c="dimmed" mb={7}>{label}</Text><SegmentedControl fullWidth value={value} onChange={onChange} data={options}/></div>;
}

export const CreativeNode = memo(CreativeNodeView);
