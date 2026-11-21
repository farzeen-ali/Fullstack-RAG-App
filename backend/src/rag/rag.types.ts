export type DocumentStatus = 'processing' | 'ready' | 'failed';

/** Authoritative document metadata (vectors live in ChromaDB). */
export interface StoredDocument {
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
  updatedAt: string;
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
  id: string;
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

