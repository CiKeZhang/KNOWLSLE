import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WeekUtil, dayjs } from '../common/utils/week.util';
import { AlertType, AlertStatus, CheckInStatus, HelpStatus, HelpType } from '../common/enums';

@Injectable()
export class MentorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 考研进度全景看板:
   * - 全院/年级/班级/专业多维度数据总览
   * - 进度分布饼图、阶段变化趋势、院校层次分布、初试通过率、上岸率
   */
  async dashboard(params: {
    mentorId: number;
    role: string;
    classId?: number;
    majorId?: number;
    departmentId?: number;
  }) {
    const studentWhere = await this.buildStudentScope(params);
    const students = await this.prisma.user.findMany({
      where: studentWhere,
      select: {
        id: true,
        majorName: true,
        class: { select: { name: true } },
        major: { select: { name: true } },
        studentProfile: { select: { currentStage: true } },
        progressArchive: { select: { finalResult: true, targetSchoolName: true, examTotal: true } },
      },
    });
    const total = students.length;

    // 阶段分布
    const stageDistribution: Record<string, number> = {};
    // 院校层次分布
    const tierDistribution: Record<string, number> = {};
    // 按专业统计
    const majorMap = new Map<string, { major: string; total: number }>();
    // 初试通过率/上岸率
    let examPassCount = 0;
    let admittedCount = 0;

    const allSchools = await this.prisma.school.findMany({
      select: { id: true, name: true, tier: true },
    });
    const schoolMap = new Map(allSchools.map((s) => [s.name, s.tier]));

    for (const s of students) {
      const stage = s.studentProfile?.currentStage ?? 'NOT_STARTED';
      stageDistribution[stage] = (stageDistribution[stage] ?? 0) + 1;
      const majorName = s.majorName ?? '未分配专业';
      const m = majorMap.get(majorName) ?? { major: majorName, total: 0 };
      m.total += 1;
      majorMap.set(majorName, m);
      const schoolName = s.progressArchive?.targetSchoolName;
      if (schoolName) {
        const tier = schoolMap.get(schoolName) ?? 'DOUBLE_NON';
        tierDistribution[tier] = (tierDistribution[tier] ?? 0) + 1;
      }
      if (s.progressArchive?.examTotal && s.progressArchive.examTotal >= 250) examPassCount++;
      if (s.progressArchive?.finalResult === 'ADMITTED') admittedCount++;
    }

    // 周度打卡统计
    const weekStart = WeekUtil.weekStart();
    const studentIds = students.map((s) => s.id);
    const checkedIn = await this.prisma.checkInRecord.count({
      where: {
        studentId: { in: studentIds },
        weekStart,
        status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] },
      },
    });

    // 按专业统计本周打卡情况
    const checkedRecords = await this.prisma.checkInRecord.findMany({
      where: {
        studentId: { in: studentIds },
        weekStart,
        status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] },
      },
      select: { studentId: true },
    });
    const checkedSet = new Set(checkedRecords.map((r) => r.studentId));
    const majorChecked = new Map<string, number>();
    for (const s of students) {
      const majorName = s.majorName ?? '未分配专业';
      if (checkedSet.has(s.id)) {
        majorChecked.set(majorName, (majorChecked.get(majorName) ?? 0) + 1);
      }
    }
    const majorStats = Array.from(majorMap.values()).map((m) => {
      const checked = majorChecked.get(m.major) ?? 0;
      return {
        major: m.major,
        total: m.total,
        checkedIn: checked,
        checkinRate: m.total === 0 ? 0 : Math.round((checked / m.total) * 1000) / 10,
      };
    }).sort((a, b) => b.total - a.total);

    // 近 12 周阶段变化趋势(每阶段人数变化)
    const since = dayjs(weekStart).subtract(11, 'week').toDate();
    const recentCheckins = await this.prisma.checkInRecord.findMany({
      where: { studentId: { in: studentIds }, weekStart: { gte: since } },
      select: { weekStart: true, stage: true },
    });
    const stageTrend: Array<{ weekKey: string; stages: Record<string, number> }> = [];
    for (let i = 11; i >= 0; i--) {
      const ws = dayjs(weekStart).subtract(i, 'week').toDate();
      const items = recentCheckins.filter((r) => dayjs(r.weekStart).isSame(ws, 'day'));
      const stages: Record<string, number> = {};
      for (const it of items) {
        if (it.stage) {
          stages[it.stage] = (stages[it.stage] ?? 0) + 1;
        }
      }
      stageTrend.push({ weekKey: WeekUtil.weekKey(ws), stages });
    }

    return {
      total,
      stageDistribution,
      tierDistribution,
      majorStats,
      checkinRate: total === 0 ? 0 : Math.round((checkedIn / total) * 1000) / 10,
      examPassRate: total === 0 ? 0 : Math.round((examPassCount / total) * 1000) / 10,
      admittedRate: total === 0 ? 0 : Math.round((admittedCount / total) * 1000) / 10,
      stageTrend,
    };
  }

  /** 多条件筛选学生列表 */
  async listStudents(params: {
    mentorId: number;
    role: string;
    classId?: number;
    majorId?: number;
    stage?: string;
    region?: string;
    minScore?: number;
    maxScore?: number;
    checkinStatus?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const studentWhere = await this.buildStudentScope(params);
    if (params.classId) studentWhere.classId = params.classId;
    if (params.majorId) studentWhere.majorId = params.majorId;
    if (params.stage) {
      studentWhere.studentProfile = { currentStage: params.stage as any };
    }
    if (params.keyword) {
      studentWhere.OR = [
        { name: { contains: params.keyword } },
        { username: { contains: params.keyword } },
        { studentNo: { contains: params.keyword } },
      ];
    }

    const weekStart = WeekUtil.weekStart();
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where: studentWhere }),
      this.prisma.user.findMany({
        where: studentWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'asc' },
        include: {
          class: { select: { name: true } },
          major: { select: { name: true } },
          studentProfile: true,
          progressArchive: { select: { targetSchoolName: true, examTotal: true, publicCourseProgress: true, majorCourseProgress: true } },
        },
      }),
    ]);

    // 关联本周打卡状态
    const ids = items.map((u) => u.id);
    const checkins = await this.prisma.checkInRecord.findMany({
      where: { studentId: { in: ids }, weekStart },
      select: { studentId: true, status: true },
    });
    const checkinMap = new Map(checkins.map((c) => [c.studentId, c.status]));

    // 过滤打卡状态
    let result = items.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...rest } = u as any;
      return {
        ...rest,
        thisWeekCheckin: checkinMap.get(u.id) ?? 'MISSING',
      };
    });
    if (params.checkinStatus) {
      result = result.filter((r) => r.thisWeekCheckin === params.checkinStatus);
    }
    // 分数段过滤
    if (params.minScore !== undefined) {
      result = result.filter((r) => (r.progressArchive?.examTotal ?? 0) >= params.minScore!);
    }
    if (params.maxScore !== undefined) {
      result = result.filter((r) => (r.progressArchive?.examTotal ?? 0) <= params.maxScore!);
    }

    return { total, page, pageSize, items: result };
  }

  /** 异常预警列表(管辖范围内) */
  async alerts(params: {
    mentorId: number;
    role: string;
    status?: string;
    type?: string;
  }) {
    const studentWhere = await this.buildStudentScope(params);
    const studentIds = (
      await this.prisma.user.findMany({ where: studentWhere, select: { id: true } })
    ).map((u) => u.id);
    const where: Record<string, unknown> = { studentId: { in: studentIds } };
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    const items = await this.prisma.alert.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            class: { select: { name: true } },
            major: { select: { name: true } },
          },
        },
      },
    });
    return items;
  }

  /** 处理预警(标记已处理) */
  async handleAlert(alertId: number, mentorId: number) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { status: AlertStatus.RESOLVED, handledBy: mentorId, handledAt: new Date() },
    });
  }

  /** 标记重点关注学生 */
  async watchStudent(studentId: number, mentorId: number, note?: string) {
    return this.prisma.watchedStudent.upsert({
      where: { studentId_mentorId: { studentId, mentorId } },
      update: { note, pinned: true },
      create: { studentId, mentorId, note, pinned: true },
    });
  }

  /** 取消关注 */
  async unwatchStudent(studentId: number, mentorId: number) {
    await this.prisma.watchedStudent.delete({
      where: { studentId_mentorId: { studentId, mentorId } },
    }).catch(() => undefined);
    return { ok: true };
  }

  /** 重点关注学生列表 */
  async listWatched(mentorId: number) {
    return this.prisma.watchedStudent.findMany({
      where: { mentorId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        student: {
          select: {
            id: true,
            name: true,
            username: true,
            class: { select: { name: true } },
            studentProfile: { select: { currentStage: true } },
          },
        },
      },
    });
  }

  /** 帮扶申请列表 */
  async listHelpApplications(params: {
    mentorId: number;
    role: string;
    status?: HelpStatus;
    type?: HelpType;
  }) {
    const studentWhere = await this.buildStudentScope(params);
    const studentIds = (
      await this.prisma.user.findMany({ where: studentWhere, select: { id: true } })
    ).map((u) => u.id);
    const where: Record<string, unknown> = { studentId: { in: studentIds } };
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    // 已分配给我的优先
    const items = await this.prisma.helpApplication.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        student: { select: { id: true, name: true, class: { select: { name: true } } } },
        records: true,
      },
    });
    return items;
  }

  /** 接受帮扶申请(分配给自己) */
  async assignHelp(applicationId: number, mentorId: number) {
    return this.prisma.helpApplication.update({
      where: { id: applicationId },
      data: { status: HelpStatus.IN_PROGRESS, assigneeId: mentorId },
    });
  }

  /** 完成帮扶:记录帮扶内容 */
  async recordHelp(applicationId: number, mentorId: number, content: string, effect?: string) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.helpRecord.create({
        data: { applicationId, mentorId, content, effect },
      });
      await tx.helpApplication.update({
        where: { id: applicationId },
        data: { status: HelpStatus.RESOLVED },
      });
      return record;
    });
  }

  /** 一键批量发送提醒通知(多通道:站内信+企业微信+短信) */
  async batchNotify(studentIds: number[], title: string, content: string, fromMentorId: number) {
    const result = await this.notifications.dispatch(studentIds, { title, content });
    await this.opLog.record(fromMentorId, 'batch_notify', 'students', {
      count: studentIds.length,
      title,
    });
    return result;
  }

  /** 构建导师管辖范围的学生筛选条件(权限隔离) */
  private async buildStudentScope(params: {
    mentorId: number;
    role: string;
    classId?: number;
    majorId?: number;
    departmentId?: number;
  }): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { role: 'STUDENT', status: 'ACTIVE' };
    if (params.role === 'COUNSELOR') {
      where.OR = [
        { class: { counselorId: params.mentorId } },
        ...(params.classId ? [{ classId: params.classId }] : []),
      ];
    } else if (params.role === 'MAJOR_MENTOR') {
      // 专业导师:负责专业(majorName 优先;兼容 majorId)
      let majorName: string | undefined;
      const me = await this.prisma.user.findUnique({
        where: { id: params.mentorId },
        select: { majorName: true, majorId: true },
      });
      majorName = me?.majorName ?? undefined;
      if (majorName) where.majorName = majorName;
      else if (me?.majorId) where.majorId = me.majorId;
    } else if (params.role === 'ACADEMIC_ADMIN' || params.role === 'SYS_ADMIN') {
      // 学院管理员/系统管理员:看全院所有学生
      if (params.departmentId) where.departmentId = params.departmentId;
      if (params.classId) where.classId = params.classId;
    }
    return where;
  }
}
