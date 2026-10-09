import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { AiRecommendInputDto } from './dto/ai.dto';
import { SchoolTier } from '../common/enums';

export interface RecommendationItem {
  itemId: string;
  tier: '冲刺' | '稳妥' | '保底';
  schoolId: number;
  schoolName: string;
  majorName: string;
  matchScore: number;           // 0-100
  probOfAdmission: number;      // 0-100 上岸概率预估
  difficulty: '高' | '中' | '低';
  reasons: string[];
  risks: string[];
  examSubjects?: string[];
  enrollCount?: number;
  reexamLine?: number;
}

export interface RecommendationResult {
  items: RecommendationItem[];
  summary: string;            // 规则算法生成的简要总结
  llmSummary?: string;        // 大模型生成的自然语言解释(若配置)
  inputParams: AiRecommendInputDto;
}

/**
 * AI 择校择专业助手
 * 混合方案:
 * 1) 规则+加权算法:专业相关性、历年录取数据、学生自身条件三大维度加权
 * 2) 大模型 API(可选):对规则结果生成自然语言解释,提升可解释性
 *
 * 规格要求:可解释、可校准、支持学院优先推荐院校
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly opLog: OperationLogService,
  ) {}

  async recommend(studentId: number, input: AiRecommendInputDto): Promise<RecommendationResult> {
    if (input.undergraduateMajor?.trim() === '' || !input.undergraduateMajor) {
      throw new BadRequestException('请填写本科专业');
    }

    // 1) 拉取院校专业候选池
    const candidates = await this.prisma.majorProgram.findMany({
      include: { school: true },
      where: input.targetMajor
        ? { majorName: { contains: input.targetMajor } }
        : undefined,
      take: 200,
    });

    if (candidates.length === 0) {
      return {
        items: [],
        summary: '当前院校数据库暂无匹配项。建议联系教学管理员补充本院对口升学方向的院校专业数据。',
        inputParams: input,
      };
    }

    // 2) 三大维度加权计算
    const scored: RecommendationItem[] = candidates.map((p) => {
      const { matchScore, probOfAdmission, reasons, risks, difficulty } = this.scoreProgram(p, input);
      const tier = this.classifyTier(matchScore, probOfAdmission);
      return {
        itemId: `${p.id}`,
        tier,
        schoolId: p.schoolId,
        schoolName: p.school.name,
        majorName: p.majorName,
        matchScore,
        probOfAdmission,
        difficulty,
        reasons,
        risks,
        examSubjects: (p.examSubjects as string[]) ?? undefined,
        enrollCount: p.enrollCount2025 ?? p.enrollCount2024,
        reexamLine: p.reexamLine2025 ?? p.reexamLine2024,
      };
    });

    // 3) 学院定制:优先推荐院校加权
    const collegeAlignedBoost = await this.getCollegeAlignBoost();
    for (const item of scored) {
      const boost = collegeAlignedBoost.get(item.schoolId);
      if (boost) {
        item.matchScore = Math.min(100, item.matchScore + boost);
        item.reasons.push('学院优先推荐方向(本院对口升学)');
      }
    }

    // 4) 分档:冲刺 / 稳妥 / 保底,每档至少 3 个(候选不足则按实际)
    const sorted = scored.sort((a, b) => b.matchScore - a.matchScore);
    const tiers = {
      '冲刺': sorted.filter((s) => s.tier === '冲刺').slice(0, 3),
      '稳妥': sorted.filter((s) => s.tier === '稳妥').slice(0, 3),
      '保底': sorted.filter((s) => s.tier === '保底').slice(0, 3),
    };
    // 若某档不足,从相邻档补
    const flat = [...tiers['冲刺'], ...tiers['稳妥'], ...tiers['保底']];
    if (flat.length < 9) {
      const used = new Set(flat.map((f) => f.itemId));
      const rest = sorted.filter((s) => !used.has(s.itemId));
      for (const r of rest) {
        if (flat.length >= 9) break;
        flat.push(r);
      }
    }

    // 5) 生成规则总结
    const summary = this.buildRuleSummary(input, flat);

    // 6) 大模型自然语言解释(若配置了 LLM API)
    let llmSummary: string | undefined;
    const apiKey = this.config.get<string>('LLM_API_KEY');
    if (apiKey && flat.length > 0) {
      try {
        llmSummary = await this.callLlmForSummary(input, flat);
      } catch (e) {
        this.logger.warn(`大模型生成失败,使用规则总结兜底: ${e?.message ?? ''}`);
        llmSummary = undefined;
      }
    }

    // 7) 持久化
    const record = await this.prisma.aIRecommendation.create({
      data: {
        studentId,
        inputParams: input as any,
        result: { items: flat } as any,
        llmSummary,
      },
    });
    await this.opLog.record(studentId, 'ai_recommend', `recommendation:${record.id}`, {
      itemCount: flat.length,
    });

    return {
      items: flat,
      summary,
      llmSummary,
      inputParams: input,
    };
  }

  /** 学生:查看历史推荐记录 */
  async myRecommendations(studentId: number, limit = 10) {
    return this.prisma.aIRecommendation.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** 导师:对推荐结果人工校准 */
  async mentorFeedback(
    recommendationId: number,
    mentorId: number,
    itemId: string,
    comment: string,
  ) {
    const rec = await this.prisma.aIRecommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!rec) throw new BadRequestException('推荐记录不存在');
    const fb = await this.prisma.aIRecommendationFeedback.create({
      data: { recommendationId, mentorId, itemId, comment },
    });
    await this.opLog.record(mentorId, 'ai_feedback', `rec:${recommendationId}`, {
      itemId,
      comment,
    });
    return fb;
  }

  // ============ 私有:打分核心 ============

  /**
   * 三大维度加权打分:
   * - 专业相关性 35%(本科专业 vs 目标专业;同专业 35、同大类 25、跨专业 10)
   * - 历年录取数据 35%(复试线相对学生水平的距离、招生人数、报录比)
   * - 学生自身条件 30%(绩点、专业排名、院校层次偏好匹配、剩余时长充裕度)
   */
  private scoreProgram(
    p: { majorName: string; enrollCount2025?: number | null; enrollCount2024?: number | null; reexamLine2025?: number | null; reexamLine2024?: number | null; reportRatio2025?: any; examSubjects?: any; school: { name: string; tier: SchoolTier; region?: string | null } },
    input: AiRecommendInputDto,
  ): {
    matchScore: number;
    probOfAdmission: number;
    reasons: string[];
    risks: string[];
    difficulty: '高' | '中' | '低';
  } {
    const reasons: string[] = [];
    const risks: string[] = [];

    // ----- 维度 1:专业相关性 35 -----
    let relScore = 10;
    if (input.undergraduateMajor === p.majorName) {
      relScore = 35;
      reasons.push(`本科专业(${input.undergraduateMajor})与目标专业完全对口`);
    } else if (this.sameMajorFamily(input.undergraduateMajor, p.majorName)) {
      relScore = 25;
      reasons.push(`本科专业与目标专业属于同一学科大类,基础可迁移`);
    } else {
      relScore = 12;
      risks.push(`跨专业报考,需评估知识储备差距`);
    }

    // ----- 维度 2:历年录取数据 35 -----
    let dataScore = 18;
    const reexamLine = p.reexamLine2025 ?? p.reexamLine2024 ?? null;
    const enroll = p.enrollCount2025 ?? p.enrollCount2024 ?? null;
    if (reexamLine !== null) {
      // 复试线越低对一般学生越友好;但要看学生水平
      // 此处简化:线 < 330 友好,> 380 偏难
      if (reexamLine < 330) {
        dataScore = 30;
        reasons.push(`复试线 ${reexamLine} 较友好,竞争相对缓和`);
      } else if (reexamLine < 360) {
        dataScore = 24;
        reasons.push(`复试线 ${reexamLine} 处于中等水平`);
      } else if (reexamLine < 380) {
        dataScore = 18;
        risks.push(`复试线 ${reexamLine} 偏高,需稳定发挥`);
      } else {
        dataScore = 10;
        risks.push(`复试线 ${reexamLine} 较高,竞争激烈`);
      }
    } else {
      reasons.push(`该专业暂无近 2 年复试线数据,建议人工核实`);
    }
    if (enroll !== null && enroll >= 30) {
      dataScore += 5;
      reasons.push(`招生人数 ${enroll} 较多,容错空间更大`);
    } else if (enroll !== null && enroll <= 10) {
      dataScore -= 3;
      risks.push(`招生人数 ${enroll} 较少,名额有限`);
    }

    // ----- 维度 3:学生自身条件 30 -----
    let stuScore = 15;
    // 3.1 院校层次偏好匹配
    if (input.schoolTierPref) {
      if (p.school.tier === input.schoolTierPref) {
        stuScore += 8;
        reasons.push(`院校层次(${this.tierLabel(p.school.tier)})符合偏好`);
      } else if (this.tierRank(p.school.tier) <= this.tierRank(input.schoolTierPref)) {
        stuScore += 4;
        reasons.push(`院校层次优于偏好,可作冲刺选项`);
      } else {
        stuScore -= 2;
        risks.push(`院校层次低于偏好,可能影响报考意愿`);
      }
    }
    // 3.2 绩点/专业排名(转化为 0-100 水平参考)
    let ability = 50;
    if (input.gpa) {
      ability = Math.min(100, Math.round((input.gpa / 4) * 70 + 10));
    }
    if (input.majorRank) {
      const m = /(\d+)\/(\d+)/.exec(input.majorRank);
      if (m) {
        const rank = parseInt(m[1], 10);
        const total = parseInt(m[2], 10);
        const topRatio = rank / total;
        ability = Math.max(ability, Math.round(100 - topRatio * 80));
      }
    }
    stuScore += Math.round((ability - 50) / 10); // -5 ~ +5
    reasons.push(`学业水平评估 ${ability}/100`);
    // 3.3 剩余时长充裕度
    if (input.remainingMonths !== undefined) {
      if (input.remainingMonths >= 8) {
        stuScore += 3;
        reasons.push(`备考剩余 ${input.remainingMonths} 月,时间充裕`);
      } else if (input.remainingMonths < 4) {
        stuScore -= 3;
        risks.push(`备考仅剩 ${input.remainingMonths} 月,需高效规划`);
      }
    }
    // 3.4 地区匹配
    if (input.region && p.school.region && p.school.region.includes(input.region)) {
      stuScore += 2;
      reasons.push(`地处意向地区(${p.school.region})`);
    }

    // ----- 汇总 -----
    const matchScore = Math.max(0, Math.min(100, relScore + dataScore + stuScore));
    // 上岸概率 = 匹配分 - 难度修正
    const difficulty: '高' | '中' | '低' =
      reexamLine !== null && reexamLine >= 380 ? '高'
        : reexamLine !== null && reexamLine >= 340 ? '中' : '低';
    const difficultyPenalty = difficulty === '高' ? 15 : difficulty === '中' ? 5 : 0;
    const probOfAdmission = Math.max(5, Math.min(95, matchScore - difficultyPenalty + (ability - 50) / 4));

    return { matchScore, probOfAdmission, reasons, risks, difficulty };
  }

  private classifyTier(matchScore: number, prob: number): '冲刺' | '稳妥' | '保底' {
    const composite = matchScore + prob;
    if (composite >= 130) return '冲刺';
    if (composite >= 100) return '稳妥';
    return '保底';
  }

  /** 简单判断是否同专业大类(经管类示例) */
  private sameMajorFamily(a: string, b: string): boolean {
    const families = [
      ['会计', '财务管理', '审计', '工商管理'],
      ['金融', '金融学', '保险', '投资'],
      ['经济', '经济学', '国际经济', '财政'],
      ['管理', '企业管理', '市场营销', '人力资源'],
    ];
    for (const f of families) {
      const aIn = f.some((k) => a.includes(k));
      const bIn = f.some((k) => b.includes(k));
      if (aIn && bIn) return true;
    }
    return false;
  }

  private tierRank(t: SchoolTier): number {
    return { NINE_EIGHT_FIVE: 4, TWO_ONE_ONE: 3, DOUBLE_FIRST: 2, DOUBLE_NON: 1 }[t];
  }

  private tierLabel(t: SchoolTier): string {
    return { NINE_EIGHT_FIVE: '985', TWO_ONE_ONE: '211', DOUBLE_FIRST: '双一流', DOUBLE_NON: '双非' }[t];
  }

  private async getCollegeAlignBoost(): Promise<Map<number, number>> {
    const schools = await this.prisma.school.findMany({
      select: { id: true, priorityWeight: true },
    });
    const m = new Map<number, number>();
    for (const s of schools) {
      const w = Number(s.priorityWeight ?? 1);
      if (w > 1) m.set(s.id, Math.round((w - 1) * 10));
    }
    return m;
  }

  private buildRuleSummary(input: AiRecommendInputDto, items: RecommendationItem[]): string {
    if (items.length === 0) return '暂无匹配推荐项。';
    const chong = items.filter((i) => i.tier === '冲刺');
    const wen = items.filter((i) => i.tier === '稳妥');
    const bao = items.filter((i) => i.tier === '保底');
    return [
      `基于专业相关性(35%)、历年录取数据(35%)、学生自身条件(30%)三大维度加权计算,`,
      `共筛选出 ${items.length} 个推荐项:冲刺 ${chong.length}、稳妥 ${wen.length}、保底 ${bao.length}。`,
      `每条推荐均附匹配理由、上岸概率、难度提示与风险点,供你与专业导师共同评估。`,
    ].join('');
  }

  /**
   * 调用大模型 API 生成自然语言推荐解释。
   * 使用 OpenAI 兼容接口(智谱 GLM / 通义 / DeepSeek / OpenAI 等)。
   * 注意:仅上传脱敏后的推荐摘要,不上传学生身份信息。
   */
  private async callLlmForSummary(input: AiRecommendInputDto, items: RecommendationItem[]): Promise<string> {
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const baseUrl = this.config.get<string>('LLM_API_BASE', 'https://open.bigmodel.cn/api/paas/v4');
    const model = this.config.get<string>('LLM_MODEL', 'glm-4-flash');
    if (!apiKey) return '';

    const prompt = `你是一位高校考研择校顾问。请基于以下推荐结果(规则算法已加权计算),用简洁中文给出可解释的综合建议(不超过 400 字),覆盖:总体匹配判断、冲刺/稳妥/保底策略、备考重点提示。注意客观、不夸大。
学生背景(脱敏):本科专业=${input.undergraduateMajor},绩点=${input.gpa ?? '未知'},意向地区=${input.region ?? '不限'},偏好层次=${input.schoolTierPref ?? '不限'},剩余备考${input.remainingMonths ?? '未知'}月,就业意向=${input.careerIntention ?? '未知'}。
推荐项(摘要):
${items.slice(0, 6).map((i) => `- ${i.tier} | ${i.schoolName} ${i.majorName} | 匹配${i.matchScore} | 概率${i.probOfAdmission} | 难度${i.difficulty}`).join('\n')}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是高校考研择校顾问,提供客观、可解释的中文建议。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        this.logger.warn(`LLM 接口返回 ${res.status}`);
        return '';
      }
      const data = await res.json() as any;
      return data?.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      this.logger.warn(`LLM 调用异常: ${e?.message ?? ''}`);
      return '';
    }
  }
}
