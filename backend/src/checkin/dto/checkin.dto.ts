import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum StudyStageEnum {
  NOT_STARTED = 'NOT_STARTED',
  CHOOSING = 'CHOOSING',
  BASIC = 'BASIC',
  STRENGTHENING = 'STRENGTHENING',
  SPRINT = 'SPRINT',
  EXAM_DONE = 'EXAM_DONE',
  REEXAM_PREP = 'REEXAM_PREP',
  ADJUSTING = 'ADJUSTING',
  FINISHED = 'FINISHED',
}

export class SubmitCheckInDto {
  @ApiProperty({ enum: StudyStageEnum, description: '当前核心流程节点(必填)' })
  @IsEnum(StudyStageEnum)
  stage: StudyStageEnum;

  @ApiProperty({ type: [String], description: '本周核心完成事项(必填,勾选项)' })
  @IsOptional()
  completedItems?: string[];

  @ApiProperty({ description: '本周遇到的主要备考困难(必填)' })
  @IsString()
  difficulties: string;

  // 以下为选填项
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  studyHours?: number;

  @ApiProperty({ required: false, description: '模考分数 {politics,english,math,major}' })
  @IsOptional()
  @IsObject()
  mockScore?: Record<string, number>;

  @ApiProperty({ required: false, description: '公共课进度百分比 0-100' })
  @IsOptional()
  @Type(() => Number)
  progressPublic?: number;

  @ApiProperty({ required: false, description: '专业课进度百分比 0-100' })
  @IsOptional()
  @Type(() => Number)
  progressMajor?: number;

  @ApiProperty({ required: false, description: '目标院校/专业是否调整' })
  @IsOptional()
  @IsBoolean()
  targetSchoolChanged?: boolean;

  @ApiProperty({ required: false, description: '是否完成考研网上确认' })
  @IsOptional()
  @IsBoolean()
  onlineConfirmationCompleted?: boolean;
}

export class MakeupApplicationDto {
  @ApiProperty({ description: '补卡对应的周次(周一日期 ISO)' })
  @IsString()
  weekStart: string;

  @ApiProperty({ description: '补卡原因说明' })
  @IsString()
  reason: string;
}

export class ApproveMakeupDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsString()
  status: 'APPROVED' | 'REJECTED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CheckInFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  studentId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  classId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  majorId?: number;

  @ApiProperty({ required: false, description: '周次键 YYYY-Www' })
  @IsOptional()
  @IsString()
  weekKey?: string;

  @ApiProperty({ required: false, enum: ['ON_TIME', 'LATE', 'MISSING'] })
  @IsOptional()
  @IsString()
  status?: 'ON_TIME' | 'LATE' | 'MISSING';

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
