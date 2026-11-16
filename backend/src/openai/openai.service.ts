import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EnvironmentVariables } from '../config/env.validation';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const CHAT_MODEL = 'gpt-4o-mini';

const EMBEDDING_BATCH_SIZE = 96;

export interface EmbeddingResult {
  vectors: number[][];
  tokens: number;
}

export type ChatStreamPart =
  | { type: 'token'; text: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number };

export interface StreamChatParams {
  system: string;
  user: string;
  maxTokens: number;
  signal?: AbortSignal;
}

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.client = new OpenAI({
      apiKey: config.get('OPENAI_API_KEY', { infer: true }),
      maxRetries: 2,
      timeout: 60_000,
    });
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<EmbeddingResult> {
    const vectors: number[][] = [];
    let tokens = 0;

    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const response = await this.client.embeddings.create(
        { model: EMBEDDING_MODEL, input: batch, encoding_format: 'float' },
        { signal },
      );
      const ordered = [...response.data].sort((a, b) => a.index - b.index);
      vectors.push(...ordered.map((item) => item.embedding));
      tokens += response.usage?.total_tokens ?? 0;
    }

    return { vectors, tokens };
  }

  async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamPart> {
    const stream = await this.client.chat.completions.create(
      {
        model: CHAT_MODEL,
        temperature: 0.1,
        max_completion_tokens: params.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      },
      { signal: params.signal },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: 'token', text: delta };
      if (chunk.usage) {
        yield {
          type: 'usage',
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
        };
      }
    }
  }
}
