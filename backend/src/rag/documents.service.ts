import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { ChunkVectorUpsert, ChromaService } from '../chroma/chroma.service';
import { DocumentStoreService } from '../storage/document-store.service';
import { QueryCacheService } from './cost/query-cache.service';
import {
  DocumentStatus,
  DocumentSummary,
  MatchedChunk,
} from './rag.types';

export interface ChunkInsert {
  document_id: string;
  document_name: string;
  chunk_index: number;
  page_number: number;
  content: string;
  embedding: number[];
}

/** Thrown when a document is deleted while background indexing is still running. */
export class DocumentGoneError extends Error {}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly store: DocumentStoreService,
    private readonly chroma: ChromaService,
    private readonly cache: QueryCacheService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  list(): Promise<DocumentSummary[]> {
    return Promise.resolve(this.store.list());
  }

  create(input: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
    chunkCount: number;
  }): Promise<DocumentSummary> {
    return this.store.create(input);
  }

  async insertChunks(rows: ChunkInsert[], indexedSoFar: number): Promise<void> {
    const documentId = rows[0].document_id;
    if (!this.store.get(documentId)) {
      throw new DocumentGoneError();
    }

    const upserts: ChunkVectorUpsert[] = rows.map((row) => ({
      id: `${row.document_id}:${row.chunk_index}`,
      values: row.embedding,
      documentId: row.document_id,
      documentName: row.document_name,
      pageNumber: row.page_number,
      chunkIndex: row.chunk_index,
      textSnippet: row.content,
    }));

    try {
      await this.chroma.upsertChunks(upserts);
    } catch (error) {
      this.chroma.fail('upsert chunk vectors', error);
    }

    await this.store.updateIndexed(documentId, indexedSoFar);
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    extra: { indexed_chunks?: number; error_message?: string | null } = {},
  ): Promise<void> {
    const updated = await this.store.updateStatus(id, status, {
      indexedChunks: extra.indexed_chunks,
      errorMessage: extra.error_message,
    });
    if (!updated && status !== 'failed') {
      this.logger.warn(`Document ${id} missing while updating status to ${status}`);
    }
    if (status === 'ready') this.cache.clear();
  }

  async remove(id: string): Promise<void> {
    const removed = await this.store.remove(id);
    if (!removed) throw new NotFoundException('Document not found.');
    try {
      await this.chroma.deleteByDocumentId(id);
    } catch (error) {
      this.chroma.fail('delete document vectors', error);
    }
    this.cache.clear();
  }

  async matchChunks(params: {
    embedding: number[];
    threshold: number;
    count: number;
    documentIds?: string[];
  }): Promise<MatchedChunk[]> {
    const readyIds = this.store.getReadyIds();
    if (readyIds.length === 0) return [];

    let scope = readyIds;
    if (params.documentIds?.length) {
      const allowed = new Set(params.documentIds);
      scope = readyIds.filter((id) => allowed.has(id));
      if (scope.length === 0) return [];
    }

    const topK = Math.min(
      Math.max(params.count, 1),
      this.config.get('RAG_MATCH_COUNT', { infer: true }),
    );

    let matches;
    try {
      matches = await this.chroma.query({
        embedding: params.embedding,
        topK: params.threshold < 0 ? 1 : Math.max(topK, 8),
        documentIds: scope.length < readyIds.length ? scope : undefined,
      });
    } catch (error) {
      this.chroma.fail('query vectors', error);
    }

    const filtered =
      params.threshold < 0
        ? matches.slice(0, 1)
        : matches.filter((m) => m.score > params.threshold).slice(0, topK);

    return filtered.map((m) => ({
      id: m.id,
      document_id: m.documentId,
      document_name: m.documentName,
      page_number: m.pageNumber,
      chunk_index: m.chunkIndex,
      content: m.textSnippet,
      similarity: m.score,
    }));
  }
}