import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { DocumentsService } from './documents.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { IngestionService } from './ingestion/ingestion.service';
import { ChatEvent, DocumentSummary } from './rag.types';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Controller('rag')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(
    private readonly chat: ChatService,
    private readonly documents: DocumentsService,
    private readonly ingestion: IngestionService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
    }),
  )
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentSummary> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Attach a PDF, .txt or .md file in the "file" field.',
      );
    }
    return this.ingestion.ingest(file);
  }

  @Get('documents')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  listDocuments(): Promise<DocumentSummary[]> {
    return this.documents.list();
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.documents.remove(id);
  }

  /**
   * Streams Server-Sent Events:
   *   event: status  {stage}
   *   event: token   {text}
   *   event: done    {mode, sources, usage, latencyMs, guardrail?}  <- metadata footer
   *   event: error   {message}
   */
  @Post('chat')
  async streamChat(
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.socket?.setNoDelay(true);

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    try {
      for await (const event of this.chat.answer(dto, abort.signal)) {
        if (abort.signal.aborted) break;
        writeEvent(res, event);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        this.logger.error(
          `Chat pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        writeEvent(res, {
          event: 'error',
          data: {
            message: 'Something went wrong while answering. Please try again.',
          },
        });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
}

function writeEvent(res: Response, { event, data }: ChatEvent): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
