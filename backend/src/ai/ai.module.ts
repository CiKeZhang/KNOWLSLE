import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiDifficultyService } from './services/ai-difficulty.service';

@Module({
  providers: [AiService, AiDifficultyService],
  controllers: [AiController],
  exports: [AiService, AiDifficultyService],
})
export class AiModule {}
