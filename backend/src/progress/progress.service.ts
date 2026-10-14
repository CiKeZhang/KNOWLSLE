import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { UpdateArchiveDto, UpdateStageDto, UpdateProfileDto } from './dto/progress.dto';

// 需加密存储的敏感字段(学生考研成绩、目标院校等)
const SENSITIVE_ARCHIVE_FIELDS = [
  'targetSchoolName', 'targetMajor', 'finalSchool',
];

// 敏感的初试分数字段(单独处理,因为类型是 number)
const SENSITIVE_EXAM_FIELDS = [
  'examTotal', 'examPolitics', 'examEnglish', 'examMath', 'examMajor',
];

// 阶段中文标签(用于时间线展示)
const STAGE_LABELS: Record<string, string> = {
  NOT_STARTED: '未开始备考', CHOOSING: '择校阶段', BASIC: '基础复习',
  STRENGTHENING: '强化刷题', SPRINT: '冲刺阶段', EXAM_DONE: '初试结束待成绩',
  REEXAM_PREP: '初试通过备战复试', ADJUSTING: '调剂中', FINISHED: '考研结束',
};

// 指导老师查询的字段
const ADVISOR_SELECT = { id: true, name: true, staffNo: true, phone: true, role: true };

// 分科进度:复习轮次权重(0未开始/1一轮/2强化/3冲刺)
const ROUND_MAX = 3;
// 公共课科目 key(其余视为专业课)
const PUBLIC_SUBJECT_KEYS = ['politics', 'english', 'math'];

/** 由分科章节进度聚合出每科百分比 + 公共课/专业课整体百分比 */
function summarizeSubjectProgress(sp: Record<string, any> | null | undefined) {
  if (!sp || typeof sp !== 'object') return null;
  const subjects: Record<string, { name: string; percent: number; total: number; counts: number[] }> = {};
  const keys = Object.keys(sp);
  for (const key of keys) {
    const subj = sp[key];
    const chapters = (subj && Array.isArray(subj.chapters)) ? subj.chapters : [];
    const counts = [0, 0, 0, 0];
    let weight = 0;
    for (const ch of chapters) {
      const r = Math.max(0, Math.min(ROUND_MAX, Number(ch && ch.round) || 0));
      counts[r] += 1;
      weight += r;
    }
    const percent = chapters.length === 0 ? 0 : Math.round((weight / (ROUND_MAX * chapters.length)) * 100);
    subjects[key] = { name: (subj && subj.name) || key, percent, total: chapters.length, counts };
  }
  const pctOf = (k: string) => (subjects[k] ? subjects[k].percent : null);
  const publicPcts = PUBLIC_SUBJECT_KEYS.map(pctOf).filter((v): v is number => v != null);
  const publicAvg = publicPcts.length ? Math.round(publicPcts.reduce((a, b) => a + b, 0) / publicPcts.length) : null;
  return { subjects, publicAvg, majorPercent: pctOf('major') };
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** SQLite 不支持 Prisma 的 Json 类型,数组/对象统一以 JSON 字符串存储 */
  private toJsonText(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    return JSON.stringify(value);
  }

  private parseJson<T>(text: string | null | undefined, fallback: T): T {
    if (!text) return fallback;
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      return fallback;
    }
  }

  /** 组装时间线(统一 title/desc/at 结构,供前端渲染) */
  private buildTimeline(history: any[], checkins: any[]) {
    return [
      ...history.map((h) => ({
        title: `阶段变更为「${STAGE_LABELS[h.stage] ?? h.stage}」`,
        desc: this.parseJson<{ note?: string }>(h.snapshot, {}).note ?? '',
        at: h.createdAt,
        type: 'stage_change' as const,
        stage: h.stage,
      })),
      ...checkins.map((c) => ({
        title: `${STAGE_LABELS[c.stage ?? ''] ?? '本周'}打卡`,
        desc: [
          c.difficulties,
          c.studyHours != null ? `学习 ${Number(c.studyHours)} 小时` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        at: c.weekStart,
        type: 'checkin' as const,
        stage: c.stage,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  /** 按学生的专业/班级推导指导老师:专业导师(同专业)+ 辅导员(所带班级)
   *  注:学生的专业以 majorName 字符串存储(majorId 通常为空),故优先按 majorName 匹配 */
  private async resolveAdvisors(student: {
    majorName?: string | null;
    majorId?: number | null;
    classId?: number | null;
  }) {
    const mentorWhere: Record<string, unknown> = { role: 'MAJOR_MENTOR', status: 'ACTIVE' };
    if (student.majorName) mentorWhere.majorName = student.majorName;
    else if (student.majorId) mentorWhere.majorId = student.majorId;
    const hasMajor = !!(student.majorName || student.majorId);

    const [majorMentor, klass] = await Promise.all([
      hasMajor
        ? this.prisma.user.findFirst({ where: mentorWhere, select: ADVISOR_SELECT })
        : Promise.resolve(null),
      student.classId
        ? this.prisma.class.findUnique({
            where: { id: student.classId },
            select: { name: true, counselor: { select: ADVISOR_SELECT } },
          })
        : Promise.resolve(null),
    ]);
    return {
      majorMentor: majorMentor ?? null,
      counselor: klass?.counselor ?? null,
      className: klass?.name ?? null,
    };
  }

  /** 学生:查看个人档案(含 profile + archive + 历史轨迹 + 打卡历史) */
  async getMyArchive(studentId: number) {
    const [profile, archive, history, checkins, me] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId: studentId } }),
      this.prisma.progressArchive.findUnique({ where: { studentId } }),
      this.prisma.progressHistory.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.checkInRecord.findMany({
        where: { studentId },
        orderBy: { weekStart: 'desc' },
        take: 26,
        select: {
          weekStart: true,
          status: true,
          stage: true,
          studyHours: true,
          difficulties: true,
          completedItems: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: studentId },
        select: { majorId: true, majorName: true, classId: true },
      }),
    ]);
    // 解密敏感字段(考研成绩、目标院校)
    const decryptedArchive = archive ? this.decryptArchive(archive) : null;
    // 推导指导老师(专业导师 + 辅导员)
    const advisors = await this.resolveAdvisors({
      majorName: me?.majorName,
      majorId: me?.majorId,
      classId: me?.classId,
    });
    // 组装时间线(前端按 title/desc/at 渲染)
    const timeline = this.buildTimeline(history, checkins);
    return { profile, archive: decryptedArchive, advisors, timeline };
  }

  /** 学生:更新档案详情 */
  async updateMyArchive(studentId: number, dto: UpdateArchiveDto) {
    const data: Record<string, unknown> = {};
    // PII 敏感字段加密存储(目标院校/专业/录取院校);初试分数保留 Int 以支持报表聚合查询,由 RBAC + MySQL TDE 保护
    if (dto.targetSchoolName !== undefined) data.targetSchoolName = this.encryptStr(dto.targetSchoolName);
    if (dto.targetMajor !== undefined) data.targetMajor = this.encryptStr(dto.targetMajor);
    if (dto.publicCourseProgress !== undefined) data.publicCourseProgress = dto.publicCourseProgress;
    if (dto.majorCourseProgress !== undefined) data.majorCourseProgress = dto.majorCourseProgress;
    if (dto.mockScores !== undefined) data.mockScores = this.toJsonText(dto.mockScores);
    if (dto.subjectProgress !== undefined) {
      const sp = dto.subjectProgress as Record<string, any>;
      data.subjectProgress = this.toJsonText(sp);
      // 分科进度同步回旧的整体百分比,保证打卡/导师看板等旧链路口径一致
      const summary = summarizeSubjectProgress(sp);
      if (summary) {
        if (summary.publicAvg != null) data.publicCourseProgress = summary.publicAvg;
        if (summary.majorPercent != null) data.majorCourseProgress = summary.majorPercent;
      }
    }
    if (dto.examTotal !== undefined) data.examTotal = dto.examTotal;
    if (dto.examPolitics !== undefined) data.examPolitics = dto.examPolitics;
    if (dto.examEnglish !== undefined) data.examEnglish = dto.examEnglish;
    if (dto.examMath !== undefined) data.examMath = dto.examMath;
    if (dto.examMajor !== undefined) data.examMajor = dto.examMajor;
    if (dto.reexamProgress !== undefined) data.reexamProgress = dto.reexamProgress;
    if (dto.adjustmentProgress !== undefined) data.adjustmentProgress = dto.adjustmentProgress;
    if (dto.finalResult !== undefined) data.finalResult = dto.finalResult;
    if (dto.finalSchool !== undefined) data.finalSchool = this.encryptStr(dto.finalSchool);
    return this.prisma.progressArchive.upsert({
      where: { studentId },
      update: data,
      create: { studentId, ...data },
    });
  }

  /** 学生:更新个人背景(AI推荐输入维度) */
  async updateMyProfile(studentId: number, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.undergraduateMajor !== undefined) data.undergraduateMajor = dto.undergraduateMajor;
    if (dto.gpa !== undefined) data.gpa = dto.gpa;
    if (dto.majorRank !== undefined) data.majorRank = dto.majorRank;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.schoolTierPref !== undefined) data.schoolTierPref = dto.schoolTierPref;
    if (dto.strongSubjects !== undefined) data.strongSubjects = dto.strongSubjects;
    if (dto.weakSubjects !== undefined) data.weakSubjects = dto.weakSubjects;
    if (dto.careerIntention !== undefined) data.careerIntention = dto.careerIntention;
    if (dto.remainingMonths !== undefined) data.remainingMonths = dto.remainingMonths;
    return this.prisma.studentProfile.upsert({
      where: { userId: studentId },
      update: data,
      create: { userId: studentId, currentStage: 'NOT_STARTED', ...data },
    });
  }

  /** 学生:手动切换当前阶段(也可由打卡自动触发) */
  async updateMyStage(studentId: number, dto: UpdateStageDto) {
    const stage = dto.stage;
    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { userId: studentId },
        data: { currentStage: stage },
      });
      await tx.progressHistory.create({
        data: {
          studentId,
          stage,
          snapshot: JSON.stringify({ note: dto.note ?? null, at: new Date().toISOString() }),
        },
      });
    });
    await this.opLog.record(studentId, 'update_stage', 'progress', { stage, note: dto.note });
    return { ok: true, stage };
  }

  /** 导师端:查看某学生完整档案 */
  async getStudentArchive(studentId: number) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        department: { select: { name: true } },
        major: { select: { name: true } },
        class: { select: { name: true } },
        studentProfile: true,
        progressArchive: true,
      },
    });
    if (!student) throw new NotFoundException('学生不存在');
    const [history, checkins, recommendations, helpApplications] = await Promise.all([
      this.prisma.progressHistory.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.checkInRecord.findMany({
        where: { studentId },
        orderBy: { weekStart: 'desc' },
        take: 52,
      }),
      this.prisma.aIRecommendation.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.helpApplication.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { records: true },
      }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = student;
    // 解密敏感字段供导师查看
    if (rest.progressArchive) {
      rest.progressArchive = this.decryptArchive(rest.progressArchive) as any;
    }
    // 指导老师(该生的专业导师 + 辅导员)与统一时间线
    const advisors = await this.resolveAdvisors({
      majorName: student.majorName,
      majorId: student.majorId,
      classId: student.classId,
    });
    const timeline = this.buildTimeline(history, checkins);
    return {
      student: rest,
      history,
      checkins,
      recommendations,
      helpApplications,
      advisors,
      timeline,
    };
  }

  /** 学生:我的关键节点提醒 */
  async getKeyNodes() {
    const now = new Date();
    return this.prisma.keyNodeReminder.findMany({
      where: { enabled: true },
      orderBy: { remindAt: 'asc' },
    });
  }

  // ============ 私有:敏感字段加解密 ============

  private encryptStr(val: string | null | undefined): string | null {
    if (!val) return null;
    return CryptoUtil.encrypt(val);
  }

  /** 解密档案中的 PII 敏感字段(目标院校/专业/录取院校) */
  private decryptArchive(archive: any): any {
    if (!archive) return archive;
    const decrypted = { ...archive };
    for (const f of SENSITIVE_ARCHIVE_FIELDS) {
      if (decrypted[f] && typeof decrypted[f] === 'string') {
        const raw = decrypted[f] as string;
        // 仅对加密格式(含冒号分隔的 iv:tag:ciphertext)尝试解密
        if (raw.includes(':') && raw.split(':').length === 3) {
          try {
            decrypted[f] = CryptoUtil.decrypt(raw);
          } catch {
            // 可能是未加密的历史数据,保留原值
          }
        }
      }
    }
    // mockScores / subjectProgress 以 JSON 字符串存储,读取时还原为对象
    if (decrypted.mockScores !== undefined) {
      decrypted.mockScores = this.parseJson<Record<string, number>>(decrypted.mockScores, {});
    }
    if (decrypted.subjectProgress !== undefined && decrypted.subjectProgress !== null) {
      decrypted.subjectProgress = this.parseJson<Record<string, unknown>>(decrypted.subjectProgress, {});
    }
    return decrypted;
  }
}
