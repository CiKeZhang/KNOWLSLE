import { IsString, IsOptional, IsNumber, IsObject, IsEnum } from 'class-validator';
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

export class UpdateArchiveDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetSchoolName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetMajor?: string;

  @ApiProperty({ required: false, description: '公共课进度 0-100' })
  @IsOptional()
  @Type(() => Number)
  publicCourseProgress?: number;

  @ApiProperty({ required: false, description: '专业课进度 0-100' })
  @IsOptional()
  @Type(() => Number)
  majorCourseProgress?: number;

  @ApiProperty({ required: false, description: '模考分数对象' })
  @IsOptional()
  @IsObject()
  mockScores?: Record<string, number>;

  @ApiProperty({
    required: false,
    description: '分科细化进度 { <科目key>: { name, chapters:[{name, round}] } }, round: 0未开始/1一轮/2强化/3冲刺',
  })
  @IsOptional()
  @IsObject()
  subjectProgress?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  examTotal?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  examPolitics?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  examEnglish?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  examMath?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  examMajor?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  reexamProgress?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adjustmentProgress?: string;

  @ApiProperty({ required: false, enum: ['ADMITTED', 'NOT_ADMITTED'] })
  @IsOptional()
  @IsString()
  finalResult?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  finalSchool?: string;
}

export class UpdateStageDto {
  @ApiProperty({ enum: StudyStageEnum })
  @IsEnum(StudyStageEnum)
  stage: StudyStageEnum;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  undergraduateMajor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  gpa?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  majorRank?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false, enum: ['NINE_EIGHT_FIVE', 'TWO_ONE_ONE', 'DOUBLE_FIRST', 'DOUBLE_NON'] })
  @IsOptional()
  @IsString()
  schoolTierPref?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  strongSubjects?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  weakSubjects?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  careerIntention?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  remainingMonths?: number;
}
