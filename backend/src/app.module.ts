import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CheckInModule } from './checkin/checkin.module';
import { ProgressModule } from './progress/progress.module';
import { MentorModule } from './mentor/mentor.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { ResourcesModule } from './resources/resources.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HelpModule } from './help/help.module';
import { StudyPlanModule } from './study-plan/study-plan.module';
import { MessageBoardModule } from './message-board/message-board.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CheckInModule,
    ProgressModule,
    MentorModule,
    AdminModule,
    AiModule,
    ResourcesModule,
    ReportsModule,
    NotificationsModule,
    HelpModule,
    StudyPlanModule,
    MessageBoardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
