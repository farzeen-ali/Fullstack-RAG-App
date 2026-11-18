import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  Pinecone,
  type DocumentRecord,
  type DocumentScoringMethod,
  type PineconeRecord,
  type RecordMetadata,
} from '@pinecone-database/pinecone';

import { EnvironmentVariables } from '../config/env.validation';

export interface ChunkVectorUpsert {
  id: string;

  /** OpenAI (or other) embedding — used for legacy / BYO dense_vector schema indexes. */

  values: number[];

  /** Text stored in the integrated-embed field (e.g. `chunk_text`). */

  indexText: string;

  documentId: string;

  documentName: string;

  pageNumber: number;

  chunkIndex: number;

  textSnippet: string;
}

export interface PineconeMatch {
  id: string;

  documentId: string;

  documentName: string;

  pageNumber: number;

  chunkIndex: number;

  textSnippet: string;

  score: number;
}

export type PineconeWriteMode =
  'legacy_vectors' | 'documents_embed' | 'documents_dense';

type SchemaField = {
  type?: string;

  embed?: { dimension?: number };
};

type IndexDescription = {
  schema?: { fields?: Record<string, SchemaField> };
};

const SNIPPET_MAX = 3500;

const UPSERT_BATCH = 100;

const EMBED_DEFAULT_FIELD = 'chunk_text';

@Injectable()
export class PineconeService implements OnModuleInit {
  private readonly logger = new Logger(PineconeService.name);

  private client!: Pinecone;

  private indexName!: string;

  private namespace!: string;

  private writeMode: PineconeWriteMode = 'legacy_vectors';

  private embedField = EMBED_DEFAULT_FIELD;

  private denseVectorField = '';

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get usesIntegratedEmbedding(): boolean {
    return this.writeMode === 'documents_embed';
  }

  async onModuleInit(): Promise<void> {
    this.client = new Pinecone({
      apiKey: this.config.get('PINECONE_API_KEY', { infer: true }),
    });

    this.indexName = this.config.get('PINECONE_INDEX_NAME', { infer: true });

    this.namespace = this.config.get('PINECONE_NAMESPACE', { infer: true });

    try {
      const description = (await this.client.describeIndex(
        this.indexName,
      )) as IndexDescription;

      this.detectWriteMode(description);

      this.logger.log(
        `Pinecone index "${this.indexName}" (namespace "${this.namespace}") — write mode: ${this.writeMode}${
          this.writeMode === 'documents_embed'
            ? `, embed field: ${this.embedField}`
            : this.writeMode === 'documents_dense'
              ? `, dense field: ${this.denseVectorField}`
              : ''
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Pinecone index "${this.indexName}" is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private detectWriteMode(description: IndexDescription): void {
    const fields = description.schema?.fields;

    if (!fields || Object.keys(fields).length === 0) {
      this.writeMode = 'legacy_vectors';

      return;
    }

    const embedOverride = this.config.get('PINECONE_EMBED_FIELD', {
      infer: true,
    });

    if (embedOverride) {
      const field = fields[embedOverride];

      if (field?.embed) {
        this.writeMode = 'documents_embed';

        this.embedField = embedOverride;

        return;
      }

      this.logger.warn(
        `PINECONE_EMBED_FIELD="${embedOverride}" is not an embed field on this index; auto-detecting instead.`,
      );
    }

    for (const [name, field] of Object.entries(fields)) {
      if (field.embed) {
        this.writeMode = 'documents_embed';

        this.embedField = name;

        return;
      }
    }

    const denseOverride = this.config.get('PINECONE_DENSE_FIELD', {
      infer: true,
    });

    if (denseOverride && fields[denseOverride]?.type === 'dense_vector') {
      this.writeMode = 'documents_dense';

      this.denseVectorField = denseOverride;

      return;
    }

    for (const [name, field] of Object.entries(fields)) {
      if (field.type === 'dense_vector') {
        this.writeMode = 'documents_dense';

        this.denseVectorField = name;

        return;
      }
    }

    this.writeMode = 'legacy_vectors';

    this.logger.warn(
      'Index has a document schema but no embed or dense_vector field was found; falling back to legacy vector writes (they may fail). Create a dense_vector field or use an embed field such as chunk_text.',
    );
  }

  private index() {
    return this.client.index(this.indexName).namespace(this.namespace);
  }

  async upsertChunks(rows: ChunkVectorUpsert[]): Promise<void> {
    if (this.writeMode === 'legacy_vectors') {
      await this.upsertLegacyVectors(rows);

      return;
    }

    await this.upsertDocuments(rows);
  }

  private async upsertLegacyVectors(rows: ChunkVectorUpsert[]): Promise<void> {
    const ns = this.index();

    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows
        .slice(i, i + UPSERT_BATCH)
        .map<PineconeRecord<RecordMetadata>>((row) => ({
          id: row.id,

          values: row.values,

          metadata: {
            documentId: row.documentId,

            documentName: row.documentName,

            pageNumber: row.pageNumber,

            chunkIndex: row.chunkIndex,

            textSnippet: row.textSnippet.slice(0, SNIPPET_MAX),
          },
        }));

      await ns.upsert({ records: batch });
    }
  }

  private async upsertDocuments(rows: ChunkVectorUpsert[]): Promise<void> {
    const index = this.index();

    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH).map((row) => {
        const base: DocumentRecord = {
          _id: row.id,

          title: row.documentName,

          documentId: row.documentId,

          documentName: row.documentName,

          pageNumber: row.pageNumber,

          chunkIndex: row.chunkIndex,

          textSnippet: row.textSnippet.slice(0, SNIPPET_MAX),
        };

        if (this.writeMode === 'documents_embed') {
          base[this.embedField] = row.indexText;
        } else {
          base[this.denseVectorField] = row.values;
        }

        return base;
      });

      await index.documents.upsert({ documents: batch });
    }
  }

  async query(params: {
    embedding?: number[];

    queryText?: string;

    topK: number;

    documentIds?: string[];
  }): Promise<PineconeMatch[]> {
    const filter = this.buildDocumentFilter(params.documentIds);

    if (this.writeMode === 'legacy_vectors') {
      if (!params.embedding?.length) {
        throw new Error(
          'Embedding vector is required for legacy Pinecone indexes.',
        );
      }

      return this.queryLegacyVectors(params.embedding, params.topK, filter);
    }

    const queryText = params.queryText?.trim();
    const embedding = params.embedding;
    if (this.writeMode === 'documents_embed') {
      if (!queryText) {
        throw new Error(
          'Query text is required for Pinecone integrated-embedding indexes.',
        );
      }
      return this.queryDocuments({
        scoreBy: [{ type: 'embed', field: this.embedField, query: queryText }],
        topK: params.topK,
        filter,
      });
    }

    if (!embedding?.length) {
      throw new Error(
        'Embedding vector is required for BYO dense_vector schema indexes.',
      );
    }
    return this.queryDocuments({
      scoreBy: [
        {
          type: 'dense_vector',
          field: this.denseVectorField,
          values: embedding,
        },
      ],
      topK: params.topK,
      filter,
    });
  }

  private buildDocumentFilter(
    documentIds?: string[],
  ): Record<string, unknown> | undefined {
    if (documentIds?.length === 1) {
      return { documentId: { $eq: documentIds[0] } };
    }

    if (documentIds?.length) {
      return { documentId: { $in: documentIds } };
    }

    return undefined;
  }

  private async queryLegacyVectors(
    embedding: number[],

    topK: number,

    filter: Record<string, unknown> | undefined,
  ): Promise<PineconeMatch[]> {
    const response = await this.index().query({
      vector: embedding,

      topK,

      includeMetadata: true,

      filter,
    });

    return (response.matches ?? []).flatMap((match) => {
      const md = match.metadata;

      if (
        !md ||
        typeof md.documentId !== 'string' ||
        typeof md.documentName !== 'string' ||
        typeof md.textSnippet !== 'string' ||
        typeof md.pageNumber !== 'number' ||
        typeof md.chunkIndex !== 'number'
      ) {
        return [];
      }

      return [
        {
          id: match.id,

          documentId: md.documentId,

          documentName: md.documentName,

          pageNumber: md.pageNumber,

          chunkIndex: md.chunkIndex,

          textSnippet: md.textSnippet,

          score: match.score ?? 0,
        },
      ];
    });
  }

  private async queryDocuments(params: {
    scoreBy: DocumentScoringMethod[];

    topK: number;

    filter?: Record<string, unknown>;
  }): Promise<PineconeMatch[]> {
    const response = await this.index().documents.search({
      scoreBy: params.scoreBy,

      topK: params.topK,

      includeFields: [
        'documentId',

        'documentName',

        'pageNumber',

        'chunkIndex',

        'textSnippet',
      ],

      filter: params.filter,
    });

    return (response.matches ?? []).flatMap((match) => {
      const row = match as Record<string, unknown>;

      const id = typeof row._id === 'string' ? row._id : '';

      const score = typeof row._score === 'number' ? row._score : 0;

      if (
        !id ||
        typeof row.documentId !== 'string' ||
        typeof row.documentName !== 'string' ||
        typeof row.textSnippet !== 'string' ||
        typeof row.pageNumber !== 'number' ||
        typeof row.chunkIndex !== 'number'
      ) {
        return [];
      }

      return [
        {
          id,

          documentId: row.documentId,

          documentName: row.documentName,

          pageNumber: row.pageNumber,

          chunkIndex: row.chunkIndex,

          textSnippet: row.textSnippet,

          score,
        },
      ];
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const filter = { documentId: { $eq: documentId } };

    if (this.writeMode === 'legacy_vectors') {
      await this.index().deleteMany({ filter });

      return;
    }

    await this.index().documents.delete({ filter });
  }

  fail(action: string, error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(`Pinecone failed to ${action}: ${message}`);

    throw new InternalServerErrorException(
      'Vector knowledge base is unavailable. Please try again.',
    );
  }
}
