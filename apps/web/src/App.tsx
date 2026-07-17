import { useCallback, useState } from 'react';
import {
  ReactFlow, Background, MiniMap, Controls, addEdge, applyEdgeChanges,
  applyNodeChanges, BackgroundVariant, ReactFlowProvider, useReactFlow,
  type Connection, type EdgeChange, type NodeChange,
} from '@xyflow/react';
import { ActionIcon, AppShell, Badge, Button, Divider, Drawer, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import {
  Plus, Search, FolderOpen, History, Settings, PanelLeftClose, Map,
  LayoutDashboard, Undo2, Redo2, Save, ChevronRight,
  FileText, Image, Video, Volume2, Upload, Command,
} from 'lucide-react';
import { CreativeNode } from './CreativeNode';
import { useCanvasStore } from './store';
import { models } from './modelCatalog';

const copy = {
  workspace: '\u672a\u547d\u540d\u5de5\u4f5c\u533a', saved: '\u5df2\u4fdd\u5b58', services: '4 \u4e2a\u6a21\u578b\u670d\u52a1',
  local: '\u672c\u5730\u5de5\u4f5c\u533a', settings: '\u8bbe\u7f6e', add: '\u6dfb\u52a0\u8282\u70b9', search: '\u8282\u70b9\u641c\u7d22',
  assets: '\u8d44\u4ea7\u5e93', history: '\u751f\u6210\u5386\u53f2', undo: '\u64a4\u9500', redo: '\u91cd\u505a',
  upload: '\u4e0a\u4f20\u672c\u5730\u7d20\u6750',
};
const nodeTypes = { creative: CreativeNode };

function Workspace() {
  const { nodes, edges, selected, setNodes, setEdges, select, addNode, patch } = useCanvasStore();
  const [panel, setPanel] = useState<'assets' | 'history' | 'search' | null>(null);
  const { fitView } = useReactFlow();
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes(applyNodeChanges(changes, nodes) as typeof nodes), [nodes, setNodes]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, edges)), [edges, setEdges]);
  const onConnect = useCallback((connection: Connection) => setEdges(addEdge({ ...connection, animated: true }, edges)), [edges, setEdges]);


  return <AppShell header={{ height: 52 }} navbar={{ width: 58, breakpoint: 'sm' }} padding={0}>
    <AppShell.Header className="topbar">
      <Group justify="space-between" h="100%" px={14}>
        <Group gap={10}><div className="brand">F</div><TextInput className="project-name" variant="unstyled" defaultValue={copy.workspace}/><Badge variant="light" color="teal" leftSection={<Save size={12}/>}>{copy.saved}</Badge></Group>
        <Group gap={6}><Badge variant="default">{copy.services}</Badge><Tooltip label={copy.settings}><ActionIcon variant="subtle" color="gray"><Settings size={17}/></ActionIcon></Tooltip><Button size="xs" variant="default">{copy.local}</Button></Group>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar className="rail" p={8}>
      <Stack justify="space-between" h="100%"><Stack gap={7}><Tool icon={Plus} label={copy.add} onClick={() => addNode('text')} active/><Tool icon={Search} label={copy.search} onClick={() => setPanel('search')}/><Tool icon={FolderOpen} label={copy.assets} onClick={() => setPanel('assets')}/><Tool icon={History} label={copy.history} onClick={() => setPanel('history')}/><Divider/><Tool icon={Command} label="Skill"/></Stack><Stack gap={7}><Tool icon={Undo2} label={copy.undo}/><Tool icon={Redo2} label={copy.redo}/></Stack></Stack>
    </AppShell.Navbar>
    <AppShell.Main className="canvas-shell">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => select(node.id)} onPaneClick={() => select(undefined)} fitView minZoom={0.15} maxZoom={2} colorMode="dark">
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#34373b"/><MiniMap pannable zoomable nodeColor="#464b51" maskColor="rgba(10,11,12,.72)"/><Controls position="bottom-left" showInteractive={false}/>
        <div className="bottom-tools"><Tooltip label="Text"><ActionIcon onClick={() => addNode('text')}><FileText size={17}/></ActionIcon></Tooltip><Tooltip label="Image"><ActionIcon variant="default" onClick={() => addNode('image')}><Image size={17}/></ActionIcon></Tooltip><Tooltip label="Video"><ActionIcon variant="default" onClick={() => addNode('video')}><Video size={17}/></ActionIcon></Tooltip><Tooltip label="Audio"><ActionIcon variant="default" onClick={() => addNode('audio')}><Volume2 size={17}/></ActionIcon></Tooltip><Divider orientation="vertical"/><Tooltip label="Auto layout"><ActionIcon variant="default" onClick={() => fitView({ duration: 500, padding: 0.2 })}><LayoutDashboard size={17}/></ActionIcon></Tooltip><Tooltip label="Mini map"><ActionIcon variant="default"><Map size={17}/></ActionIcon></Tooltip></div>
      </ReactFlow>
      <Drawer opened={!!panel} onClose={() => setPanel(null)} title={panel === 'assets' ? copy.assets : panel === 'history' ? copy.history : copy.search} position="left" offset={64} size={360}>
        {panel === 'search' && <Stack><TextInput leftSection={<Search size={15}/>} placeholder="Search title, prompt or content"/>{nodes.map((node) => <Button key={node.id} variant="subtle" color="gray" justify="space-between" rightSection={<ChevronRight size={14}/>} onClick={() => { select(node.id); setPanel(null); fitView({ nodes: [{ id: node.id }], duration: 450, maxZoom: 1 }); }}>{node.data.title}</Button>)}</Stack>}
        {panel === 'assets' && <Stack><Button variant="default" leftSection={<Upload size={15}/>}>{copy.upload}</Button>{nodes.filter((node) => node.data.preview).map((node) => <div className="asset-row" key={node.id}><img src={node.data.preview}/><div><Text size="sm" fw={600}>{node.data.title}</Text><Text size="xs" c="dimmed">{node.data.kind} / result</Text></div></div>)}</Stack>}
        {panel === 'history' && <Stack>{nodes.filter((node) => node.data.state === 'succeeded' || node.data.state === 'stale').map((node) => <div className="history-row" key={node.id}><Badge color={node.data.state === 'stale' ? 'orange' : 'teal'} variant="dot">{node.data.state}</Badge><div><Text size="sm">{node.data.title}</Text><Text size="xs" c="dimmed">{node.data.provider} / {node.data.model}</Text></div></div>)}</Stack>}
      </Drawer>
    </AppShell.Main>
  </AppShell>;
}

function Tool({ icon: Icon, label, onClick, active }: { icon: typeof Plus; label: string; onClick?: () => void; active?: boolean }) {
  return <Tooltip label={label} position="right"><ActionIcon size={40} variant={active ? 'light' : 'subtle'} color={active ? 'cyan' : 'gray'} onClick={onClick}><Icon size={18}/></ActionIcon></Tooltip>;
}

export function App() { return <ReactFlowProvider><Workspace/></ReactFlowProvider>; }
