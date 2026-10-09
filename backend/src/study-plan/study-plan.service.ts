import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { StudyStage } from '../common/enums';

interface TaskTemplate {
  task: string;
  subject: string;
  targetHours: number;
}

/**
 * 智能备考计划生成服务
 * 根据学生当前进度节点 + 剩余时间,生成月度/周度学习任务清单,支持手动调整。
 *
 * 生成规则:
 * - BASIC(基础复习):公共课基础+专业课参考书过一遍
 * - STRENGTHENING(强化刷题):真题训练+错题归纳+专业课强化
 * - SPRINT(冲刺):模考+押题+背诵+查漏补缺
 * - REEXAM_PREP(复试准备):专业课笔试+英语口语+综合面试
 * - ADJUSTING(调剂):信息收集+复试准备+多校并行
 */
@Injectable()
export class StudyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: OperationLogService,
  ) {}

  /** 学生:获取/生成本周计划 */
  async getMyWeeklyPlan(studentId: number) {
    const weekKey = this.currentWeekKey();
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: studentId } });
    const stage = profile?.currentStage ?? StudyStage.NOT_STARTED;
    let plan = await this.prisma.studyPlan.findFirst({
      where: { studentId, weekKey },
    });
    if (!plan) {
      // 自动生成
      const tasks = this.generateWeeklyTasks(stage, profile?.remainingMonths);
      plan = await this.prisma.studyPlan.create({
        data: {
          studentId,
          weekKey,
          tasks: tasks as any,
          notes: this.stageNote(stage),
        },
      });
      await this.opLog.record(studentId, 'generate_plan', `plan:${plan.id}`, { weekKey, stage });
    }
    return { ...plan, stage, weekKey };
  }

  /** 学生:获取本月计划 */
  async getMyMonthlyPlan(studentId: number) {
    const monthKey = this.currentMonthKey();
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: studentId } });
    const stage = profile?.currentStage ?? StudyStage.NOT_STARTED;
    let plan = await this.prisma.studyPlan.findFirst({
      where: { studentId, monthKey },
    });
    if (!plan) {
      const tasks = this.generateMonthlyTasks(stage, profile?.remainingMonths);
      plan = await this.prisma.studyPlan.create({
        data: {
          studentId,
          monthKey,
          tasks: tasks as any,
          notes: this.stageNote(stage),
        },
      });
    }
    return { ...plan, stage, monthKey };
  }

  /** 学生:手动调整计划 */
  async updatePlan(studentId: number, planId: number, tasks: any[], notes?: string) {
    const updated = await this.prisma.studyPlan.update({
      where: { id: planId },
      data: { tasks: tasks as any, notes: notes ?? undefined },
    });
    await this.opLog.record(studentId, 'update_plan', `plan:${planId}`, { taskCount: tasks.length });
    return updated;
  }

  /** 学生:勾选任务完成状态 */
  async toggleTask(studentId: number, planId: number, index: number, done: boolean) {
    const plan = await this.prisma.studyPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.studentId !== studentId) {
      throw new Error('计划不存在或无权操作');
    }
    const tasks = plan.tasks as any[];
    if (index < 0 || index >= tasks.length) {
      throw new Error('任务索引越界');
    }
    tasks[index].done = done;
    const updated = await this.prisma.studyPlan.update({
      where: { id: planId },
      data: { tasks: tasks as any },
    });
    return updated;
  }

  /** 学生:重新生成本周计划(覆盖现有) */
  async regenerateWeeklyPlan(studentId: number) {
    const weekKey = this.currentWeekKey();
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: studentId } });
    const stage = profile?.currentStage ?? StudyStage.NOT_STARTED;
    const tasks = this.generateWeeklyTasks(stage, profile?.remainingMonths);
    const existing = await this.prisma.studyPlan.findFirst({
      where: { studentId, weekKey },
    });
    let plan;
    if (existing) {
      plan = await this.prisma.studyPlan.update({
        where: { id: existing.id },
        data: { tasks: tasks as any, notes: this.stageNote(stage) },
      });
    } else {
      plan = await this.prisma.studyPlan.create({
        data: { studentId, weekKey, tasks: tasks as any, notes: this.stageNote(stage) },
      });
    }
    await this.opLog.record(studentId, 'regenerate_plan', `plan:${plan.id}`, { weekKey, stage });
    return { ...plan, stage, weekKey };
  }

  // ============ 私有:任务模板生成 ============

  private generateWeeklyTasks(stage: StudyStage, remainingMonths?: number): TaskTemplate[] {
    const base: Record<StudyStage, TaskTemplate[]> = {
      [StudyStage.NOT_STARTED]: [
        { task: '了解考研流程与关键时间节点', subject: '综合', targetHours: 4 },
        { task: '初步确定目标院校与专业方向', subject: '综合', targetHours: 6 },
        { task: '收集备考资料与参考书目', subject: '综合', targetHours: 4 },
      ],
      [StudyStage.CHOOSING]: [
        { task: '使用 AI 择校工具生成推荐方案', subject: '综合', targetHours: 3 },
        { task: '对比 3-5 所目标院校招生简章与报录比', subject: '综合', targetHours: 6 },
        { task: '与辅导员/专业导师确认最终报考方向', subject: '综合', targetHours: 2 },
        { task: '公共课基础资料准备', subject: '公共课', targetHours: 8 },
      ],
      [StudyStage.BASIC]: [
        { task: '英语:每日精读 1 篇真题阅读+背单词', subject: '英语', targetHours: 10 },
        { task: '政治:基础阶段网课+章节练习', subject: '政治', targetHours: 6 },
        { task: '数学(若考):教材例题+课后习题', subject: '数学', targetHours: 12 },
        { task: '专业课:参考书第一轮通读+笔记整理', subject: '专业课', targetHours: 14 },
      ],
      [StudyStage.STRENGTHENING]: [
        { task: '英语:真题套卷训练(近 10 年)+错题归纳', subject: '英语', targetHours: 10 },
        { task: '政治:强化班+选择题刷题', subject: '政治', targetHours: 8 },
        { task: '数学:真题+模拟题+错题本复盘', subject: '数学', targetHours: 14 },
        { task: '专业课:真题训练+高频考点专项突破', subject: '专业课', targetHours: 14 },
      ],
      [StudyStage.SPRINT]: [
        { task: '全科模考(每周 1 套)+试卷分析', subject: '综合', targetHours: 12 },
        { task: '政治:主观题背诵+时政梳理', subject: '政治', targetHours: 10 },
        { task: '英语:作文模板整理与默写', subject: '英语', targetHours: 6 },
        { task: '数学:押题卷+查漏补缺', subject: '数学', targetHours: 10 },
        { task: '专业课:背诵+模拟答题训练', subject: '专业课', targetHours: 12 },
      ],
      [StudyStage.EXAM_DONE]: [
        { task: '估分并对答案,评估上线情况', subject: '综合', targetHours: 3 },
        { task: '关注国家线/自划线公布信息', subject: '综合', targetHours: 2 },
        { task: '初步准备复试材料(成绩单/个人陈述)', subject: '综合', targetHours: 6 },
      ],
      [StudyStage.REEXAM_PREP]: [
        { task: '专业课笔试:指定教材复习+真题', subject: '专业课', targetHours: 16 },
        { task: '英语口语:自我介绍+常见话题练习', subject: '英语', targetHours: 8 },
        { task: '综合面试:科研经历/毕业论文梳理', subject: '综合', targetHours: 8 },
        { task: '模拟面试(找导师或同学)', subject: '综合', targetHours: 4 },
      ],
      [StudyStage.ADJUSTING]: [
        { task: '收集调剂信息(研招网/院校官网)', subject: '综合', targetHours: 6 },
        { task: '填报调剂志愿(最多 3 个平行)', subject: '综合', targetHours: 4 },
        { task: '准备多校复试(专业课+英语)', subject: '综合', targetHours: 16 },
        { task: '与辅导员沟通调剂策略', subject: '综合', targetHours: 2 },
      ],
      [StudyStage.FINISHED]: [
        { task: '整理录取结果与档案', subject: '综合', targetHours: 2 },
        { task: '为学弟学妹分享备考经验(可选)', subject: '综合', targetHours: 2 },
      ],
    };
    return base[stage] ?? base[StudyStage.NOT_STARTED];
  }

  private generateMonthlyTasks(stage: StudyStage, remainingMonths?: number): TaskTemplate[] {
    // 月度计划:在周计划基础上扩展,增加阶段目标
    const weekly = this.generateWeeklyTasks(stage, remainingMonths);
    const monthly: TaskTemplate[] = [
      { task: `【月度目标】${this.stageNote(stage)}`, subject: '综合', targetHours: 0 },
      ...weekly.map((t) => ({ ...t, targetHours: (t.targetHours || 0) * 4 })),
      { task: '月末复盘:检查各科进度与计划偏差', subject: '综合', targetHours: 4 },
    ];
    return monthly;
  }

  private stageNote(stage: StudyStage): string {
    const notes: Record<StudyStage, string> = {
      [StudyStage.NOT_STARTED]: '准备阶段:重点了解考研流程、确定方向、收集资料。',
      [StudyStage.CHOOSING]: '择校阶段:结合 AI 推荐与导师建议,科学确定目标院校与专业。',
      [StudyStage.BASIC]: '基础复习阶段:打牢各科基础,建立知识框架。',
      [StudyStage.STRENGTHENING]: '强化刷题阶段:以真题为核心,提升解题能力。',
      [StudyStage.SPRINT]: '冲刺阶段:模考+背诵+查漏补缺,稳定发挥。',
      [StudyStage.EXAM_DONE]: '初试结束:估分定位,准备复试或调剂。',
      [StudyStage.REEXAM_PREP]: '复试备战:专业课+英语口语+综合面试全面准备。',
      [StudyStage.ADJUSTING]: '调剂阶段:信息收集+多校复试并行。',
      [StudyStage.FINISHED]: '考研结束:整理结果,分享经验。',
    };
    return notes[stage] ?? '';
  }

  private currentWeekKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const diff = (now.getTime() - start.getTime()) / 86400000;
    const week = Math.ceil((diff + start.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
