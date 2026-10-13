import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { WeekUtil } from '../common/utils/week.util';
import { dayjs } from '../common/utils/week.util';
import { SubmitCheckInDto, MakeupApplicationDto, ApproveMakeupDto, CheckInFilterDto } from './dto/checkin.dto';
import { CheckInStatus, StudyStage, AlertType, AlertStatus, ApprovalStatus } from '../common/enums';

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 获取当前周打卡规则(若未配置则返回默认) */
  async getRule() {
    const rule = await this.prisma.checkInRule.findFirst({
      where: { enabled: true },
      orderBy: { id: 'asc' },
    });
    return (
      rule ?? {
        id: 0,
        period: 'WEEKLY',
        weekStartDay: 1,
        startAt: '00:00',
        endAt: '23:59',
        fridayRemindAt: '18:00',
        sundayAlertAt: '20:00',
        requireStage: true,
        requireCompletedItems: true,
        requireDifficulties: true,
        makeupEnabled: true,
        makeupValidDays: 3,
        makeupApproverRole: 'COUNSELOR',
        enabled: true,
      }
    );
  }

  /** 学生:获取本周打卡状态 */
  async getMyWeekStatus(studentId: number) {
    const rule = await this.getRule();
    const weekStart = WeekUtil.weekStart();
    const weekEnd = WeekUtil.weekEnd();
    const record = await this.prisma.checkInRecord.findUnique({
      where: { studentId_weekStart: { studentId, weekStart } },
    });
    const inWindow = WeekUtil.isWithinCheckInWindow(rule);
    const pastDeadline = WeekUtil.isPastDeadline(rule);
    // 是否可补卡(本周截止后 N 天内)
    const makeupWindowEnd = dayjs(weekEnd).add(rule.makeupValidDays, 'day').toDate();
    const canMakeup = rule.makeupEnabled && dayjs().isBefore(makeupWindowEnd) && !record;

    // 历史曲线:近 12 周
    const since = dayjs(weekStart).subtract(11, 'week').toDate();
    const history = await this.prisma.checkInRecord.findMany({
      where: { studentId, weekStart: { gte: since } },
      orderBy: { weekStart: 'asc' },
    });

    // 历史补卡申请
    const pendingMakeups = await this.prisma.makeupCheckInApplication.count({
      where: { studentId, status: ApprovalStatus.PENDING },
    });

    return {
      rule,
      weekStart,
      weekEnd,
      weekKey: WeekUtil.weekKey(),
      inWindow,
      pastDeadline,
      canMakeup,
      currentRecord: record,
      history: history.map((h) => ({
        weekStart: h.weekStart,
        weekKey: WeekUtil.weekKey(h.weekStart),
        status: h.status,
        stage: h.stage,
        studyHours: Number(h.studyHours),
      })),
      pendingMakeups,
    };
  }

  /** 学生:提交本周打卡 */
  async submitMyWeek(studentId: number, dto: SubmitCheckInDto) {
    const rule = await this.getRule();
    const weekStart = WeekUtil.weekStart();
    const weekEnd = WeekUtil.weekEnd();

    // 校验是否在窗口期
    if (!WeekUtil.isWithinCheckInWindow(rule) && !rule.makeupEnabled) {
      throw new BadRequestException('当前不在打卡有效时间内');
    }

    // 已有记录检查
    const existing = await this.prisma.checkInRecord.findUnique({
      where: { studentId_weekStart: { studentId, weekStart } },
    });
    if (existing && existing.status !== CheckInStatus.MISSING) {
      throw new ConflictException('本周已打卡,如需更新请使用编辑接口');
    }

    // 必填校验
    if (rule.requireStage && !dto.stage) {
      throw new BadRequestException('请选择当前核心流程节点');
    }
    if (rule.requireCompletedItems && (!dto.completedItems || dto.completedItems.length === 0)) {
      throw new BadRequestException('请勾选本周核心完成事项');
    }
    if (rule.requireDifficulties && !dto.difficulties?.trim()) {
      throw new BadRequestException('请填写本周遇到的主要备考困难');
    }

    const now = new Date();
    const isLate = dayjs(now).isAfter(dayjs(weekEnd).subtract(1, 'hour'));
    const status = isLate ? CheckInStatus.LATE : CheckInStatus.ON_TIME;

    // 事务:创建打卡记录 + 同步更新进度档案 + 写进度历史
    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.checkInRecord.upsert({
        where: { studentId_weekStart: { studentId, weekStart } },
        update: {
          submittedAt: now,
          status,
          stage: dto.stage as StudyStage,
          completedItems: dto.completedItems ?? [],
          difficulties: dto.difficulties,
          studyHours: dto.studyHours,
          mockScore: dto.mockScore,
          progressPublic: dto.progressPublic,
          progressMajor: dto.progressMajor,
          targetSchoolChanged: dto.targetSchoolChanged ?? false,
          onlineConfirmationCompleted: dto.onlineConfirmationCompleted ?? false,
          source: 'regular',
        },
        create: {
          studentId,
          weekStart,
          weekEnd,
          submittedAt: now,
          status,
          stage: dto.stage as StudyStage,
          completedItems: dto.completedItems ?? [],
          difficulties: dto.difficulties,
          studyHours: dto.studyHours,
          mockScore: dto.mockScore,
          progressPublic: dto.progressPublic,
          progressMajor: dto.progressMajor,
          targetSchoolChanged: dto.targetSchoolChanged ?? false,
          onlineConfirmationCompleted: dto.onlineConfirmationCompleted ?? false,
          source: 'regular',
        },
      });

      // 同步进度档案(自动联动,无需重复填报)
      if (dto.stage) {
        await tx.studentProfile.update({
          where: { userId: studentId },
          data: { currentStage: dto.stage as StudyStage },
        });
        await tx.progressArchive.update({
          where: { studentId },
          data: {
            publicCourseProgress: dto.progressPublic ?? undefined,
            majorCourseProgress: dto.progressMajor ?? undefined,
            mockScores: dto.mockScore ?? undefined,
          },
        });
        // 写进度历史轨迹
        await tx.progressHistory.create({
          data: {
            studentId,
            stage: dto.stage as StudyStage,
            snapshot: {
              weekStart: weekStart.toISOString(),
              studyHours: dto.studyHours,
              progressPublic: dto.progressPublic,
              progressMajor: dto.progressMajor,
            },
          },
        });
      }

      return record;
    });

    // 打卡后清除该生本周逾期预警
    await this.prisma.alert.updateMany({
      where: {
        studentId,
        type: { in: [AlertType.CHECKIN_MISSING, AlertType.CHECKIN_CONSECUTIVE] },
        status: AlertStatus.OPEN,
      },
      data: { status: AlertStatus.HANDLED, handledAt: now },
    });

    await this.opLog.record(studentId, 'submit_checkin', `week:${WeekUtil.weekKey()}`, {
      stage: dto.stage,
    });
    return result;
  }

  /** 学生:申请补卡 */
  async applyMakeup(studentId: number, dto: MakeupApplicationDto) {
    const rule = await this.getRule();
    if (!rule.makeupEnabled) {
      throw new BadRequestException('系统已关闭补卡功能');
    }
    const weekStart = new Date(dto.weekStart);
    if (isNaN(weekStart.getTime())) {
      throw new BadRequestException('weekStart 格式错误');
    }
    // 检查目标周是否已有记录
    const existing = await this.prisma.checkInRecord.findUnique({
      where: { studentId_weekStart: { studentId, weekStart } },
    });
    if (existing && existing.status !== CheckInStatus.MISSING) {
      throw new ConflictException('该周已有有效打卡记录');
    }
    // 是否在补卡有效期内
    const weekEnd = WeekUtil.weekEnd(weekStart);
    const makeupDeadline = dayjs(weekEnd).add(rule.makeupValidDays, 'day').toDate();
    if (dayjs().isAfter(makeupDeadline)) {
      throw new BadRequestException(
        `已超过补卡有效期(截止 ${makeupDeadline.toLocaleString('zh-CN')})`,
      );
    }
    // 是否已有该周补卡申请 pending
    const dup = await this.prisma.makeupCheckInApplication.findFirst({
      where: { studentId, weekStart, status: ApprovalStatus.PENDING },
    });
    if (dup) throw new ConflictException('该周已有待审批的补卡申请');

    return this.prisma.makeupCheckInApplication.create({
      data: {
        studentId,
        weekStart,
        reason: dto.reason,
        status: ApprovalStatus.PENDING,
      },
    });
  }

  /** 导师/管理员:审批补卡申请 */
  async approveMakeup(
    applicationId: number,
    approverId: number,
    dto: ApproveMakeupDto,
  ) {
    const app = await this.prisma.makeupCheckInApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('补卡申请不存在');
    if (app.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('该申请已处理');
    }
    if (dto.status === ApprovalStatus.APPROVED) {
      // 同步为补卡记录(状态 LATE)
      const weekEnd = WeekUtil.weekEnd(app.weekStart);
      await this.prisma.$transaction(async (tx) => {
        await tx.checkInRecord.upsert({
          where: { studentId_weekStart: { studentId: app.studentId, weekStart: app.weekStart } },
          update: {
            submittedAt: new Date(),
            status: CheckInStatus.LATE,
            source: 'makeup',
          },
          create: {
            studentId: app.studentId,
            weekStart: app.weekStart,
            weekEnd,
            submittedAt: new Date(),
            status: CheckInStatus.LATE,
            source: 'makeup',
          },
        });
        await tx.makeupCheckInApplication.update({
          where: { id: applicationId },
          data: {
            status: ApprovalStatus.APPROVED,
            approverId,
            approverComment: dto.comment,
            handledAt: new Date(),
          },
        });
      });
    } else {
      await this.prisma.makeupCheckInApplication.update({
        where: { id: applicationId },
        data: {
          status: ApprovalStatus.REJECTED,
          approverId,
          approverComment: dto.comment,
          handledAt: new Date(),
        },
      });
    }
    await this.opLog.record(approverId, 'approve_makeup', `app:${applicationId}`, dto);
    return { ok: true };
  }

  /** 学生:我的打卡历史 */
  async myHistory(studentId: number, limit = 52) {
    const records = await this.prisma.checkInRecord.findMany({
      where: { studentId },
      orderBy: { weekStart: 'desc' },
      take: limit,
    });
    const calendar = records.map((r) => ({
      weekStart: r.weekStart,
      weekKey: WeekUtil.weekKey(r.weekStart),
      status: r.status,
      stage: r.stage,
      studyHours: Number(r.studyHours),
    }));
    // 连续打卡次数(从最近一次往前数)
    let streak = 0;
    for (const r of records) {
      if (r.status === CheckInStatus.ON_TIME || r.status === CheckInStatus.LATE) {
        streak++;
      } else {
        break;
      }
    }
    const makeupApplications = await this.prisma.makeupCheckInApplication.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { calendar, streak, makeupApplications };
  }

  /** 导师端:打卡统计(管辖范围内) */
  async statsForMentor(params: {
    mentorId: number;
    role: string;
    classId?: number;
    majorId?: number;
    weekStart?: Date;
  }) {
    const weekStart = params.weekStart ?? WeekUtil.weekStart();
    const weekEnd = WeekUtil.weekEnd(weekStart);

    // 确定管辖范围:辅导员->所带班级;专业导师->所负责专业;管理员->全院
    const studentWhere: Record<string, unknown> = { role: 'STUDENT', status: 'ACTIVE' };
    if (params.role === 'COUNSELOR') {
      const classes = await this.prisma.class.findMany({
        where: { counselorId: params.mentorId },
        select: { id: true },
      });
      studentWhere.classId = { in: classes.map((c) => c.id) };
    } else if (params.role === 'MAJOR_MENTOR') {
      const me = await this.prisma.user.findUnique({
        where: { id: params.mentorId },
        select: { majorId: true },
      });
      studentWhere.majorId = me?.majorId;
    }
    if (params.classId) studentWhere.classId = params.classId;
    if (params.majorId) studentWhere.majorId = params.majorId;

    const totalStudents = await this.prisma.user.count({ where: studentWhere });

    const checkedIn = await this.prisma.checkInRecord.count({
      where: {
        studentId: { in: (await this.prisma.user.findMany({ where: studentWhere, select: { id: true } })).map((u) => u.id) },
        weekStart,
        status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] },
      },
    });

    // 连续打卡人数:本周 ON_TIME/LATE 且 上周也完成
    const thisWeekIds = (
      await this.prisma.checkInRecord.findMany({
        where: {
          weekStart,
          status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] },
        },
        select: { studentId: true },
      })
    ).map((r) => r.studentId);
    const lastWeekStart = WeekUtil.lastWeekStart(weekStart);
    const streakCount = await this.prisma.checkInRecord.count({
      where: {
        studentId: { in: thisWeekIds },
        weekStart: lastWeekStart,
        status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] },
      },
    });

    const missing = totalStudents - checkedIn;
    const rate = totalStudents === 0 ? 0 : Math.round((checkedIn / totalStudents) * 1000) / 10;

    // 近 12 周趋势
    const since = dayjs(weekStart).subtract(11, 'week').toDate();
    const trendRecords = await this.prisma.checkInRecord.findMany({
      where: { weekStart: { gte: since, lte: weekStart } },
      select: { weekStart: true, status: true },
    });
    const trend: Array<{ weekKey: string; onTime: number; late: number; missing: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const ws = dayjs(weekStart).subtract(i, 'week').toDate();
      const we = dayjs(ws).add(6, 'day').endOf('day').toDate();
      const items = trendRecords.filter(
        (r) => r.weekStart >= ws && r.weekStart <= we,
      );
      trend.push({
        weekKey: WeekUtil.weekKey(ws),
        onTime: items.filter((r) => r.status === CheckInStatus.ON_TIME).length,
        late: items.filter((r) => r.status === CheckInStatus.LATE).length,
        missing: Math.max(0, totalStudents - items.length),
      });
    }

    return {
      weekStart,
      weekEnd,
      weekKey: WeekUtil.weekKey(weekStart),
      totalStudents,
      checkedIn,
      missing,
      streakCount,
      rate,
      trend,
    };
  }

  /** 列出本周未打卡学生(导师批量提醒使用) */
  async listMissingThisWeek(params: {
    mentorId: number;
    role: string;
    classId?: number;
    majorId?: number;
  }) {
    const weekStart = WeekUtil.weekStart();
    const studentWhere: Record<string, unknown> = { role: 'STUDENT', status: 'ACTIVE' };
    if (params.role === 'COUNSELOR') {
      const classes = await this.prisma.class.findMany({
        where: { counselorId: params.mentorId },
        select: { id: true },
      });
      studentWhere.classId = { in: classes.map((c) => c.id) };
    } else if (params.role === 'MAJOR_MENTOR') {
      const me = await this.prisma.user.findUnique({
        where: { id: params.mentorId },
        select: { majorId: true },
      });
      studentWhere.majorId = me?.majorId;
    }
    if (params.classId) studentWhere.classId = params.classId;
    if (params.majorId) studentWhere.majorId = params.majorId;

    const students = await this.prisma.user.findMany({
      where: studentWhere,
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        class: { select: { name: true } },
        major: { select: { name: true } },
      },
    });
    const records = await this.prisma.checkInRecord.findMany({
      where: { weekStart, studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true, status: true },
    });
    const checkedIds = new Set(
      records
        .filter((r) => r.status === CheckInStatus.ON_TIME || r.status === CheckInStatus.LATE)
        .map((r) => r.studentId),
    );
    return students.filter((s) => !checkedIds.has(s.id));
  }

  /** 列出补卡申请(导师审批使用) */
  async listMakeupApplications(params: {
    approverId: number;
    role: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    // 权限过滤:仅能看到管辖范围内的学生申请
    const studentWhere: Record<string, unknown> = { role: 'STUDENT' };
    if (params.role === 'COUNSELOR') {
      const classes = await this.prisma.class.findMany({
        where: { counselorId: params.approverId },
        select: { id: true },
      });
      studentWhere.classId = { in: classes.map((c) => c.id) };
    } else if (params.role === 'MAJOR_MENTOR') {
      const me = await this.prisma.user.findUnique({
        where: { id: params.approverId },
        select: { majorId: true },
      });
      studentWhere.majorId = me?.majorId;
    }
    const studentIds = (
      await this.prisma.user.findMany({ where: studentWhere, select: { id: true } })
    ).map((u) => u.id);
    where.studentId = { in: studentIds };
    return this.prisma.makeupCheckInApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        student: {
          select: { id: true, name: true, username: true, class: { select: { name: true } } },
        },
      },
    });
  }

  /** 获取打卡记录列表(导师查看学生详情时使用) */
  async listByStudent(studentId: number, limit = 52) {
    return this.prisma.checkInRecord.findMany({
      where: { studentId },
      orderBy: { weekStart: 'desc' },
      take: limit,
    });
  }
}
