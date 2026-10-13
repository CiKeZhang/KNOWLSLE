import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { CryptoUtil } from '../common/utils/crypto.util';
import { UpdateArchiveDto, UpdateStageDto, UpdateProfileDto } from './dto/progress.dto';
import { StudyStage } from '../common/enums';

// 需加密存储的敏感字段(学生考研成绩、目标院校等)
const SENSITIVE_ARCHIVE_FIELDS = [
  'targetSchoolName', 'targetMajor', 'finalSchool',
];

// 敏感的初试分数字段(单独处理,因为类型是 number)
const SENSITIVE_EXAM_FIELDS = [
  'examTotal', 'examPolitics', 'examEnglish', 'examMath', 'examMajor',
];

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 学生:查看个人档案(含 profile + archive + 历史轨迹 + 打卡历史) */
  async getMyArchive(studentId: number) {
    const [profile, archive, history, checkins] = await Promise.all([
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
    ]);
    // 解密敏感字段(考研成绩、目标院校)
    const decryptedArchive = archive ? this.decryptArchive(archive) : null;
    // 组装时间线
    const timeline = [
      ...(history.map((h) => ({
        at: h.createdAt,
        stage: h.stage,
        type: 'stage_change' as const,
        snapshot: h.snapshot,
      }))),
      ...(checkins.map((c) => ({
        at: c.weekStart,
        stage: c.stage,
        type: 'checkin' as const,
        studyHours: Number(c.studyHours),
        difficulties: c.difficulties,
      }))),
    ].sort((a, b) => (new Date(b.at).getTime() - new Date(a.at).getTime()));
    return { profile, archive: decryptedArchive, timeline };
  }

  /** 学生:更新档案详情 */
  async updateMyArchive(studentId: number, dto: UpdateArchiveDto) {
    const data: Record<string, unknown> = {};
    // PII 敏感字段加密存储(目标院校/专业/录取院校);初试分数保留 Int 以支持报表聚合查询,由 RBAC + MySQL TDE 保护
    if (dto.targetSchoolName !== undefined) data.targetSchoolName = this.encryptStr(dto.targetSchoolName);
    if (dto.targetMajor !== undefined) data.targetMajor = this.encryptStr(dto.targetMajor);
    if (dto.publicCourseProgress !== undefined) data.publicCourseProgress = dto.publicCourseProgress;
    if (dto.majorCourseProgress !== undefined) data.majorCourseProgress = dto.majorCourseProgress;
    if (dto.mockScores !== undefined) data.mockScores = dto.mockScores;
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
    const stage = dto.stage as StudyStage;
    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { userId: studentId },
        data: { currentStage: stage },
      });
      await tx.progressHistory.create({
        data: {
          studentId,
          stage,
          snapshot: { note: dto.note ?? null, at: new Date().toISOString() },
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
    return {
      student: rest,
      history,
      checkins,
      recommendations,
      helpApplications,
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
    return decrypted;
  }
}
