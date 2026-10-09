import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TaskItemDto {
  @ApiProperty({ description: '任务内容' })
  @IsString()
  task: string;

  @ApiProperty({ required: false, description: '科目' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ required: false, description: '目标时长(小时)' })
  @IsOptional()
  targetHours?: number;

  @ApiProperty({ required: false, description: '是否完成' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class UpdatePlanDto {
  @ApiProperty({ type: [TaskItemDto], description: '任务清单(支持手动调整)' })
  @IsArray()
  tasks: TaskItemDto[];

  @ApiProperty({ required: false, description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ToggleTaskDto {
  @ApiProperty({ description: '任务索引' })
  index: number;

  @ApiProperty({ description: '是否完成' })
  @IsBoolean()
  done: boolean;
}
