import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service';

export type ProviderConfigInput = { id: string; kind: 'text' | 'image' | 'video'; provider: string; displayName: string; modelId: string; baseUrl: string; apiMode: 'openai-chat' | 'openai-images' | 'ark-video'; endpointPath?: string; apiKey?: string };
export type ProviderConfig = Omit<ProviderConfigInput, 'apiKey'> & { hasCredential: boolean };

@Injectable()
export class CredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  private key() { const source = process.env.CREDENTIAL_ENCRYPTION_KEY; if (!source) throw new BadRequestException('CREDENTIAL_ENCRYPTION_KEY is required before saving provider credentials'); return createHash('sha256').update(source).digest(); }
  private encrypt(value: string) { const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key(), nonce); return { encryptedValue: Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64'), nonce: nonce.toString('base64'), authTag: cipher.getAuthTag().toString('base64') }; }
  private decrypt(record: { encryptedValue: string; nonce: string; authTag: string }) { const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(record.nonce, 'base64')); decipher.setAuthTag(Buffer.from(record.authTag, 'base64')); return Buffer.concat([decipher.update(Buffer.from(record.encryptedValue, 'base64')), decipher.final()]).toString('utf8'); }
  private validate(input: ProviderConfigInput) {
    if (!this.prisma.enabled) throw new BadRequestException('PostgreSQL is required for provider credentials');
    if (!['openai-chat', 'openai-images', 'ark-video'].includes(input.apiMode)) throw new BadRequestException('Unsupported API mode');
    let url: URL; try { url = new URL(input.baseUrl); } catch { throw new BadRequestException('Base URL is invalid'); }
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new BadRequestException('Only HTTPS provider URLs are allowed');
  }
  async list(): Promise<ProviderConfig[]> { if (!this.prisma.enabled) return []; const rows = await this.prisma.providerCredential.findMany({ orderBy: { updatedAt: 'desc' } }); return rows.map(({ encryptedValue, nonce, authTag, updatedAt: _updatedAt, endpointPath, ...item }) => ({ ...item, endpointPath: endpointPath || undefined, kind: item.kind as ProviderConfig['kind'], apiMode: item.apiMode as ProviderConfig['apiMode'], hasCredential: Boolean(encryptedValue && nonce && authTag) })); }
  async upsert(input: ProviderConfigInput): Promise<ProviderConfig> {
    this.validate(input); const existing = await this.prisma.providerCredential.findUnique({ where: { id: input.id } });
    if (!input.apiKey && !existing) throw new BadRequestException('API Key is required for a new provider');
    const secret = input.apiKey ? this.encrypt(input.apiKey) : { encryptedValue: existing!.encryptedValue, nonce: existing!.nonce, authTag: existing!.authTag };
    const row = await this.prisma.providerCredential.upsert({ where: { id: input.id }, create: { ...input, endpointPath: input.endpointPath || null, ...secret }, update: { kind: input.kind, provider: input.provider, displayName: input.displayName, modelId: input.modelId, baseUrl: input.baseUrl.replace(/\/$/, ''), apiMode: input.apiMode, endpointPath: input.endpointPath || null, ...secret } });
    return { id: row.id, kind: row.kind as ProviderConfig['kind'], provider: row.provider, displayName: row.displayName, modelId: row.modelId, baseUrl: row.baseUrl, apiMode: row.apiMode as ProviderConfig['apiMode'], endpointPath: row.endpointPath || undefined, hasCredential: true };
  }
  async remove(id: string) { if (!this.prisma.enabled) return { ok: false }; await this.prisma.providerCredential.delete({ where: { id } }).catch(() => { throw new NotFoundException('Provider configuration not found'); }); return { ok: true }; }
  async resolve(id: string) { if (!this.prisma.enabled) return undefined; const row = await this.prisma.providerCredential.findUnique({ where: { id } }); if (!row) return undefined; return { id: row.id, kind: row.kind as ProviderConfig['kind'], provider: row.provider, displayName: row.displayName, modelId: row.modelId, baseUrl: row.baseUrl, apiMode: row.apiMode as ProviderConfigInput['apiMode'], endpointPath: row.endpointPath || undefined, apiKey: this.decrypt(row) }; }
}
