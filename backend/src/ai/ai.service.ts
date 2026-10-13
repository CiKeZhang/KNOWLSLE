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

  // ========================================================================
  // AI 择校 Agent 对话
  // ========================================================================

  /**
   * Agent 可用工具定义
   */
  private readonly agentTools = [
    {
      type: 'function' as const,
      function: {
        name: 'search_schools',
        description: '搜索院校，根据名称、地区、层次等条件查找院校',
        parameters: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '院校名称关键词' },
            region: { type: 'string', description: '所在地区/省份，如北京、上海、江苏' },
            tier: { type: 'string', enum: ['985', '211', '双一流', '双非'], description: '院校层次' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'search_majors',
        description: '搜索院校专业，根据专业名称查找招生专业及录取数据',
        parameters: {
          type: 'object',
          properties: {
            majorName: { type: 'string', description: '专业名称关键词' },
            schoolId: { type: 'number', description: '院校ID（可选，限定在某所院校内搜索）' },
          },
          required: ['majorName'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_school_detail',
        description: '获取某所院校的详细信息，包括层次、地区、官网等',
        parameters: {
          type: 'object',
          properties: {
            schoolId: { type: 'number', description: '院校ID' },
          },
          required: ['schoolId'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'recommend_schools',
        description: '根据学生背景条件（本科专业、绩点、地区偏好等）智能推荐院校专业，分冲刺/稳妥/保底三档',
        parameters: {
          type: 'object',
          properties: {
            undergraduateMajor: { type: 'string', description: '本科专业' },
            gpa: { type: 'number', description: '绩点（满分4）' },
            majorRank: { type: 'string', description: '专业排名，如 5/60' },
            region: { type: 'string', description: '意向地区' },
            schoolTierPref: { type: 'string', enum: ['NINE_EIGHT_FIVE', 'TWO_ONE_ONE', 'DOUBLE_FIRST', 'DOUBLE_NON'], description: '院校层次偏好' },
            remainingMonths: { type: 'number', description: '备考剩余月数' },
            targetMajor: { type: 'string', description: '目标专业（可选）' },
            careerIntention: { type: 'string', description: '就业意向（可选）' },
          },
          required: ['undergraduateMajor'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_student_profile',
        description: '获取当前学生的考研档案信息，包括本科专业、绩点、目标院校、当前阶段等',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
  ];

  /** 获取学生的会话列表 */
  async getChatSessions(studentId: number) {
    return this.prisma.aiChatSession.findMany({
      where: { studentId, status: 'ACTIVE' },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
    });
  }

  /** 获取会话历史消息 */
  async getChatMessages(studentId: number, sessionId: number) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, studentId },
    });
    if (!session) throw new BadRequestException('会话不存在');

    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
      toolResults: m.toolResults ? JSON.parse(m.toolResults) : null,
      createdAt: m.createdAt,
    }));
  }

  /** 创建新会话 */
  async createChatSession(studentId: number, title?: string) {
    const session = await this.prisma.aiChatSession.create({
      data: {
        studentId,
        title: title || '新的择校咨询',
        status: 'ACTIVE',
      },
    });
    return session;
  }

  /** 删除会话 */
  async deleteChatSession(studentId: number, sessionId: number) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, studentId },
    });
    if (!session) throw new BadRequestException('会话不存在');

    await this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { status: 'DELETED' },
    });
    return { success: true };
  }

  /**
   * 发送消息到 Agent（核心对话逻辑）
   * 支持多轮对话 + 工具调用（Function Calling）
   */
  async chatSend(studentId: number, sessionId: number | undefined, message: string) {
    const startTime = Date.now();
    const apiKey = this.config.get<string>('LLM_API_KEY');

    // 1) 获取或创建会话
    let session;
    if (sessionId) {
      session = await this.prisma.aiChatSession.findFirst({
        where: { id: sessionId, studentId, status: 'ACTIVE' },
      });
      if (!session) throw new BadRequestException('会话不存在');
    } else {
      session = await this.prisma.aiChatSession.create({
        data: {
          studentId,
          title: message.slice(0, 20) + (message.length > 20 ? '...' : ''),
          status: 'ACTIVE',
        },
      });
    }

    // 2) 加载历史消息（最近 N 条，控制 token）
    const historyMessages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history = historyMessages.reverse();

    // 3) 保存用户消息
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    // 4) 构建 Agent 消息
    const systemPrompt = `你是一位专业的考研择校顾问 AI 助手，叫"研选小助手"。
你的职责是帮助考研学生选择合适的目标院校和专业。

你可以使用以下工具来获取准确信息：
- search_schools: 搜索院校
- search_majors: 搜索专业及录取数据
- get_school_detail: 获取院校详情
- recommend_schools: 智能推荐院校（分冲刺/稳妥/保底）
- get_student_profile: 获取学生当前的档案信息

回答要求：
1. 客观、专业、不夸大，不做绝对化承诺
2. 涉及院校数据时，优先调用工具获取准确信息，不要编造数据
3. 用简洁清晰的中文回答，适当使用分段和列表
4. 如果学生信息不足，可以主动询问补充
5. 每次回答控制在 300 字以内，除非学生明确要求详细分析
6. 始终保持友好、鼓励的语气

注意：如果需要调用多个工具，可以一次性发起多个工具调用。`;

    const messagesForApi: any[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((m) => m.role !== 'system')
        .map((m) => {
          const msg: any = { role: m.role, content: m.content };
          if (m.toolCalls) {
            msg.tool_calls = JSON.parse(m.toolCalls);
          }
          return msg;
        }),
      { role: 'user', content: message },
    ];

    // 5) 调用 LLM（支持工具调用）
    let assistantReply = '';
    let toolCalls: any[] = [];

    if (apiKey) {
      try {
        const result = await this.callLlmWithTools(messagesForApi);
        assistantReply = result.content;
        toolCalls = result.toolCalls;
      } catch (e) {
        this.logger.warn(`Agent LLM 调用失败: ${e?.message ?? ''}`);
        assistantReply = '抱歉，我暂时无法连接到智能服务，请稍后再试。';
      }
    } else {
      // 未配置 LLM 时的兜底回复
      assistantReply = this.getFallbackReply(message);
    }

    // 6) 如果有工具调用，执行工具并获取结果，再次调用 LLM
    let toolResults: any[] = [];
    if (toolCalls.length > 0) {
      // 保存 assistant 消息（含 tool_calls）
      await this.prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: assistantReply,
          toolCalls: JSON.stringify(toolCalls),
        },
      });

      // 执行所有工具调用
      toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          const result = await this.executeTool(tc.function.name, tc.function.arguments, studentId);
          return {
            tool_call_id: tc.id,
            role: 'tool' as const,
            name: tc.function.name,
            content: JSON.stringify(result),
          };
        }),
      );

      // 将工具结果加入消息列表，再次调用 LLM
      const followUpMessages = [
        ...messagesForApi,
        {
          role: 'assistant',
          content: assistantReply,
          tool_calls: toolCalls,
        },
        ...toolResults.map((tr) => ({
          role: 'tool',
          tool_call_id: tr.tool_call_id,
          content: tr.content,
        })),
      ];

      try {
        const followUpResult = await this.callLlmWithTools(followUpMessages);
        assistantReply = followUpResult.content;
      } catch (e) {
        this.logger.warn(`Agent 二次调用失败: ${e?.message ?? ''}`);
        assistantReply = '抱歉，信息查询暂时遇到问题，请稍后再试。';
      }
    }

    // 7) 保存最终 assistant 回复
    const finalMessage = await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantReply,
        toolResults: toolResults.length > 0 ? JSON.stringify(toolResults.map((r) => ({ toolCallId: r.tool_call_id, result: r.content }))) : null,
        metadata: JSON.stringify({
          durationMs: Date.now() - startTime,
          toolCount: toolCalls.length,
        }),
      },
    });

    // 8) 更新会话最后消息时间
    await this.prisma.aiChatSession.update({
      where: { id: session.id },
      data: { lastMessageAt: new Date() },
    });

    await this.opLog.record(studentId, 'ai_chat', `session:${session.id}`, {
      messageLen: message.length,
      toolCount: toolCalls.length,
    });

    return {
      sessionId: session.id,
      message: {
        id: finalMessage.id,
        role: 'assistant',
        content: assistantReply,
        createdAt: finalMessage.createdAt,
      },
    };
  }

  /**
   * 调用 LLM（支持工具调用）
   */
  private async callLlmWithTools(messages: any[]): Promise<{ content: string; toolCalls: any[] }> {
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const baseUrl = this.config.get<string>('LLM_API_BASE', 'https://open.bigmodel.cn/api/paas/v4');
    const model = this.config.get<string>('LLM_MODEL', 'glm-4-flash');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const body: any = {
        model,
        messages,
        temperature: 0.3,
        max_tokens: 800,
        tools: this.agentTools,
        tool_choice: 'auto',
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json() as any;
      const choice = data?.choices?.[0];
      const message = choice?.message;

      const content = message?.content ?? '';
      const toolCalls = message?.tool_calls ?? [];

      return { content, toolCalls };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  /**
   * 执行 Agent 工具调用
   */
  private async executeTool(name: string, args: any, studentId: number): Promise<any> {
    try {
      switch (name) {
        case 'search_schools':
          return await this.toolSearchSchools(args);
        case 'search_majors':
          return await this.toolSearchMajors(args);
        case 'get_school_detail':
          return await this.toolGetSchoolDetail(args);
        case 'recommend_schools':
          return await this.toolRecommendSchools(args, studentId);
        case 'get_student_profile':
          return await this.toolGetStudentProfile(studentId);
        default:
          return { error: `未知工具: ${name}` };
      }
    } catch (e: any) {
      return { error: e?.message || '工具执行失败' };
    }
  }

  /** 工具：搜索院校 */
  private async toolSearchSchools(args: { keyword?: string; region?: string; tier?: string }) {
    const where: any = {};
    if (args.keyword) {
      where.name = { contains: args.keyword };
    }
    if (args.region) {
      where.OR = [
        { region: { contains: args.region } },
        { province: { contains: args.region } },
        { city: { contains: args.region } },
      ];
    }
    if (args.tier) {
      const tierMap: Record<string, string> = {
        '985': 'TIER_985',
        '211': 'TIER_211',
        '双一流': 'DOUBLE_FIRST_CLASS',
        '双非': 'ORDINARY',
      };
      where.tier = tierMap[args.tier] || args.tier;
    }

    const schools = await this.prisma.school.findMany({
      where,
      take: 15,
      orderBy: { priorityWeight: 'desc' },
      select: {
        id: true,
        name: true,
        tier: true,
        region: true,
        province: true,
        city: true,
        is985: true,
        is211: true,
        isDoubleFirst: true,
      },
    });

    return {
      count: schools.length,
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        tier: s.tier,
        region: s.region || s.province || s.city || '',
        tags: [
          s.is985 ? '985' : null,
          s.is211 ? '211' : null,
          s.isDoubleFirst ? '双一流' : null,
        ].filter(Boolean),
      })),
    };
  }

  /** 工具：搜索专业 */
  private async toolSearchMajors(args: { majorName: string; schoolId?: number }) {
    const where: any = {
      majorName: { contains: args.majorName },
    };
    if (args.schoolId) {
      where.schoolId = args.schoolId;
    }

    const majors = await this.prisma.majorProgram.findMany({
      where,
      take: 15,
      include: { school: { select: { id: true, name: true, tier: true } } },
    });

    return {
      count: majors.length,
      majors: majors.map((m) => ({
        id: m.id,
        schoolId: m.schoolId,
        schoolName: m.school.name,
        majorName: m.majorName,
        majorCode: m.majorCode,
        reexamLine: m.reexamLine2025 ?? m.reexamLine2024 ?? null,
        enrollCount: m.enrollCount2025 ?? m.enrollCount2024 ?? null,
        reportRatio: m.reportRatio2025 ?? m.reportRatio2024 ?? null,
      })),
    };
  }

  /** 工具：获取院校详情 */
  private async toolGetSchoolDetail(args: { schoolId: number }) {
    const school = await this.prisma.school.findUnique({
      where: { id: args.schoolId },
      include: {
        programs: {
          take: 10,
          orderBy: { enrollCount2025: 'desc' },
        },
      },
    });

    if (!school) {
      return { error: '院校不存在' };
    }

    return {
      id: school.id,
      name: school.name,
      code: school.code,
      tier: school.tier,
      region: school.region,
      province: school.province,
      city: school.city,
      is985: school.is985,
      is211: school.is211,
      isDoubleFirst: school.isDoubleFirst,
      website: school.website,
      programCount: school._count?.programs ?? 0,
      topPrograms: school.programs.map((p) => ({
        id: p.id,
        majorName: p.majorName,
        reexamLine: p.reexamLine2025 ?? p.reexamLine2024,
        enrollCount: p.enrollCount2025 ?? p.enrollCount2024,
      })),
    };
  }

  /** 工具：智能推荐院校 */
  private async toolRecommendSchools(args: any, studentId: number) {
    try {
      const result = await this.recommend(studentId, args);
      return {
        total: result.items.length,
        items: result.items.map((i) => ({
          tier: i.tier,
          schoolName: i.schoolName,
          majorName: i.majorName,
          matchScore: i.matchScore,
          probOfAdmission: i.probOfAdmission,
          difficulty: i.difficulty,
          reasons: i.reasons.slice(0, 3),
          risks: i.risks.slice(0, 2),
        })),
        summary: result.summary,
      };
    } catch (e: any) {
      return { error: e?.message || '推荐失败' };
    }
  }

  /** 工具：获取学生档案 */
  private async toolGetStudentProfile(studentId: number) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, majorName: true },
    });

    return {
      name: user?.name,
      undergraduateMajor: profile?.undergraduateMajor || user?.majorName || '',
      gpa: profile?.gpa ? Number(profile.gpa) : null,
      majorRank: profile?.majorRank,
      region: profile?.region,
      schoolTierPref: profile?.schoolTierPref,
      currentStage: profile?.currentStage,
      remainingMonths: profile?.remainingMonths,
      careerIntention: profile?.careerIntention,
      strongSubjects: profile?.strongSubjects ? JSON.parse(profile.strongSubjects) : [],
      weakSubjects: profile?.weakSubjects ? JSON.parse(profile.weakSubjects) : [],
    };
  }

  /**
   * 未配置 LLM 时的兜底回复（简单规则匹配）
   */
  private getFallbackReply(message: string): string {
    const msg = message.toLowerCase();
    if (msg.includes('推荐') || msg.includes('选学校') || msg.includes('择校')) {
      return '你好！我是研选小助手😊\n\n要为你推荐院校，我需要了解一些信息：\n1. 你的本科专业是什么？\n2. 绩点大概多少？\n3. 有想去的地区吗？\n4. 目标专业方向是？\n\n告诉我这些信息，我可以帮你做冲刺/稳妥/保底三档推荐！\n\n💡 提示：配置 LLM API 后可以获得更智能的对话体验。';
    }
    if (msg.includes('学校') || msg.includes('院校')) {
      return '关于院校查询，你可以告诉我：\n- 想找哪个地区的学校？\n- 目标层次（985/211/双一流/双非）？\n- 想考什么专业？\n\n我会帮你查找合适的院校信息！';
    }
    if (msg.includes('专业') || msg.includes('分数线') || msg.includes('录取')) {
      return '想了解专业录取情况，请告诉我：\n1. 目标专业名称\n2. 目标院校（可选）\n\n我会为你查询近年复试线、招生人数、报录比等数据。';
    }
    return '你好！我是研选小助手🎯\n\n我可以帮你：\n- 🔍 搜索院校和专业信息\n- 📊 查询历年录取数据（复试线、报录比）\n- 🎯 智能推荐院校（冲刺/稳妥/保底三档）\n- 💡 提供备考建议\n\n有什么考研择校问题，尽管问我吧！';
  }
}
