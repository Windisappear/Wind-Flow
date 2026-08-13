import { Body, Controller, Delete, Get, Inject, Module, Param, Post, Query, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { interval, map, Observable, Subject } from 'rxjs';
import { PrismaService } from './prisma.service';
import { GenerationQueueService } from './queue.service';
import { ProvidersService } from './providers.service';
import { CredentialsService, type ProviderConfigInput } from './credentials.service';

type CanvasNode = { id: string; type?: string; position?: { x: number; y: number }; data: Record<string, unknown> };
type CanvasEdge = { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; animated?: boolean };
type Snapshot = { version: number; nodes: CanvasNode[]; edges: CanvasEdge[]; viewport?: Record<string, number>; savedAt: string };
type Job = { id: string; nodeId?: string; state: string; provider?: string; model?: string; input: unknown; output?: unknown; error?: unknown; remoteId?: string; createdAt: string; updatedAt: string };

const catalog = [
  { kind: 'text', provider: 'DeepSeek', family: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { kind: 'image', provider: 'Volcengine', family: 'Seedream', models: ['seedream-4.0', 'seedream-4.5', 'seedream-5.0'] },
  { kind: 'video', provider: 'Volcengine', family: 'Seedance', models: ['doubao-seedance-2-0-260128'] },
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(GenerationQueueService) private readonly queue: GenerationQueueService, @Inject(ProvidersService) private readonly providers: ProvidersService) {}
  @Get('health') health() { return { status: 'ok', storage: this.prisma.enabled ? 'postgresql' : 'memory', queue: this.queue.enabled ? 'redis' : 'memory', time: now() }; }
  @Get('model-catalog') models() { return catalog; }
  @Get('providers/deepseek') deepseek() { return this.providers.deepseekStatus(); }
  @Sse('events') events(): Observable<MessageEvent> { return store.events.asObservable(); }
  @Get('events/heartbeat') heartbeat() { return interval(15000).pipe(map(() => ({ data: { type: 'heartbeat', at: Date.now() } }))); }
}

@ApiTags('providers')
@Controller('providers/deepseek')
class DeepSeekController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}
  @Post('chat') chat(@Body() body: { messages: ChatMessage[]; model?: string; temperature?: number }) { return this.providers.chat(body.messages, body.model, body.temperature); }
}

@ApiTags('providers')
@Controller('providers/jimeng')
class JimengController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}
  @Get() status() { return this.providers.jimengStatus(); }
  @Post('images') generate(@Body() body: { model?: string; prompt: string; n?: number; size?: string; image?: string[]; ratio?: string; resolution?: string }) { return this.providers.generateJimeng(body); }
}

@ApiTags('providers')
@Controller('providers/volcengine/videos')
class VolcengineVideoController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}
  @Get() status() { return this.providers.volcengineVideoStatus(); }
  @Post('tasks') create(@Body() body: any) { return this.providers.createVideoTask(body); }
  @Get('tasks') list(@Query('providerId') providerId: string, @Query('page_num') pageNum?: string, @Query('page_size') pageSize?: string, @Query('status') status?: string, @Query('model') model?: string, @Query('service_tier') serviceTier?: string) { return this.providers.listVideoTasks({ pageNum: Number(pageNum), pageSize: Number(pageSize), status, model, serviceTier }, providerId || 'doubao-seedance-2-0-260128'); }
  @Get('tasks/:id') get(@Param('id') id: string, @Query('providerId') providerId: string) { return this.providers.getVideoTask(id, providerId || 'doubao-seedance-2-0-260128'); }
  @Post('tasks/:id/cancel') cancel(@Param('id') id: string, @Query('providerId') providerId: string) { return this.providers.cancelVideoTask(id, providerId || 'doubao-seedance-2-0-260128'); }
}

@ApiTags('provider-configurations')
@Controller('provider-configurations')
class ProviderConfigurationsController {
  constructor(private readonly credentials: CredentialsService) {}
  @Get() list() { return this.credentials.list(); }
  @Post() save(@Body() body: ProviderConfigInput) { return this.credentials.upsert(body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.credentials.remove(id); }
}

@ApiTags('projects')
@Controller('projects')
class ProjectController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Get(':id') async get(@Param('id') id: string) { if (!this.prisma.enabled) return ensureProject(id); return this.prisma.project.upsert({ where: { id }, create: { id, name: 'Untitled workspace' }, update: {} }); }
  @Post(':id') async update(@Param('id') id: string, @Body() body: { name?: string }) { if (!this.prisma.enabled) { const project = ensureProject(id); if (body.name) project.name = body.name; project.updatedAt = now(); return project; } return this.prisma.project.upsert({ where: { id }, create: { id, name: body.name || 'Untitled workspace' }, update: body.name ? { name: body.name } : {} }); }
  @Get(':id/snapshot') async snapshot(@Param('id') id: string) { if (!this.prisma.enabled) { ensureProject(id); return store.snapshots.get(id) ?? { version: 0, nodes: [], edges: [], savedAt: now() }; } const latest = await this.prisma.canvasSnapshot.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } }); if (!latest) return { version: 0, nodes: [], edges: [], savedAt: now() }; const data = latest.data as unknown as Snapshot; return { ...data, version: latest.version, savedAt: latest.createdAt.toISOString() }; }
  @Post(':id/snapshot') async save(@Param('id') id: string, @Body() body: { baseVersion?: number; nodes?: CanvasNode[]; edges?: CanvasEdge[]; viewport?: Record<string, number> }) {
    if (this.prisma.enabled) {
      const project = await this.prisma.project.upsert({ where: { id }, create: { id, name: 'Untitled workspace' }, update: {} });
      const latest = await this.prisma.canvasSnapshot.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } }); const baseVersion = body.baseVersion ?? latest?.version ?? 0;
      if (latest && baseVersion !== latest.version) return { ok: false, conflict: true, current: { ...(latest.data as object), version: latest.version, savedAt: latest.createdAt.toISOString() } };
      const snapshot: Snapshot = { version: (latest?.version ?? 0) + 1, nodes: body.nodes ?? [], edges: body.edges ?? [], viewport: body.viewport, savedAt: now() };
      await this.prisma.$transaction([this.prisma.canvasSnapshot.create({ data: { projectId: id, version: snapshot.version, data: snapshot as unknown as object } }), this.prisma.project.update({ where: { id: project.id }, data: { version: snapshot.version } })]);
      store.events.next({ data: { type: 'canvas.saved', projectId: id, version: snapshot.version } } as MessageEvent); return { ok: true, project: { ...project, version: snapshot.version }, snapshot };
    }
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Get() async list(@Query('kind') kind?: string) { if (!this.prisma.enabled) return [...store.assets.values()].filter((asset) => !kind || asset.kind === kind); return this.prisma.asset.findMany({ where: { deletedAt: null, ...(kind ? { kind } : {}) }, orderBy: { createdAt: 'desc' } }); }
  @Post() async create(@Body() body: Record<string, unknown>) { if (this.prisma.enabled) { const asset = await this.prisma.asset.create({ data: { kind: String(body.kind || 'file'), name: String(body.name || 'Untitled asset'), objectKey: String(body.objectKey || ''), hash: body.hash ? String(body.hash) : null, metadata: (body.metadata || {}) as object } }); store.events.next({ data: { type: 'asset.created', asset } } as MessageEvent); return asset; } const asset = { id: crypto.randomUUID(), ...body, createdAt: now() }; store.assets.set(asset.id as string, asset); store.events.next({ data: { type: 'asset.created', asset } } as MessageEvent); return asset; }
  @Post(':id/soft-delete') async remove(@Param('id') id: string) { if (this.prisma.enabled) return this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } }); const asset = store.assets.get(id); if (!asset) return { ok: false, error: 'ASSET_NOT_FOUND' }; asset.deletedAt = now(); return asset; }
}

@ApiTags('generation')
@Controller('generation-jobs')
class JobController {
  constructor(@Inject(GenerationQueueService) private readonly queue: GenerationQueueService, @Inject(ProvidersService) private readonly providers: ProvidersService, @Inject(PrismaService) private readonly prisma: PrismaService, @Inject(CredentialsService) private readonly credentials: CredentialsService) {}
  @Post('preflight') async preflight(@Body() body: { model?: string; kind?: string }) { const model = String(body?.model ?? '').trim(); const kind = String(body?.kind ?? '').trim(); const family = catalog.find((item) => item.models.includes(model)); const configured = family ? undefined : await this.credentials.resolve(model); const supported = Boolean((family && (!kind || family.kind === kind)) || (configured && (!kind || configured.kind === kind))); return { valid: Boolean(model) && supported, provider: family?.provider || configured?.provider || null, estimatedCost: null, warnings: supported ? [] : ['MODEL_NOT_IN_CATALOG'] }; }
  @Get() async list(@Query('state') state?: string) { if (!this.prisma.enabled) return [...store.jobs.values()].filter((job) => !state || job.state === state); return this.prisma.generationJob.findMany({ where: state ? { state } : {}, orderBy: { createdAt: 'asc' } }); }
  @Get(':id') async get(@Param('id') id: string) { if (!this.prisma.enabled) return store.jobs.get(id) ?? { ok: false, error: 'JOB_NOT_FOUND' }; return this.prisma.generationJob.findUnique({ where: { id } }) ?? { ok: false, error: 'JOB_NOT_FOUND' }; }
  @Post() create(@Body() body: { nodeId?: string; provider?: string; model?: string; input?: unknown }) { const job: Job = { id: crypto.randomUUID(), nodeId: body.nodeId, provider: body.provider, model: body.model, input: body.input ?? body, state: 'awaiting_confirmation', createdAt: now(), updatedAt: now() }; store.jobs.set(job.id, job); return job; }
  @Post('video') async createVideo(@Body() body: { nodeId?: string; provider?: string; model: string; input: Record<string, unknown> }) {
    const job: Job = { id: crypto.randomUUID(), nodeId: body.nodeId, provider: body.provider, model: body.model, input: structuredClone(body.input), state: 'running', createdAt: now(), updatedAt: now() };
    store.jobs.set(job.id, job);
    if (this.prisma.enabled) await this.prisma.generationJob.create({ data: { id: job.id, nodeId: job.nodeId, state: job.state, provider: job.provider, model: job.model, input: job.input as object } });
    try {
      const task = await this.providers.createVideoTask({ ...body.input, model: body.model } as Parameters<ProvidersService['createVideoTask']>[0]);
      job.remoteId = String((task as { id?: string }).id || ''); job.state = 'queued'; job.updatedAt = now();
      if (!job.remoteId) throw new Error('Video provider did not return a task ID');
      if (this.prisma.enabled) await this.prisma.generationJob.update({ where: { id: job.id }, data: { state: job.state, remoteId: job.remoteId } });
      store.events.next({ data: { type: 'generation.queued', job } } as MessageEvent); return { job, task };
    } catch (error) {
      job.state = 'failed'; job.error = { message: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }; job.updatedAt = now();
      if (this.prisma.enabled) await this.prisma.generationJob.update({ where: { id: job.id }, data: { state: job.state, error: job.error as object } });
      throw error;
    }
  }
  @Get(':id/video-status') async videoStatus(@Param('id') id: string) {
    const persisted = this.prisma.enabled ? await this.prisma.generationJob.findUnique({ where: { id } }) : undefined;
    const job = persisted ? { ...persisted, input: persisted.input as unknown, output: persisted.output as unknown, error: persisted.error as unknown, createdAt: persisted.createdAt.toISOString(), updatedAt: persisted.updatedAt.toISOString() } as Job : store.jobs.get(id);
    if (!job || !job.remoteId || !job.model) return { ok: false, error: 'VIDEO_JOB_NOT_FOUND' };
    const task = await this.providers.getVideoTask(job.remoteId, job.model); const status = String((task as { status?: string }).status || 'running');
    const state = status === 'succeeded' ? 'succeeded' : ['failed', 'cancelled', 'expired'].includes(status) ? 'failed' : status === 'queued' ? 'queued' : 'running';
    job.state = state; job.output = task; job.updatedAt = now(); store.jobs.set(job.id, job);
    if (this.prisma.enabled) await this.prisma.generationJob.update({ where: { id }, data: { state, output: task as object } });
    return { job, task };
  }
  @Post('run') async run(@Body() body: { nodeId?: string; kind: 'text' | 'image'; provider?: string; model?: string; input: any }) {
    const job: Job = { id: crypto.randomUUID(), nodeId: body.nodeId, provider: body.provider, model: body.model, input: structuredClone(body.input), state: 'running', createdAt: now(), updatedAt: now() };
    store.jobs.set(job.id, job); if (this.prisma.enabled) await this.prisma.generationJob.create({ data: { id: job.id, nodeId: job.nodeId, state: job.state, provider: job.provider, model: job.model, input: job.input as object } }); store.events.next({ data: { type: 'generation.running', job } } as MessageEvent);
    try {
      const output = body.kind === 'text'
        ? await this.providers.chat(body.input.messages, body.model, body.input.temperature)
        : await this.providers.generateJimeng({ ...body.input, model: body.model });
      job.state = 'succeeded'; job.output = output; job.updatedAt = now(); if (this.prisma.enabled) await this.prisma.generationJob.update({ where: { id: job.id }, data: { state: job.state, output: output as object } });
      store.events.next({ data: { type: 'generation.succeeded', job } } as MessageEvent);
      return { job, output };
    } catch (error) {
      job.state = 'failed'; job.error = { message: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }; job.updatedAt = now(); if (this.prisma.enabled) await this.prisma.generationJob.update({ where: { id: job.id }, data: { state: job.state, error: job.error as object } });
      store.events.next({ data: { type: 'generation.failed', job } } as MessageEvent);
      throw error;
    }
  }
  @Post(':id/confirm') async confirm(@Param('id') id: string) { const job = store.jobs.get(id); if (!job) return { ok: false, error: 'JOB_NOT_FOUND' }; job.state = 'queued'; job.updatedAt = now(); const queueId = await this.queue.enqueue({ jobId: job.id, provider: job.provider, model: job.model, input: job.input }); store.events.next({ data: { type: 'generation.queued', job, queueId } } as MessageEvent); return { ...job, queueId }; }
  @Post(':id/cancel') async cancel(@Param('id') id: string) { const persisted = this.prisma.enabled ? await this.prisma.generationJob.findUnique({ where: { id } }) : undefined; const job = persisted ? { ...persisted, input: persisted.input as unknown, output: persisted.output as unknown, error: persisted.error as unknown, createdAt: persisted.createdAt.toISOString(), updatedAt: persisted.updatedAt.toISOString() } as Job : store.jobs.get(id); if (!job) return { ok: false, error: 'JOB_NOT_FOUND' }; if (job.remoteId && job.model) await this.providers.cancelVideoTask(job.remoteId, job.model); job.state = 'cancelled'; job.updatedAt = now(); store.jobs.set(job.id, job); if (this.prisma.enabled) await this.prisma.generationJob.update({ where: { id }, data: { state: job.state } }); store.events.next({ data: { type: 'generation.cancelled', job } } as MessageEvent); return job; }
  @Post(':id/execute') async execute(@Param('id') id: string) {
    const job = store.jobs.get(id); if (!job) return { ok: false, error: 'JOB_NOT_FOUND' };
    job.state = 'running'; job.updatedAt = now(); store.events.next({ data: { type: 'generation.running', job } } as MessageEvent);
    return job;
  }
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
@Module({ controllers: [SystemController, DeepSeekController, JimengController, VolcengineVideoController, ProviderConfigurationsController, ProjectController, NodeController, AssetController, JobController], providers: [PrismaService, GenerationQueueService, CredentialsService, ProvidersService] })
export class AppModule {}
