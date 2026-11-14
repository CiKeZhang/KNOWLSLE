import { IsString, IsOptional, IsArray, IsBoolean, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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
  // 全局 ValidationPipe 开了 whitelist;没有 ValidateNested/Type 时,
  // 嵌套任务对象的字段会被全部剥掉,保存后变成 [[],[]]
  @ValidateNested({ each: true })
  @Type(() => TaskItemDto)
  tasks: TaskItemDto[];

  @ApiProperty({ required: false, description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ToggleTaskDto {
  @ApiProperty({ description: '任务索引' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index: number;

  @ApiProperty({ description: '是否完成' })
  @IsBoolean()
  done: boolean;
}
