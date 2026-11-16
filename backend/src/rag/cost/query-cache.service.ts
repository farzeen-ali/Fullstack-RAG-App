import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { EnvironmentVariables } from '../../config/env.validation';
import { AnswerMode, SourceCitation } from '../rag.types';

export interface CachedAnswer {
  answer: string;
  sources: SourceCitation[];
  originalMode: AnswerMode;
}

interface CacheEntry {
  value: CachedAnswer;
  expiresAt: number;
}

/**
 * In-memory LRU cache keyed by SHA-256(normalized question + document scope).
 * The whole cache is dropped whenever the knowledge base changes, so a cached
 * answer can never cite a deleted document or miss a newly indexed one.
 */
@Injectable()
export class QueryCacheService {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.ttlMs = config.get('CACHE_TTL_SECONDS', { infer: true }) * 1000;
    this.maxEntries = config.get('CACHE_MAX_ENTRIES', { infer: true });
  }

  static normalize(question: string): string {
    return question
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\s?!.]+$/g, '')
      .trim();
  }

  buildKey(question: string, documentIds?: string[]): string {
    const scope = documentIds?.length
      ? [...new Set(documentIds.map((id) => id.toLowerCase()))].sort()
      : ['*'];
    return createHash('sha256')
      .update(
        JSON.stringify({ q: QueryCacheService.normalize(question), scope }),
      )
      .digest('hex');
  }

  get(key: string): CachedAnswer | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: CachedAnswer): void {
    if (this.ttlMs <= 0 || this.maxEntries <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
