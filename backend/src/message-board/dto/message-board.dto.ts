import { IsString, IsBoolean, IsOptional, MaxLength, MinLength, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 发布留言 DTO */
export class CreateMessageDto {
  @ApiProperty({ description: '留言内容（纯文字）', maxLength: 500 })
  @IsString()
  @MinLength(1, { message: '留言内容不能为空' })
  @MaxLength(500, { message: '留言内容不能超过500字' })
  content: string;

  @ApiPropertyOptional({ description: '是否匿名发布', default: false })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

/** 回复留言 DTO */
export class CreateReplyDto {
  @ApiProperty({ description: '回复内容', maxLength: 300 })
  @IsString()
  @MinLength(1, { message: '回复内容不能为空' })
  @MaxLength(300, { message: '回复内容不能超过300字' })
  content: string;

  @ApiPropertyOptional({ description: '是否匿名回复', default: false })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

/** 留言列表查询 DTO */
export class MessageListDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/** AI 审核结果 */
export interface AuditResult {
  passed: boolean;
  reason?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  categories?: string[]; // 违规类别: ad/illegal/unhealthy等
}
