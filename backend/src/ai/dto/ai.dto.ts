import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum SchoolTierEnum {
  NINE_EIGHT_FIVE = 'NINE_EIGHT_FIVE',
  TWO_ONE_ONE = 'TWO_ONE_ONE',
  DOUBLE_FIRST = 'DOUBLE_FIRST',
  DOUBLE_NON = 'DOUBLE_NON',
}

export class AiRecommendInputDto {
  @ApiProperty({ description: '本科专业' })
  @IsString()
  undergraduateMajor: string;

  @ApiProperty({ required: false, description: '绩点' })
  @IsOptional()
  @Type(() => Number)
  gpa?: number;

  @ApiProperty({ required: false, description: '专业排名 e.g. 5/60' })
  @IsOptional()
  @IsString()
  majorRank?: string;

  @ApiProperty({ required: false, description: '意向地区' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ required: false, enum: SchoolTierEnum, description: '院校层次偏好' })
  @IsOptional()
  @IsEnum(SchoolTierEnum)
  schoolTierPref?: SchoolTierEnum;

  @ApiProperty({ required: false, description: '备考剩余时长(月)' })
  @IsOptional()
  @Type(() => Number)
  remainingMonths?: number;

  @ApiProperty({ required: false, type: [String], description: '优势科目' })
  @IsOptional()
  @IsArray()
  strongSubjects?: string[];

  @ApiProperty({ required: false, type: [String], description: '弱势科目' })
  @IsOptional()
  @IsArray()
  weakSubjects?: string[];

  @ApiProperty({ required: false, description: '未来就业意向' })
  @IsOptional()
  @IsString()
  careerIntention?: string;

  @ApiProperty({ required: false, description: '目标专业(可选,缩小范围)' })
  @IsOptional()
  @IsString()
  targetMajor?: string;
}

export class MentorFeedbackDto {
  @ApiProperty({ description: '校准的推荐项 ID' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: '导师评语' })
  @IsString()
  comment: string;
}
