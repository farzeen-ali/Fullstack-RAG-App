import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, type Collection, type Metadata, type Where } from 'chromadb';
import { EnvironmentVariables } from '../config/env.validation';

export interface ChunkVectorUpsert {
  id: string;
  values: number[];
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  textSnippet: string;
}

export interface ChromaMatch {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  textSnippet: string;
  score: number;
}

const SNIPPET_MAX = 3500;
const UPSERT_BATCH = 100;

type ChromaRecordMeta = Metadata & {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  textSnippet: string;
};

function parseChromaUrl(raw: string): { host: string; port: number; ssl: boolean } {
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withScheme);
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 8000;
  return { host: url.hostname, port, ssl: url.protocol === 'https:' };
}

/** Cosine distance in Chroma is `1 - cosine_similarity` for normalized embeddings. */
function distanceToSimilarity(distance: number): number {
  return 1 - distance;
}

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client!: ChromaClient;
  private collection!: Collection;
  private collectionName!: string;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  async onModuleInit(): Promise<void> {
    const chromaUrl = this.config.get('CHROMA_URL', { infer: true });
    const { host, port, ssl } = parseChromaUrl(chromaUrl);
    this.collectionName = this.config.get('CHROMA_COLLECTION_NAME', { infer: true });

    this.client = new ChromaClient({ host, port, ssl });

    try {
      await this.client.heartbeat();
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { 'hnsw:space': 'cosine' },
        configuration: { hnsw: { space: 'cosine' } },
        embeddingFunction: null,
      });
      const count = await this.collection.count();
      this.logger.log(
        `ChromaDB connected at ${chromaUrl} — collection "${this.collectionName}" (${count} records)`,
      );
    } catch (error) {
      this.logger.error(
        `ChromaDB is not reachable at ${chromaUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async upsertChunks(rows: ChunkVectorUpsert[]): Promise<void> {
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH);
      await this.collection.upsert({
        ids: batch.map((row) => row.id),
        embeddings: batch.map((row) => row.values),
        documents: batch.map((row) => row.textSnippet),
        metadatas: batch.map(
          (row) =>
            ({
              documentId: row.documentId,
              documentName: row.documentName,
              pageNumber: row.pageNumber,
              chunkIndex: row.chunkIndex,
              textSnippet: row.textSnippet.slice(0, SNIPPET_MAX),
            }) satisfies ChromaRecordMeta,
        ),
      });
    }
  }

  async query(params: {
    embedding: number[];
    topK: number;
    documentIds?: string[];
  }): Promise<ChromaMatch[]> {
    const where = this.buildWhere(params.documentIds);
    const result = await this.collection.query({
      queryEmbeddings: [params.embedding],
      nResults: params.topK,
      where,
      include: ['metadatas', 'documents', 'distances'],
    });

    const ids = result.ids[0] ?? [];
    const distances = result.distances[0] ?? [];
    const metadatas = result.metadatas[0] ?? [];
    const documents = result.documents[0] ?? [];

    return ids.flatMap((id, index) => {
      const md = metadatas[index];
      const distance = distances[index];
      if (distance === null || distance === undefined || !md) return [];

      const documentId = md.documentId;
      const documentName = md.documentName;
      const pageNumber = md.pageNumber;
      const chunkIndex = md.chunkIndex;
      const textSnippet =
        (typeof md.textSnippet === 'string' ? md.textSnippet : null) ??
        documents[index] ??
        '';

      if (
        typeof documentId !== 'string' ||
        typeof documentName !== 'string' ||
        typeof pageNumber !== 'number' ||
        typeof chunkIndex !== 'number' ||
        typeof textSnippet !== 'string'
      ) {
        return [];
      }

      return [
        {
          id,
          documentId,
          documentName,
          pageNumber,
          chunkIndex,
          textSnippet,
          score: distanceToSimilarity(distance),
        },
      ];
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.collection.delete({
      where: { documentId: { $eq: documentId } } as Where,
    });
  }

  private buildWhere(documentIds?: string[]): Where | undefined {
    if (documentIds?.length === 1) {
      return { documentId: { $eq: documentIds[0] } };
    }
    if (documentIds?.length) {
      return { documentId: { $in: documentIds } };
    }
    return undefined;
  }

  fail(action: string, error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`ChromaDB failed to ${action}: ${message}`);
    throw new InternalServerErrorException(
      'Vector knowledge base is unavailable. Please try again.',
    );
  }
}