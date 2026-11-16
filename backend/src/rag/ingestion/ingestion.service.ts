import {
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { OpenAiService } from '../../openai/openai.service';
import { DocumentGoneError, DocumentsService } from '../documents.service';
import { DocumentSummary, TextChunk } from '../rag.types';
import { detectKind, extractPages, sanitizeFileName } from './document-parser';
import { chunkPages } from './text-chunker';

const INDEX_BATCH_SIZE = 64;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly maxChunks: number;

  constructor(
    private readonly documents: DocumentsService,
    private readonly openai: OpenAiService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxChunks = config.get('RAG_MAX_CHUNKS_PER_DOCUMENT', { infer: true });
  }

  /**
   * Parses and chunks synchronously (so validation errors reach the client),
   * then embeds and stores chunks in the background. Clients poll
   * `GET /rag/documents` to follow `indexedChunks / chunkCount`.
   */
  async ingest(file: Express.Multer.File): Promise<DocumentSummary> {
    const name = sanitizeFileName(file.originalname);
    const kind = detectKind(name, file.mimetype, file.buffer);
    const pages = await extractPages(file.buffer, kind);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      throw new UnprocessableEntityException(
        kind === 'pdf'
          ? 'No selectable text found. Scanned/image-only PDFs need OCR before upload.'
          : 'The file is empty.',
      );
    }
    if (chunks.length > this.maxChunks) {
      throw new PayloadTooLargeException(
        `Document produces ${chunks.length} chunks; the limit is ${this.maxChunks}. Split it into smaller files.`,
      );
    }

    const document = await this.documents.create({
      name,
      mimeType: kind === 'pdf' ? 'application/pdf' : 'text/plain',
      sizeBytes: file.size,
      pageCount: pages.length,
      chunkCount: chunks.length,
    });

    void this.index(document, chunks);
    return document;
  }

  private async index(
    document: DocumentSummary,
    chunks: TextChunk[],
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      for (let i = 0; i < chunks.length; i += INDEX_BATCH_SIZE) {
        const batch = chunks.slice(i, i + INDEX_BATCH_SIZE);
        // A short title prefix improves retrieval for generic chunks ("Section 4.2 ...").
        const { vectors } = await this.openai.embed(
          batch.map(
            (c) => `${document.name} (page ${c.pageNumber})\n${c.content}`,
          ),
        );
        await this.documents.insertChunks(
          batch.map((chunk, j) => ({
            document_id: document.id,
            document_name: document.name,
            chunk_index: chunk.chunkIndex,
            page_number: chunk.pageNumber,
            content: chunk.content,
            embedding: vectors[j],
          })),
          i + batch.length,
        );
      }
      await this.documents.updateStatus(document.id, 'ready', {
        indexed_chunks: chunks.length,
        error_message: null,
      });
      this.logger.log(
        `Indexed "${document.name}" (${chunks.length} chunks) in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      if (error instanceof DocumentGoneError) {
        this.logger.warn(
          `Document ${document.id} was deleted during indexing; stopped.`,
        );
        return;
      }
      this.logger.error(
        `Indexing failed for ${document.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.documents
        .updateStatus(document.id, 'failed', {
          error_message:
            'Indexing failed. Delete the document and try uploading it again.',
        })
        .catch(() => undefined);
    }
  }
}
