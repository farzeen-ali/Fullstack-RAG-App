import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { IntentRouterService } from './cost/intent-router.service';
import { QueryCacheService } from './cost/query-cache.service';
import { DocumentsService } from './documents.service';
import { IngestionService } from './ingestion/ingestion.service';
import { RagController } from './rag.controller';
import { PromptGuardService } from './security/prompt-guard.service';

@Module({
  controllers: [RagController],
  providers: [
    ChatService,
    DocumentsService,
    IngestionService,
    IntentRouterService,
    PromptGuardService,
    QueryCacheService,
  ],
})
export class RagModule {}
