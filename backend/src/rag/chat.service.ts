import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { EnvironmentVariables } from '../config/env.validation';
import { OpenAiService } from '../openai/openai.service';
import { IntentRouterService } from './cost/intent-router.service';
import { QueryCacheService } from './cost/query-cache.service';
import { DocumentsService } from './documents.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import {
  AnswerMode,
  ChatEvent,
  MatchedChunk,
  SourceCitation,
  TokenUsage,
} from './rag.types';
import { StreamOutputGuard } from './security/output-guard';
import {
  BLOCKED_ANSWER,
  buildSystemPrompt,
  buildUserPrompt,
  NOT_FOUND_ANSWER,
} from './security/prompt-builder';
import { PromptGuardService } from './security/prompt-guard.service';

const WITHHELD_NOTICE = '\n\n[Response withheld by the security policy.]';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly canary = `DM-${randomBytes(8).toString('hex')}`;
  private readonly systemPrompt = buildSystemPrompt(this.canary);
  private readonly matchCount: number;
  private readonly threshold: number;
  private readonly maxCompletionTokens: number;

  constructor(
    private readonly intentRouter: IntentRouterService,
    private readonly promptGuard: PromptGuardService,
    private readonly cache: QueryCacheService,
    private readonly documents: DocumentsService,
    private readonly openai: OpenAiService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.matchCount = config.get('RAG_MATCH_COUNT', { infer: true });
    this.threshold = config.get('RAG_SIMILARITY_THRESHOLD', { infer: true });
    this.maxCompletionTokens = config.get('RAG_MAX_COMPLETION_TOKENS', {
      infer: true,
    });
  }

  async *answer(
    dto: ChatRequestDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const startedAt = Date.now();
    const usage: TokenUsage = {
      openaiCalls: 0,
      embeddingTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
    const done = (
      mode: AnswerMode,
      sources: SourceCitation[] = [],
      guardrail?: string,
    ): ChatEvent => ({
      event: 'done',
      data: {
        mode,
        sources,
        usage,
        latencyMs: Date.now() - startedAt,
        guardrail,
      },
    });

    // Layer 1: zero-token conversational router.
    const routed = this.intentRouter.route(dto.question);
    if (routed) {
      yield* this.emitText(routed.reply);
      yield done('zero-token');
      return;
    }

    // Layer 2: prompt-injection guard (still zero tokens when it blocks).
    const guard = this.promptGuard.inspect(dto.question);
    if (guard.findings.length > 0) {
      this.logger.warn(
        `Prompt guard ${guard.blocked ? 'blocked' : 'sanitized'} a request: ${guard.findings.join(', ')}`,
      );
    }
    if (guard.blocked) {
      yield* this.emitText(BLOCKED_ANSWER);
      yield done('blocked', [], guard.findings.join(','));
      return;
    }
    const question = guard.sanitized;

    // Layer 3: normalized query cache.
    const cacheKey = this.cache.buildKey(question, dto.documentIds);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      yield* this.emitText(cached.answer);
      yield done('cache', cached.sources);
      return;
    }

    // Layer 4: embedding + pgvector similarity search.
    yield { event: 'status', data: { stage: 'searching' } };
    const embedding = await this.openai.embed([question], signal);
    usage.openaiCalls += 1;
    usage.embeddingTokens += embedding.tokens;

    const chunks = await this.documents.matchChunks({
      embedding: embedding.vectors[0],
      threshold: this.threshold,
      count: this.matchCount,
      documentIds: dto.documentIds,
    });

    if (chunks.length === 0) {
      const [closest] = await this.documents.matchChunks({
        embedding: embedding.vectors[0],
        threshold: -1,
        count: 1,
        documentIds: dto.documentIds,
      });
      this.logger.log(
        closest
          ? `No chunk passed RAG_SIMILARITY_THRESHOLD=${this.threshold}; closest was ${closest.similarity.toFixed(3)} ("${closest.document_name}" p.${closest.page_number})`
          : 'No indexed chunks available for retrieval.',
      );
      yield* this.emitText(NOT_FOUND_ANSWER);
      this.cache.set(cacheKey, {
        answer: NOT_FOUND_ANSWER,
        sources: [],
        originalMode: 'no-context',
      });
      yield done('no-context');
      return;
    }

    // Layer 5: grounded, streamed synthesis.
    yield { event: 'status', data: { stage: 'generating' } };
    const outputGuard = new StreamOutputGuard(this.canary);
    const completion = new AbortController();
    const onClientAbort = () => completion.abort();
    signal.addEventListener('abort', onClientAbort, { once: true });

    let answer = '';
    try {
      usage.openaiCalls += 1;
      for await (const part of this.openai.streamChat({
        system: this.systemPrompt,
        user: buildUserPrompt(question, chunks),
        maxTokens: this.maxCompletionTokens,
        signal: completion.signal,
      })) {
        if (part.type === 'usage') {
          usage.promptTokens += part.promptTokens;
          usage.completionTokens += part.completionTokens;
          continue;
        }
        const safe = outputGuard.push(part.text);
        if (outputGuard.compromised) {
          completion.abort();
          break;
        }
        if (safe) {
          answer += safe;
          yield { event: 'token', data: { text: safe } };
        }
      }
    } catch (error) {
      if (!completion.signal.aborted) throw error;
    } finally {
      signal.removeEventListener('abort', onClientAbort);
    }

    if (signal.aborted) return;

    const tail = outputGuard.flush();
    if (tail) {
      answer += tail;
      yield { event: 'token', data: { text: tail } };
    }

    if (outputGuard.compromised) {
      this.logger.warn(
        'Output guard withheld a response containing the system-prompt canary.',
      );
      yield { event: 'token', data: { text: WITHHELD_NOTICE } };
      yield done('rag', [], 'output-canary');
      return;
    }

    const sources = this.selectSources(answer, chunks);
    this.cache.set(cacheKey, { answer, sources, originalMode: 'rag' });
    yield done('rag', sources);
  }

  private *emitText(text: string): Generator<ChatEvent> {
    // Word-sized pieces keep the client's streaming renderer on a single code path.
    for (const piece of text.match(/\S+\s*/g) ?? [text]) {
      yield { event: 'token', data: { text: piece } };
    }
  }

  /** Keeps only the sources the model actually cited; falls back to all retrieved chunks. */
  private selectSources(
    answer: string,
    chunks: MatchedChunk[],
  ): SourceCitation[] {
    const all = chunks.map<SourceCitation>((chunk, i) => ({
      index: i + 1,
      documentId: chunk.document_id,
      documentName: chunk.document_name,
      pageNumber: chunk.page_number,
      chunkIndex: chunk.chunk_index,
      snippet: chunk.content,
      similarityScore: Math.round(chunk.similarity * 1000) / 1000,
    }));

    if (answer.trim().startsWith(NOT_FOUND_ANSWER.slice(0, 40))) return [];

    const cited = new Set(
      [...answer.matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1])),
    );
    const filtered = all.filter((source) => cited.has(source.index));
    return filtered.length > 0 ? filtered : all;
  }
}
