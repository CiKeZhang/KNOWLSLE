import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { HelpType, HelpStatus, UserRole } from '../common/enums';

@Injectable()
export class HelpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 学生:提交帮扶申请 */
  async apply(
    studentId: number,
    type: HelpType,
    content: string,
    preferredRole?: UserRole,
    fromCheckInId?: number,
  ) {
    if (!content?.trim()) {
      throw new BadRequestException('请填写帮扶内容');
    }
    return this.prisma.helpApplication.create({
      data: {
        studentId,
        type,
        content,
        status: HelpStatus.OPEN,
        preferredRole,
        fromCheckInId,
      },
    });
  }

  /** 学生:从打卡困难一键转化为帮扶申请 */
  async applyFromCheckIn(
    studentId: number,
    checkInId: number,
    type: HelpType = HelpType.OTHER,
    extraContent?: string,
  ) {
    const checkin = await this.prisma.checkInRecord.findUnique({
      where: { id: checkInId },
    });
    if (!checkin || checkin.studentId !== studentId) {
      throw new BadRequestException('打卡记录不存在或不属于本人');
    }
    const content = extraContent
      ? `${checkin.difficulties ?? ''}\n[补充说明] ${extraContent}`
      : checkin.difficulties ?? '';
    return this.apply(studentId, type, content, undefined, checkInId);
  }

  /** 学生:我的帮扶申请列表 */
  async myApplications(studentId: number) {
    return this.prisma.helpApplication.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        records: { include: { mentor: { select: { id: true, name: true } } } },
      },
    });
  }

  /** 学生:查看某帮扶申请的对接安排与回复 */
  async detail(id: number, studentId?: number) {
    const app = await this.prisma.helpApplication.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, role: true, phone: true } },
        records: {
          orderBy: { createdAt: 'asc' },
          include: { mentor: { select: { id: true, name: true } } },
        },
      },
    });
    if (!app) throw new NotFoundException('帮扶申请不存在');
    if (studentId && app.studentId !== studentId) {
      throw new BadRequestException('无权查看该申请');
    }
    return app;
  }
}
