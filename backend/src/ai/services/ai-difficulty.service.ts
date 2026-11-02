import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 困难分类枚举
 */
export type DifficultyCategory =
  | 'knowledge_gap'  // 知识点卡壳
  | 'time_mgmt'      // 时间不够
  | 'mindset'        // 心态问题
  | 'method'         // 学习方法
  | 'other';         // 其他

export interface DifficultyAnalysis {
  category: DifficultyCategory;
  categoryLabel: string;
  advice: string;
  matchedResourceIds: number[];
  matchedKeywords: string[];
  source: 'llm' | 'rule';  // 分析来源
}

/**
 * 分类标签中文名
 */
export const CATEGORY_LABELS: Record<DifficultyCategory, string> = {
  knowledge_gap: '知识点卡壳',
  time_mgmt: '时间管理',
  mindset: '心态问题',
  method: '学习方法',
  other: '其他',
};

/**
 * AI 备考困难分析服务
 *
 * 策略:
 * 1) 优先调用大模型(若配置了 LLM_API_KEY),输出结构化 JSON(分类/建议/关键词)
 * 2) LLM 不可用或失败时,用关键词规则兜底,保证链路始终可用
 * 3) 用提取的关键词匹配 Resource 表,返回相关复习资源
 */
@Injectable()
export class AiDifficultyService {
  private readonly logger = new Logger(AiDifficultyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 分析学生提交的备考困难,返回分类 + 建议 + 匹配资源
   */
  async analyze(
    difficulties: string,
    options?: { majorName?: string; stage?: string },
  ): Promise<DifficultyAnalysis> {
    const text = (difficulties || '').trim();
    if (!text) {
      return this.buildEmpty();
    }

    // 1) 尝试 LLM 分析
    const apiKey = this.config.get<string>('LLM_API_KEY');
    if (apiKey) {
      try {
        const llmResult = await this.analyzeWithLlm(text, options);
        if (llmResult) {
          const matchedResourceIds = await this.matchResources(llmResult.keywords, options?.majorName);
          return {
            category: llmResult.category,
            categoryLabel: CATEGORY_LABELS[llmResult.category],
            advice: llmResult.advice,
            matchedResourceIds,
            matchedKeywords: llmResult.keywords,
            source: 'llm',
          };
        }
      } catch (e) {
        this.logger.warn(`LLM 困难分析失败,降级规则匹配: ${e?.message ?? ''}`);
      }
    }

    // 2) 规则兜底
    const ruleResult = this.analyzeWithRules(text);
    const matchedResourceIds = await this.matchResources(ruleResult.keywords, options?.majorName);
    return {
      category: ruleResult.category,
      categoryLabel: CATEGORY_LABELS[ruleResult.category],
      advice: ruleResult.advice,
      matchedResourceIds,
      matchedKeywords: ruleResult.keywords,
      source: 'rule',
    };
  }

  // ========================================================================
  // LLM 分析
  // ========================================================================

  private async analyzeWithLlm(
    text: string,
    options?: { majorName?: string; stage?: string },
  ): Promise<{ category: DifficultyCategory; advice: string; keywords: string[] } | null> {
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const baseUrl = this.config.get<string>('LLM_API_BASE', 'https://open.bigmodel.cn/api/paas/v4');
    const model = this.config.get<string>('LLM_MODEL', 'glm-4-flash');
    if (!apiKey) return null;

    const validCategories = Object.keys(CATEGORY_LABELS);
    const prompt = `你是一位高校考研辅导员。请分析学生本周遇到的备考困难,只输出 JSON,不要任何其他文字。

学生背景:专业=${options?.majorName ?? '未知'},当前阶段=${options?.stage ?? '未知'}
困难描述:"${text}"

输出格式:
{
  "category": "${validCategories.join(' | ')}",
  "advice": "针对这个困难的具体可操作建议(50字以内)",
  "keywords": ["关键词1","关键词2"]
}

要求:
1. category 只能是 ${validCategories.join('、')} 之一
2. advice 要具体可操作,不说空话
3. keywords 提取 2-4 个关键词,用于匹配复习资源`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是考研辅导员,只输出 JSON。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        this.logger.warn(`LLM 返回 ${res.status}`);
        return null;
      }
      const data = (await res.json()) as any;
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const parsed = this.parseJsonFromLlm(content);
      if (!parsed || !validCategories.includes(parsed.category)) {
        this.logger.warn(`LLM 输出格式异常: ${content.slice(0, 100)}`);
        return null;
      }
      return {
        category: parsed.category as DifficultyCategory,
        advice: (parsed.advice || '').slice(0, 200),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
      };
    } catch (e) {
      clearTimeout(timer);
      this.logger.warn(`LLM 调用异常: ${e?.message ?? ''}`);
      return null;
    }
  }

  /** 从 LLM 输出中提取 JSON(容错处理 Markdown 代码块) */
  private parseJsonFromLlm(content: string): any | null {
    if (!content) return null;
    // 去掉 markdown 代码块
    const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    // 提取第一个 { ... }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      return null;
    }
  }

  // ========================================================================
  // 规则兜底
  // ========================================================================

  /**
   * 关键词规则匹配分类
   */
  private analyzeWithRules(text: string): { category: DifficultyCategory; advice: string; keywords: string[] } {
    const lower = text.toLowerCase();

    // 规则表:关键词 -> 分类
    const rules: { keywords: string[]; category: DifficultyCategory; advice: string }[] = [
      {
        keywords: ['马原', '毛中特', '史纲', '思修', '政治', '知识点', '看不懂', '难理解', '不会做', '高数', '线代', '概率', '英语', '单词', '阅读', '翻译', '作文', '专业课'],
        category: 'knowledge_gap',
        advice: '建议先回归教材对应章节夯实基础,配合历年真题理解考点,标记薄弱知识点重点突破。',
      },
      {
        keywords: ['时间', '忙', '挤不出', '课程多', '实习', '兼职', '没时间', '顾不上', '进度慢'],
        category: 'time_mgmt',
        advice: '建议用番茄钟拆分学习任务,每天固定 2 小时保底时段,优先保证薄弱科目投入。',
      },
      {
        keywords: ['焦虑', '压力', '心态', '崩', '不想学', '坚持', '迷茫', '崩溃', '累', '抑郁'],
        category: 'mindset',
        advice: '建议适当休息调整节奏,每周安排半天放松时间,必要时联系辅导员或心理咨询。',
      },
      {
        keywords: ['方法', '效率', '记不住', '刷题', '错题', '背诵', '复习', '遗忘', '技巧'],
        category: 'method',
        advice: '建议建立错题本定期回顾,用艾宾浩斯曲线安排复习,同类题型集中练习找规律。',
      },
    ];

    const matched: DifficultyCategory | null = null as any;
    for (const rule of rules) {
      if (rule.keywords.some((k) => lower.includes(k))) {
        return {
          category: rule.category,
          advice: rule.advice,
          keywords: rule.keywords.filter((k) => lower.includes(k)).slice(0, 3),
        };
      }
    }

    return {
      category: 'other',
      advice: '建议联系专业导师沟通具体情况,制定针对性解决方案。',
      keywords: [],
    };
  }

  // ========================================================================
  // 资源匹配
  // ========================================================================

  /**
   * 根据关键词匹配 Resource 表(标题/描述模糊匹配),最多返回 5 个
   */
  async matchResources(keywords: string[], majorName?: string): Promise<number[]> {
    if (!keywords || keywords.length === 0) return [];

    const where: any = { status: 'APPROVED' };
    // 按关键词模糊匹配标题或描述
    where.OR = keywords.map((kw) => ({
      OR: [
        { title: { contains: kw } },
        { description: { contains: kw } },
      ],
    }));
    if (majorName) {
      where.majorName = { contains: majorName };
    }

    try {
      const resources = await this.prisma.resource.findMany({
        where,
        take: 5,
        orderBy: { viewCount: 'desc' },
        select: { id: true },
      });
      return resources.map((r) => r.id);
    } catch (e) {
      this.logger.warn(`资源匹配失败: ${e?.message ?? ''}`);
      return [];
    }
  }

  private buildEmpty(): DifficultyAnalysis {
    return {
      category: 'other',
      categoryLabel: CATEGORY_LABELS.other,
      advice: '',
      matchedResourceIds: [],
      matchedKeywords: [],
      source: 'rule',
    };
  }
}
