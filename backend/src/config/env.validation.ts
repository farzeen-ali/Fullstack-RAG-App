export interface EnvironmentVariables {
  NODE_ENV: string;
  HOST: string;
  PORT: number;
  CORS_ORIGINS: string[];
  DATA_DIR: string;

  OPENAI_API_KEY: string;
  CHROMA_URL: string;
  CHROMA_COLLECTION_NAME: string;

  RAG_MATCH_COUNT: number;
  RAG_SIMILARITY_THRESHOLD: number;
  RAG_MAX_COMPLETION_TOKENS: number;
  RAG_MAX_CHUNKS_PER_DOCUMENT: number;

  CACHE_TTL_SECONDS: number;
  CACHE_MAX_ENTRIES: number;

  THROTTLE_TTL_MS: number;
  THROTTLE_LIMIT: number;
}

type RawEnv = Record<string, string | undefined>;

function requireString(env: RawEnv, key: string, errors: string[]): string {
  const value = env[key]?.trim();
  if (!value) {
    errors.push(`${key} is required`);
    return '';
  }
  return value;
}

function readNumber(
  env: RawEnv,
  key: string,
  fallback: number,
  min: number,
  max: number,
  errors: string[],
): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    errors.push(`${key} must be a number between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

export function validateEnv(raw: RawEnv): EnvironmentVariables {
  const errors: string[] = [];

  const env: EnvironmentVariables = {
    NODE_ENV: raw.NODE_ENV?.trim() || 'development',
    HOST: raw.HOST?.trim() || '0.0.0.0',
    PORT: readNumber(raw, 'PORT', 3000, 1, 65535, errors),
    CORS_ORIGINS: (raw.CORS_ORIGINS ?? 'http://localhost:8081')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    DATA_DIR: raw.DATA_DIR?.trim() || './data',

    OPENAI_API_KEY: requireString(raw, 'OPENAI_API_KEY', errors),
    CHROMA_URL: raw.CHROMA_URL?.trim() || 'http://localhost:8000',
    CHROMA_COLLECTION_NAME:
      raw.CHROMA_COLLECTION_NAME?.trim() || 'documind_rag',

    RAG_MATCH_COUNT: readNumber(raw, 'RAG_MATCH_COUNT', 4, 1, 4, errors),
    RAG_SIMILARITY_THRESHOLD: readNumber(
      raw,
      'RAG_SIMILARITY_THRESHOLD',
      0.72,
      -1,
      1,
      errors,
    ),
    RAG_MAX_COMPLETION_TOKENS: readNumber(
      raw,
      'RAG_MAX_COMPLETION_TOKENS',
      600,
      64,
      2000,
      errors,
    ),
    RAG_MAX_CHUNKS_PER_DOCUMENT: readNumber(
      raw,
      'RAG_MAX_CHUNKS_PER_DOCUMENT',
      1500,
      1,
      10000,
      errors,
    ),

    CACHE_TTL_SECONDS: readNumber(
      raw,
      'CACHE_TTL_SECONDS',
      3600,
      0,
      86400,
      errors,
    ),
    CACHE_MAX_ENTRIES: readNumber(
      raw,
      'CACHE_MAX_ENTRIES',
      500,
      0,
      100000,
      errors,
    ),

    THROTTLE_TTL_MS: readNumber(
      raw,
      'THROTTLE_TTL_MS',
      60000,
      1000,
      3600000,
      errors,
    ),
    THROTTLE_LIMIT: readNumber(raw, 'THROTTLE_LIMIT', 15, 1, 10000, errors),
  };

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration (check backend/.env):\n  - ${errors.join('\n  - ')}`,
    );
  }

  return env;
}