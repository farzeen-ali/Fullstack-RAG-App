import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { QueryCacheService } from './cost/query-cache.service';
import {
  DocumentRow,
  DocumentStatus,
  DocumentSummary,
  MatchedChunk,
  toDocumentSummary,
} from './rag.types';

const DOCUMENT_COLUMNS =
  'id, name, mime_type, size_bytes, page_count, chunk_count, indexed_chunks, status, error_message, created_at';

export interface ChunkInsert {
  document_id: string;
  document_name: string;
  chunk_index: number;
  page_number: number;
  content: string;
  embedding: number[];
}

export class DocumentGoneError extends Error {}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: QueryCacheService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async list(): Promise<DocumentSummary[]> {
    const { data, error } = await this.db
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) this.fail('list documents', error);
    return (data as DocumentRow[]).map(toDocumentSummary);
  }

  async create(input: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
    chunkCount: number;
  }): Promise<DocumentSummary> {
    const { data, error } = await this.db
      .from('documents')
      .insert({
        name: input.name,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        page_count: input.pageCount,
        chunk_count: input.chunkCount,
        status: 'processing',
      })
      .select(DOCUMENT_COLUMNS)
      .single();
    if (error) this.fail('create document', error);
    return toDocumentSummary(data);
  }

  async insertChunks(rows: ChunkInsert[], indexedSoFar: number): Promise<void> {
    const { error } = await this.db.from('document_chunks').insert(rows);
    if (error) {
      // 23503 = foreign_key_violation: the document was deleted mid-ingestion.
      if (error.code === '23503') throw new DocumentGoneError();
      this.fail('insert chunks', error);
    }
    await this.updateStatus(rows[0].document_id, 'processing', {
      indexed_chunks: indexedSoFar,
    });
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    extra: { indexed_chunks?: number; error_message?: string | null } = {},
  ): Promise<void> {
    const { error } = await this.db
      .from('documents')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) this.fail('update document status', error);
    if (status === 'ready') this.cache.clear();
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await this.db
      .from('documents')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) this.fail('delete document', error);
    if (!data || data.length === 0)
      throw new NotFoundException('Document not found.');
    this.cache.clear();
  }

  async matchChunks(params: {
    embedding: number[];
    threshold: number;
    count: number;
    documentIds?: string[];
  }): Promise<MatchedChunk[]> {
    const result = await this.db.rpc('match_documents', {
      query_embedding: params.embedding,
      match_threshold: params.threshold,
      match_count: params.count,
      filter_document_ids: params.documentIds?.length
        ? params.documentIds
        : null,
    });
    if (result.error) this.fail('match documents', result.error);
    return (result.data ?? []) as MatchedChunk[];
  }

  private fail(
    action: string,
    error: { message: string; code?: string },
  ): never {
    this.logger.error(
      `Supabase failed to ${action}: [${error.code ?? 'n/a'}] ${error.message}`,
    );
    throw new InternalServerErrorException(
      'Knowledge base storage is unavailable. Please try again.',
    );
  }
}
