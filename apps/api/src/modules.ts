import { Body, Controller, Get, Module, Param, Post, Query, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { interval, map, Observable, Subject } from 'rxjs';
import { PrismaService } from './prisma.service';
import { GenerationQueueService } from './queue.service';
import { ProvidersService } from './providers.service';

type CanvasNode = { id: string; type?: string; position?: { x: number; y: number }; data: Record<string, unknown> };
type CanvasEdge = { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; animated?: boolean };
type Snapshot = { version: number; nodes: CanvasNode[]; edges: CanvasEdge[]; viewport?: Record<string, number>; savedAt: string };
type Job = { id: string; nodeId?: string; state: string; provider?: string; model?: string; input: unknown; output?: unknown; error?: unknown; createdAt: string; updatedAt: string };

const catalog = [
  { kind: 'text', provider: 'DeepSeek', family: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { kind: 'text', provider: 'Zhipu AI', family: 'GLM', models: ['glm-4.5'] },
  { kind: 'text', provider: 'Moonshot', family: 'Kimi', models: ['kimi-k2'] },
  { kind: 'text', provider: 'OpenAI', family: 'GPT', models: ['gpt-5'] },
  { kind: 'image', provider: 'Google', family: 'Nano Banana', models: ['nano-banana-pro'] },
  { kind: 'image', provider: 'OpenAI', family: 'Image 2', models: ['image-2'] },
  { kind: 'image', provider: 'Volcengine', family: 'Seedream', models: ['seedream-4.0'] },
  { kind: 'video', provider: 'Volcengine', family: 'Seedance', models: ['seedance-1.5-pro'] },
];

const store = {
  projects: new Map<string, { id: string; name: string; version: number; createdAt: string; updatedAt: string }>(),
  snapshots: new Map<string, Snapshot>(),
  assets: new Map<string, Record<string, unknown>>(),
  jobs: new Map<string, Job>(),
  events: new Subject<MessageEvent>(),
};
const now = () => new Date().toISOString();
const ensureProject = (id: string) => {
  const existing = store.projects.get(id);
  if (existing) return existing;
  const project = { id, name: 'Untitled workspace', version: 0, createdAt: now(), updatedAt: now() };
  store.projects.set(id, project);
  return project;
};

@ApiTags('system')
@Controller()
class SystemController {
  constructor(private readonly prisma: PrismaService, private readonly queue: GenerationQueueService, private readonly providers: ProvidersService) {}
  @Get('health') health() { return { status: 'ok', storage: this.prisma.enabled ? 'postgresql' : 'memory', queue: this.queue.enabled ? 'redis' : 'memory', time: now() }; }
  @Get('model-catalog') models() { return catalog; }
  @Get('providers/deepseek') deepseek() { return this.providers.deepseekStatus(); }
  @Sse('events') events(): Observable<MessageEvent> { return store.events.asObservable(); }
  @Get('events/heartbeat') heartbeat() { return interval(15000).pipe(map(() => ({ data: { type: 'heartbeat', at: Date.now() } }))); }
}

@ApiTags('providers')
@Controller('providers/deepseek')
class DeepSeekController {
  constructor(private readonly providers: ProvidersService) {}
  @Post('chat') chat(@Body() body: { messages: ChatMessage[]; model?: string; temperature?: number }) { return this.providers.chat(body.messages, body.model, body.temperature); }
}

@ApiTags('projects')
@Controller('projects')
class ProjectController {
  @Get(':id') get(@Param('id') id: string) { return ensureProject(id); }
  @Post(':id') update(@Param('id') id: string, @Body() body: { name?: string }) { const project = ensureProject(id); if (body.name) project.name = body.name; project.updatedAt = now(); return project; }
  @Get(':id/snapshot') snapshot(@Param('id') id: string) { ensureProject(id); return store.snapshots.get(id) ?? { version: 0, nodes: [], edges: [], savedAt: now() }; }
  @Post(':id/snapshot') save(@Param('id') id: string, @Body() body: { baseVersion?: number; nodes?: CanvasNode[]; edges?: CanvasEdge[]; viewport?: Record<string, number> }) {
    const project = ensureProject(id); const previous = store.snapshots.get(id); const baseVersion = body.baseVersion ?? previous?.version ?? 0;
    if (previous && baseVersion !== previous.version) return { ok: false, conflict: true, current: previous };
    const snapshot: Snapshot = { version: (previous?.version ?? 0) + 1, nodes: body.nodes ?? [], edges: body.edges ?? [], viewport: body.viewport, savedAt: now() };
    store.snapshots.set(id, snapshot); project.version = snapshot.version; project.updatedAt = now();
    store.events.next({ data: { type: 'canvas.saved', projectId: id, version: snapshot.version } } as MessageEvent);
    return { ok: true, project, snapshot };
  }
}

@ApiTags('nodes')
@Controller('projects/:projectId/nodes')
class NodeController {
  @Get('search') search(@Param('projectId') projectId: string, @Query('q') q = '') { const snapshot = store.snapshots.get(projectId); const needle = q.toLowerCase(); return (snapshot?.nodes ?? []).filter((node) => JSON.stringify(node).toLowerCase().includes(needle)); }
  @Post() add(@Param('projectId') projectId: string, @Body() node: CanvasNode) { const snapshot = store.snapshots.get(projectId) ?? { version: 0, nodes: [], edges: [], savedAt: now() }; snapshot.nodes = [...snapshot.nodes, { ...node, id: node.id || crypto.randomUUID() }]; store.snapshots.set(projectId, snapshot); return snapshot.nodes.at(-1); }
  @Post(':nodeId') patch(@Param('projectId') projectId: string, @Param('nodeId') nodeId: string, @Body() data: Record<string, unknown>) { const snapshot = store.snapshots.get(projectId); const node = snapshot?.nodes.find((item) => item.id === nodeId); if (!node) return { ok: false, error: 'NODE_NOT_FOUND' }; node.data = { ...node.data, ...data }; return node; }
}

@ApiTags('assets')
@Controller('assets')
class AssetController {
  @Get() list(@Query('kind') kind?: string) { return [...store.assets.values()].filter((asset) => !kind || asset.kind === kind); }
  @Post() create(@Body() body: Record<string, unknown>) { const asset = { id: crypto.randomUUID(), ...body, createdAt: now() }; store.assets.set(asset.id as string, asset); store.events.next({ data: { type: 'asset.created', asset } } as MessageEvent); return asset; }
  @Post(':id/soft-delete') remove(@Param('id') id: string) { const asset = store.assets.get(id); if (!asset) return { ok: false, error: 'ASSET_NOT_FOUND' }; asset.deletedAt = now(); return asset; }
}

@ApiTags('generation')
@Controller('generation-jobs')
class JobController {
  constructor(private readonly queue: GenerationQueueService) {}
  @Post('preflight') preflight(@Body() body: { model?: string; kind?: string }) { const model = String(body?.model ?? '').trim(); const kind = String(body?.kind ?? '').trim(); const family = catalog.find((item) => item.models.includes(model)); const supported = Boolean(family && (!kind || family.kind === kind)); return { valid: Boolean(model) && supported, provider: family?.provider ?? null, estimatedCost: null, warnings: supported ? [] : ['MODEL_NOT_IN_CATALOG'] }; }
  @Get() list(@Query('state') state?: string) { return [...store.jobs.values()].filter((job) => !state || job.state === state); }
  @Get(':id') get(@Param('id') id: string) { return store.jobs.get(id) ?? { ok: false, error: 'JOB_NOT_FOUND' }; }
  @Post() create(@Body() body: { nodeId?: string; provider?: string; model?: string; input?: unknown }) { const job: Job = { id: crypto.randomUUID(), nodeId: body.nodeId, provider: body.provider, model: body.model, input: body.input ?? body, state: 'awaiting_confirmation', createdAt: now(), updatedAt: now() }; store.jobs.set(job.id, job); return job; }
  @Post(':id/confirm') async confirm(@Param('id') id: string) { const job = store.jobs.get(id); if (!job) return { ok: false, error: 'JOB_NOT_FOUND' }; job.state = 'queued'; job.updatedAt = now(); const queueId = await this.queue.enqueue({ jobId: job.id, provider: job.provider, model: job.model, input: job.input }); store.events.next({ data: { type: 'generation.queued', job, queueId } } as MessageEvent); return { ...job, queueId }; }
  @Post(':id/cancel') cancel(@Param('id') id: string) { const job = store.jobs.get(id); if (!job) return { ok: false, error: 'JOB_NOT_FOUND' }; job.state = 'cancelled'; job.updatedAt = now(); store.events.next({ data: { type: 'generation.cancelled', job } } as MessageEvent); return job; }
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
@Module({ controllers: [SystemController, DeepSeekController, ProjectController, NodeController, AssetController, JobController], providers: [PrismaService, GenerationQueueService, ProvidersService] })
export class AppModule {}
