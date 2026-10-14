import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 操作日志服务:全量操作留痕,可追溯、可审计。
 */
@Injectable()
export class OperationLogService {
  private readonly logger = new Logger(OperationLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: number,
    action: string,
    target?: string,
    detail?: unknown,
    ip?: string,
  ) {
    try {
      const detailStr = detail == null ? undefined : JSON.stringify(detail);
      return await this.prisma.operationLog.create({
        data: { userId, action, target, detail: detailStr, ip },
      });
    } catch (e) {
      // 日志失败不应中断业务
      this.logger.error(`操作日志写入失败: ${action} ${e?.message ?? ''}`);
      return null;
    }
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    userId?: number;
    action?: string;
    startTime?: Date;
    endTime?: Date;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = { contains: params.action };
    if (params.startTime || params.endTime) {
      where.createdAt = {};
      if (params.startTime) where.createdAt.gte = params.startTime;
      if (params.endTime) where.createdAt.lte = params.endTime;
    }
    const [total, items] = await Promise.all([
      this.prisma.operationLog.count({ where }),
      this.prisma.operationLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, username: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }
}
