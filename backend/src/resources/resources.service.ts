import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { ResourceType, ResourceStatus, StudyStage } from '../common/enums';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 学生:浏览已审核通过的备考资源(分专业、分阶段) */
  async list(params: {
    type?: ResourceType;
    stage?: StudyStage;
    majorName?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where: Record<string, unknown> = { status: ResourceStatus.APPROVED };
    if (params.type) where.type = params.type;
    if (params.stage) where.stage = params.stage;
    if (params.majorName) where.majorName = { contains: params.majorName };
    if (params.keyword) {
      where.OR = [
        { title: { contains: params.keyword } },
        { description: { contains: params.keyword } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { total, page, pageSize, items };
  }

  /** 上传/添加资源(导师、管理员可上传,需审核) */
  async create(data: {
    type: ResourceType;
    title: string;
    description?: string;
    url?: string;
    filePath?: string;
    stage?: StudyStage;
    majorName?: string;
  }, uploaderId: number) {
    return this.prisma.resource.create({
      data: {
        ...data,
        uploaderId,
        status: ResourceStatus.PENDING_REVIEW,
      },
    });
  }

  /** 审核资源(管理员) */
  async review(id: number, status: ResourceStatus, reviewerId: number) {
    const r = await this.prisma.resource.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('资源不存在');
    const updated = await this.prisma.resource.update({
      where: { id },
      data: { status },
    });
    await this.opLog.record(reviewerId, 'review_resource', `resource:${id}`, { status });
    return updated;
  }

  /** 下架资源 */
  async offline(id: number, operatorId: number) {
    const updated = await this.prisma.resource.update({
      where: { id },
      data: { status: ResourceStatus.OFFLINE },
    });
    await this.opLog.record(operatorId, 'offline_resource', `resource:${id}`, {});
    return updated;
  }

  /** 浏览资源(自增计数) */
  async view(id: number) {
    await this.prisma.resource.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return this.prisma.resource.findUnique({ where: { id } });
  }

  /** 后台:待审核资源列表 */
  async listForReview() {
    return this.prisma.resource.findMany({
      where: { status: ResourceStatus.PENDING_REVIEW },
      orderBy: { createdAt: 'desc' },
      include: { uploader: { select: { id: true, name: true } } },
    });
  }
}
