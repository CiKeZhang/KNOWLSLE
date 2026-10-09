import { Module } from '@nestjs/common';
import { StudyPlanService } from './study-plan.service';
import { StudyPlanController } from './study-plan.controller';

@Module({
  providers: [StudyPlanService],
  controllers: [StudyPlanController],
  exports: [StudyPlanService],
})
export class StudyPlanModule {}
