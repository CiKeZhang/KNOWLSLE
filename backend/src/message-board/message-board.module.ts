import { Module } from '@nestjs/common';
import { MessageBoardService } from './message-board.service';
import { MessageBoardController } from './message-board.controller';
import { ContentAuditService } from '../common/services/content-audit.service';

@Module({
  controllers: [MessageBoardController],
  providers: [MessageBoardService, ContentAuditService],
  exports: [MessageBoardService],
})
export class MessageBoardModule {}
