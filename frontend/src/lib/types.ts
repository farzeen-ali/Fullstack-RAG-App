export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
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

export type AnswerMode = 'zero-token' | 'cache' | 'rag' | 'no-context' | 'blocked';

export interface SourceCitation {
  index: number;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  snippet: string;
  similarityScore: number;
}

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

export type ChatStreamEvent =
  | { event: 'status'; data: { stage: 'searching' | 'generating' } }
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: ChatFooter }
  | { event: 'error'; data: { message: string } };

export type MessagePhase =
  | 'thinking'
  | 'searching'
  | 'generating'
  | 'streaming'
  | 'done'
  | 'stopped'
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  phase: MessagePhase;
  footer?: ChatFooter;
  error?: string;
}
