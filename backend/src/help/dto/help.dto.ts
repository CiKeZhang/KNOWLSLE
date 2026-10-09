import { IsString, IsOptional, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum HelpTypeEnum {
  SCHOOL_CHOICE = 'SCHOOL_CHOICE',
  SUBJECT_BOTTLENECK = 'SUBJECT_BOTTLENECK',
  MENTAL_STATE = 'MENTAL_STATE',
  REEXAM_GUIDE = 'REEXAM_GUIDE',
  OTHER = 'OTHER',
}

export class ApplyHelpDto {
  @ApiProperty({ enum: HelpTypeEnum })
  @IsEnum(HelpTypeEnum)
  type: HelpTypeEnum;

  @ApiProperty({ description: '帮扶内容描述' })
  @IsString()
  content: string;

  @ApiProperty({ required: false, enum: ['COUNSELOR', 'MAJOR_MENTOR'], description: '期望对接角色' })
  @IsOptional()
  @IsString()
  preferredRole?: 'COUNSELOR' | 'MAJOR_MENTOR';
}

export class ApplyFromCheckInDto {
  @ApiProperty({ description: '打卡记录 ID' })
  @IsInt()
  @Type(() => Number)
  checkInId: number;

  @ApiProperty({ required: false, enum: HelpTypeEnum })
  @IsOptional()
  @IsEnum(HelpTypeEnum)
  type?: HelpTypeEnum;

  @ApiProperty({ required: false, description: '补充说明' })
  @IsOptional()
  @IsString()
  extraContent?: string;
}
