import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { EnvironmentVariables } from '../config/env.validation';
import { DocumentStatus, DocumentSummary, StoredDocument } from '../rag/rag.types';

interface StoreFile {
  version: 1;
  documents: StoredDocument[];
}

@Injectable()
export class DocumentStoreService implements OnModuleInit {
  private readonly logger = new Logger(DocumentStoreService.name);
  private readonly filePath: string;
  private documents: StoredDocument[] = [];
  private writeChain: Promise<void> = Promise.resolve();

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.filePath = join(
      config.get('DATA_DIR', { infer: true }),
      'documents.json',
    );
  }

  async onModuleInit(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreFile;
      if (parsed?.version === 1 && Array.isArray(parsed.documents)) {
        this.documents = parsed.documents;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(
          `Could not load document store (${this.filePath}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await this.persist();
    }
    this.logger.log(`Document registry: ${this.documents.length} record(s) at ${this.filePath}`);
  }

  list(): DocumentSummary[] {
    return [...this.documents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map(toSummary);
  }

  get(id: string): StoredDocument | undefined {
    return this.documents.find((d) => d.id === id);
  }

  getReadyIds(): string[] {
    return this.documents.filter((d) => d.status === 'ready').map((d) => d.id);
  }

  async create(input: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
    chunkCount: number;
  }): Promise<DocumentSummary> {
    const now = new Date().toISOString();
    const doc: StoredDocument = {
      id: randomUUID(),
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      pageCount: input.pageCount,
      chunkCount: input.chunkCount,
      indexedChunks: 0,
      status: 'processing',
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.mutate((docs) => {
      docs.unshift(doc);
    });
    return toSummary(doc);
  }

  async updateIndexed(documentId: string, indexedChunks: number): Promise<void> {
    await this.mutate((docs) => {
      const doc = docs.find((d) => d.id === documentId);
      if (!doc) return;
      doc.indexedChunks = indexedChunks;
      doc.updatedAt = new Date().toISOString();
    });
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    extra: { indexedChunks?: number; errorMessage?: string | null } = {},
  ): Promise<boolean> {
    let found = false;
    await this.mutate((docs) => {
      const doc = docs.find((d) => d.id === id);
      if (!doc) return;
      found = true;
      doc.status = status;
      if (extra.indexedChunks !== undefined) doc.indexedChunks = extra.indexedChunks;
      if (extra.errorMessage !== undefined) doc.errorMessage = extra.errorMessage;
      doc.updatedAt = new Date().toISOString();
    });
    return found;
  }

  async remove(id: string): Promise<boolean> {
    let removed = false;
    await this.mutate((docs) => {
      const next = docs.filter((d) => d.id !== id);
      removed = next.length !== docs.length;
      docs.length = 0;
      docs.push(...next);
    });
    return removed;
  }

  private async mutate(edit: (docs: StoredDocument[]) => void): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      edit(this.documents);
      await this.persist();
    });
    await this.writeChain;
  }

  private async persist(): Promise<void> {
    const payload: StoreFile = { version: 1, documents: this.documents };
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await rename(tmp, this.filePath);
  }
}

function toSummary(doc: StoredDocument): DocumentSummary {
  return {
    id: doc.id,
    name: doc.name,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    indexedChunks: doc.indexedChunks,
    status: doc.status,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt,
  };
}