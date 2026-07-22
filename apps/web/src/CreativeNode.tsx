import { memo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { ActionIcon, Badge, Button, Group, Menu, Modal, NumberInput, Popover, Progress, Select, SegmentedControl, SimpleGrid, Stack, Switch, Text, Textarea, Tooltip } from '@mantine/core';
import { FileText, Image, Video, Volume2, File, MoreHorizontal, Trash2, Sparkles, Plus, Tag, Box, SlidersHorizontal, Send, Maximize2, LayoutGrid, UserRound, Clapperboard, Layers3, ScanFace, Package, Upload } from 'lucide-react';
import type { CanvasNodeData, NodeParameters, NodeReference } from './types';
import { useCanvasStore } from './store';
import { models } from './modelCatalog';
import { settingToModel, useProviderSettings } from './providerSettings';
import { createAsset, generateImage, generateText, generateVideo } from './api';

const icons = { text: FileText, image: Image, video: Video, audio: Volume2, file: File };
const tones: Record<string, string> = { draft: 'gray', ready: 'cyan', awaiting_confirmation: 'yellow', queued: 'blue', running: 'blue', succeeded: 'teal', failed: 'red', stale: 'orange' };
const stateLabels: Record<string, string> = { draft: '草稿', ready: '就绪', awaiting_confirmation: '等待确认', queued: '排队中', running: '生成中', succeeded: '已完成', failed: '失败', stale: '输入已修改' };
const referenceCompatibility: Record<CanvasNodeData['kind'], CanvasNodeData['kind'][]> = { text: ['text'], image: ['text', 'image'], video: ['text', 'image', 'video'], audio: ['text', 'audio'], file: ['text', 'image', 'video', 'audio', 'file'] };
const skills = [['分镜脚本', Clapperboard], ['九宫格分镜', LayoutGrid], ['角色表情', UserRound], ['电影灯光', Sparkles], ['多视图', LayoutGrid], ['面部特写', ScanFace], ['角色设定', UserRound], ['场景设定', Layers3], ['产品展示', Package]] as const;

function CreativeNodeView({ id, data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const Icon = icons[data.kind];
  const remove = useCanvasStore((state) => state.remove);
  const patch = useCanvasStore((state) => state.patch);
  const canvasNodes = useCanvasStore((state) => state.nodes);
  const providerSettings = useProviderSettings();
  const compatible = [...providerSettings.map(settingToModel), ...models].filter((model) => model.kind === data.kind);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const parameters = data.parameters || {};
  const setParameters = (next: Partial<NodeParameters>) => patch(id, { parameters: { ...parameters, ...next }, state: data.state === 'succeeded' ? 'stale' : data.state });
  const attachFiles = (files: FileList | null) => { if (!files?.length) return; const attachments = [...(data.attachments || []), ...Array.from(files).map((file) => ({ name: file.name, type: file.type, url: URL.createObjectURL(file) }))]; patch(id, { attachments, state: data.state === 'succeeded' ? 'stale' : data.state }); };
  const referenceNodes = (data.references || []).map((reference) => canvasNodes.find((node) => node.id === reference.nodeId)).filter(Boolean) as typeof canvasNodes;
  const referenceCandidates = canvasNodes.filter((node) => node.id !== id && referenceCompatibility[data.kind].includes(node.data.kind) && (node.data.outputText || node.data.preview));
  const toggleReference = (node: typeof canvasNodes[number]) => { const current = data.references || []; const exists = current.some((reference) => reference.nodeId === node.id); const references: NodeReference[] = exists ? current.filter((reference) => reference.nodeId !== node.id) : [...current, { nodeId: node.id, kind: node.data.kind, title: node.data.title }]; patch(id, { references, state: data.state === 'succeeded' ? 'stale' : data.state }); };

  const run = async () => {
    if (!data.model || data.kind === 'audio' || data.kind === 'file') return;
    patch(id, { state: 'running', progress: 5, error: undefined });
    let progress = 5;
    const timer = window.setInterval(() => { progress = Math.min(88, progress + Math.max(1, Math.round((90 - progress) / 8))); patch(id, { progress }); }, 700);
    try {
      const textReferences = referenceNodes.map((node) => node.data.outputText || (node.data.kind === 'text' ? node.data.prompt : '')).filter(Boolean);
      const effectivePrompt = [data.prompt, ...textReferences.map((text, index) => `参考内容 ${index + 1}：${text}`)].filter(Boolean).join('\n\n');
      const imageReferences = referenceNodes.filter((node) => node.data.kind === 'image' && node.data.preview).map((node) => node.data.preview as string);
      const mediaReferences = referenceNodes.filter((node) => (node.data.kind === 'image' || node.data.kind === 'video') && node.data.preview).map((node) => ({ url: node.data.preview as string, type: node.data.kind === 'video' ? 'video/mp4' : 'image/jpeg' }));
      const result = data.kind === 'text'
        ? await generateText({ model: data.model, prompt: effectivePrompt, temperature: Number(parameters.temperature ?? 0.7) })
        : data.kind === 'video'
          ? await generateVideo({ model: data.model, prompt: effectivePrompt, attachments: [...mediaReferences, ...(data.attachments || [])], ratio: String(parameters.ratio || '16:9'), resolution: String(parameters.resolution || '720P'), duration: Number(parameters.duration || 5), generateAudio: Boolean(parameters.generateAudio), watermark: Boolean(parameters.watermark), returnLastFrame: Boolean(parameters.returnLastFrame), onStatus: (status, nextProgress) => patch(id, { state: status === 'queued' ? 'queued' : 'running', progress: nextProgress }) })
          : await generateImage({ model: data.model, prompt: effectivePrompt, image: imageReferences, ratio: String(parameters.ratio || '1:1'), resolution: String(parameters.resolution || '1K'), n: Number(parameters.outputs || 1) });
      const outputText = result?.choices?.[0]?.message?.content;
      const preview = result?.content?.video_url || result?.data?.[0]?.url || (result?.data?.[0]?.b64_json ? `data:image/png;base64,${result.data[0].b64_json}` : undefined);
      if (preview) void createAsset({ kind: data.kind, name: data.title, objectKey: preview, source: data.provider, metadata: { model: data.model, prompt: data.prompt, parameters } }).catch(() => undefined);
      patch(id, { state: 'succeeded', progress: 100, error: undefined, ...(outputText ? { outputText } : {}), ...(preview ? { preview } : {}) });
    } catch (error) {
      patch(id, { state: 'failed', progress: 0, error: error instanceof Error ? error.message : '未知错误' });
    } finally { window.clearInterval(timer); }
  };

  return <div className={`creative-node creative-node-${data.kind} ${selected ? 'selected' : ''}`}>
    <Handle type="target" position={Position.Left}/>
    <div className="node-title-row"><Group gap={7}><Icon size={14}/><strong>{data.title}</strong></Group><Menu shadow="md" width={150}><Menu.Target><ActionIcon className="nodrag" variant="subtle" color="gray" size="sm"><MoreHorizontal size={15}/></ActionIcon></Menu.Target><Menu.Dropdown><Menu.Item leftSection={<Trash2 size={14}/>} color="red" onClick={() => remove(id)}>删除节点</Menu.Item></Menu.Dropdown></Menu></div>

    <section className="result-stage">
      {data.kind === 'text' && data.outputText ? <div className="text-result"><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{data.outputText}</Text></div>
        : data.preview ? data.kind === 'video' ? <video className="node-preview" src={data.preview} controls/> : <img className="node-preview" src={data.preview} alt="生成结果"/>
        : <div className="empty-result"><Icon size={48}/><Text size="sm" c="dimmed">{data.kind === 'text' ? '输入内容并生成回复' : data.kind === 'audio' ? '音频模型暂未接入' : '生成结果将在这里显示'}</Text></div>}
      <Badge className="result-state" color={tones[data.state]} variant="dot">{stateLabels[data.state] || data.state}</Badge>
      {data.state === 'running' && <div className="node-progress"><Progress value={data.progress || 0} animated size="sm"/><Text size="xs" c="dimmed">正在生成 {data.progress || 0}%</Text></div>}
    </section>
    {data.error && <Text className="node-error" size="xs" c="red">{data.error}</Text>}

    {selected && <section className="prompt-composer nodrag">
      <input ref={fileInput} type="file" hidden multiple accept={data.kind === 'image' ? 'image/*' : data.kind === 'video' ? 'video/*,image/*,audio/*' : '*/*'} onChange={(event) => { attachFiles(event.currentTarget.files); event.currentTarget.value = ''; }}/>
      <Group gap={6} className="prompt-chips"><Popover opened={referencesOpen} onChange={setReferencesOpen} position="bottom-start" width={300} shadow="xl"><Popover.Target><Button size="compact-xs" variant="default" leftSection={<Plus size={13}/>} onClick={() => setReferencesOpen((open) => !open)}>参考</Button></Popover.Target><Popover.Dropdown className="reference-popover"><Text size="xs" c="dimmed" mb={6}>选择上游节点结果</Text><Stack gap={3}>{referenceCandidates.length ? referenceCandidates.map((node) => { const RefIcon = icons[node.data.kind]; const active = data.references?.some((reference) => reference.nodeId === node.id); return <Button key={node.id} variant={active ? 'light' : 'subtle'} color={active ? 'cyan' : 'gray'} justify="flex-start" leftSection={<RefIcon size={15}/>} onClick={() => toggleReference(node)}>{node.data.title}</Button>; }) : <Text size="sm" c="dimmed">暂无可引用的节点结果</Text>}</Stack></Popover.Dropdown></Popover><Button size="compact-xs" variant="default" leftSection={<Tag size={13}/>}>标签</Button><Button size="compact-xs" variant="default" leftSection={<Box size={13}/>}>风格</Button><Tooltip label="展开编辑器"><ActionIcon ml="auto" size="sm" variant="subtle" color="gray" onClick={() => setEditorOpen(true)}><Maximize2 size={14}/></ActionIcon></Tooltip></Group>
      {!!data.references?.length && <Group gap={5} mt={7}>{referenceNodes.map((node) => <Badge key={node.id} variant="light" color="cyan" size="sm">参考：{node.data.title}</Badge>)}</Group>}
      {!!data.attachments?.length && <Group gap={5} mt={7}>{data.attachments.map((file) => <Badge key={file.url} variant="default" size="sm">{file.name}</Badge>)}</Group>}
      <div className="prompt-editor-wrap"><Textarea className="prompt-input" variant="unstyled" autosize minRows={3} maxRows={7} value={data.prompt} placeholder={data.kind === 'text' ? '输入消息，使用参考按钮引用节点结果' : '描述你想生成的内容，可引用上游节点结果'} onChange={(event) => patch(id, { prompt: event.currentTarget.value, state: data.state === 'succeeded' ? 'stale' : data.state, error: undefined })}/></div>
      <Group justify="space-between" wrap="nowrap" className="composer-footer"><Group gap={6} wrap="nowrap">
        <Select className="model-select" variant="unstyled" size="xs" data={compatible} value={data.model || null} placeholder="选择模型" allowDeselect={false} onChange={(value) => { const model = compatible.find((item) => item.value === value); patch(id, { model: value || '', provider: model?.provider || '', state: 'ready' }); }}/>
        <Popover opened={settingsOpen} onChange={setSettingsOpen} position="bottom-start" width={380} shadow="xl"><Popover.Target><Button size="compact-sm" variant="default" leftSection={<SlidersHorizontal size={14}/>} onClick={() => setSettingsOpen((open) => !open)}>{parameterSummary(data.kind, parameters)}</Button></Popover.Target><Popover.Dropdown className="settings-popover"><ParameterEditor kind={data.kind} parameters={parameters} update={setParameters}/></Popover.Dropdown></Popover>
        {data.kind === 'image' && <Popover opened={skillsOpen} onChange={setSkillsOpen} position="bottom-start" width={440} shadow="xl"><Popover.Target><Tooltip label="创作模块"><ActionIcon variant="default" onClick={() => setSkillsOpen((open) => !open)}><LayoutGrid size={16}/></ActionIcon></Tooltip></Popover.Target><Popover.Dropdown className="skill-popover"><SimpleGrid cols={2} spacing={5}>{skills.map(([label, SkillIcon]) => <Button key={label} variant="subtle" color="gray" justify="flex-start" leftSection={<SkillIcon size={16}/>} onClick={() => { patch(id, { prompt: `${data.prompt}${data.prompt ? '\n' : ''}/${label}` }); setSkillsOpen(false); }}>{label}</Button>)}</SimpleGrid></Popover.Dropdown></Popover>}
      </Group><Group gap={7}><Tooltip label="上传本地文件"><ActionIcon size="lg" variant="subtle" color="gray" onClick={() => fileInput.current?.click()}><Upload size={17}/></ActionIcon></Tooltip><ActionIcon size="lg" radius="xl" color="gray" variant="filled" disabled={!data.model || !data.prompt.trim() || data.kind === 'audio' || data.kind === 'file' || data.state === 'running'} onClick={run}><Send size={16}/></ActionIcon></Group></Group>
    </section>}
    <Modal opened={editorOpen} onClose={() => setEditorOpen(false)} title={`${data.title} · 展开编辑`} centered size="80vw" overlayProps={{ backgroundOpacity: 0.72, blur: 3 }} classNames={{ content: 'expanded-editor-modal', body: 'expanded-editor-body' }}><Stack h="100%"><Group gap={6}>{referenceNodes.map((node) => <Badge key={node.id} variant="light" color="cyan">参考：{node.data.title}</Badge>)}</Group><Textarea value={data.prompt} onChange={(event) => patch(id, { prompt: event.currentTarget.value, state: data.state === 'succeeded' ? 'stale' : data.state, error: undefined })} placeholder="在这里编辑完整提示词" autosize minRows={16} maxRows={24} styles={{ input: { lineHeight: 1.7 } }}/><Group justify="space-between"><Button variant="default" leftSection={<Upload size={15}/>} onClick={() => fileInput.current?.click()}>上传文件</Button><Button onClick={() => setEditorOpen(false)}>完成编辑</Button></Group></Stack></Modal>
    <Handle type="source" position={Position.Right}/>
  </div>;
}

function parameterSummary(kind: CanvasNodeData['kind'], p: NodeParameters) { if (kind === 'text') return `温度 ${p.temperature ?? 0.7} · ${p.maxTokens ?? 2048} 字符`; if (kind === 'video') return `${p.ratio || '16:9'} · ${p.resolution || '1080P'} · ${p.duration || 5}秒`; if (kind === 'image') return `${p.ratio || '1:1'} · ${p.resolution || '1K'} · ${p.outputs || 1}张`; return '参数'; }
function ParameterEditor({ kind, parameters: p, update }: { kind: CanvasNodeData['kind']; parameters: NodeParameters; update: (value: Partial<NodeParameters>) => void }) {
  if (kind === 'text') return <Stack gap="sm"><div><Text size="sm" c="dimmed" mb={7}>创造性</Text><SegmentedControl fullWidth value={String(p.temperature ?? 0.7)} onChange={(v) => update({ temperature: Number(v) })} data={[{label:'严谨',value:'0.2'},{label:'平衡',value:'0.7'},{label:'发散',value:'1.2'}]}/></div><NumberInput label="最大输出字符" value={Number(p.maxTokens ?? 2048)} min={256} max={8192} step={256} onChange={(v) => update({ maxTokens: Number(v) })}/></Stack>;
  if (kind === 'video') return <Stack gap="sm"><Choice label="画面比例" value={String(p.ratio || '16:9')} options={['adaptive','16:9','9:16','1:1','21:9']} onChange={(v) => update({ ratio: v })}/><Choice label="分辨率" value={String(p.resolution || '720P')} options={['480P','720P','1080P','4K']} onChange={(v) => update({ resolution: v })}/><Choice label="时长" value={String(p.duration || 5)} options={['4','5','10','15']} onChange={(v) => update({ duration: Number(v) })}/><Switch label="生成同步音频" checked={Boolean(p.generateAudio)} onChange={(event) => update({ generateAudio: event.currentTarget.checked })}/><Switch label="添加 AI 水印" checked={Boolean(p.watermark)} onChange={(event) => update({ watermark: event.currentTarget.checked })}/><Switch label="返回尾帧" checked={Boolean(p.returnLastFrame)} onChange={(event) => update({ returnLastFrame: event.currentTarget.checked })}/></Stack>;
  if (kind === 'image') return <Stack gap="sm"><Choice label="分辨率" value={String(p.resolution || '1K')} options={['1K','2K','4K']} onChange={(v) => update({ resolution: v })}/><div><Text size="sm" c="dimmed" mb={7}>画面比例</Text><SimpleGrid cols={5} spacing={6}>{['1:1','1:2','2:1','9:16','16:9','3:4','4:3','3:2','2:3','21:9'].map((v) => <Button key={v} size="compact-xs" variant={p.ratio === v ? 'filled' : 'default'} onClick={() => update({ ratio: v })}>{v}</Button>)}</SimpleGrid></div><Choice label="生成数量" value={String(p.outputs || 1)} options={['1','2','4']} onChange={(v) => update({ outputs: Number(v) })}/></Stack>;
  return <Text size="sm" c="dimmed">该节点没有可配置参数</Text>;
}
function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <div><Text size="sm" c="dimmed" mb={7}>{label}</Text><SegmentedControl fullWidth value={value} onChange={onChange} data={options}/></div>; }
export const CreativeNode = memo(CreativeNodeView);
