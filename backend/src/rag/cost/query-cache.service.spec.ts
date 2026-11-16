import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { QueryCacheService } from './query-cache.service';

function createCache(maxEntries = 3): QueryCacheService {
  const values: Partial<EnvironmentVariables> = {
    CACHE_TTL_SECONDS: 60,
    CACHE_MAX_ENTRIES: maxEntries,
  };
  const config = { get: (key: keyof EnvironmentVariables) => values[key] };
  return new QueryCacheService(
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );
}

const answer = { answer: 'A', sources: [], originalMode: 'rag' as const };

describe('QueryCacheService', () => {
  it('treats casing, whitespace and trailing punctuation as the same question', () => {
    const cache = createCache();
    expect(cache.buildKey('  What is the Leave Policy??  ')).toBe(
      cache.buildKey('what is   the leave policy'),
    );
  });

  it('scopes keys by document set regardless of order', () => {
    const cache = createCache();
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    expect(cache.buildKey('q', [a, b])).toBe(cache.buildKey('q', [b, a]));
    expect(cache.buildKey('q', [a])).not.toBe(cache.buildKey('q'));
  });

  it('evicts the least recently used entry', () => {
    const cache = createCache(2);
    cache.set('a', answer);
    cache.set('b', answer);
    cache.get('a');
    cache.set('c', answer);
    expect(cache.get('a')).not.toBeNull();
    expect(cache.get('b')).toBeNull();
  });
});
