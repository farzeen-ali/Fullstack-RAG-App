export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface DocumentRow {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  indexed_chunks: number;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
}

export interface DocumentSummary {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  chunkCount: number;
  indexedChunks: number;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
}

export interface MatchedChunk {
  id: number;
  document_id: string;
  document_name: string;
  page_number: number;
  chunk_index: number;
  content: string;
  similarity: number;
}

export interface SourceCitation {
  index: number;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  snippet: string;
  similarityScore: number;
}

/**
 * - `zero-token`: answered by the deterministic conversational router.
 * - `cache`: replayed from the normalized query cache.
 * - `rag`: embedded, retrieved and synthesized by the chat model.
 * - `no-context`: nothing in the knowledge base passed the similarity threshold.
 * - `blocked`: refused by the prompt-injection guard.
 */
export type AnswerMode =
  'zero-token' | 'cache' | 'rag' | 'no-context' | 'blocked';

export interface TokenUsage {
  openaiCalls: number;
  embeddingTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export interface ChatFooter {
  mode: AnswerMode;
  sources: SourceCitation[];
  usage: TokenUsage;
  latencyMs: number;
  guardrail?: string;
}

export type ChatEvent =
  | { event: 'status'; data: { stage: 'searching' | 'generating' } }
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: ChatFooter }
  | { event: 'error'; data: { message: string } };

export function toDocumentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    chunkCount: row.chunk_count,
    indexedChunks: row.indexed_chunks,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}
