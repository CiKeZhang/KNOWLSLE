import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditResult } from '../../message-board/dto/message-board.dto';

/**
 * AI 内容审核服务
 * 功能：对用户发布的文字内容进行审核，检测广告、违法违规、不健康内容
 * 策略：
 * 1. 优先调用大模型 API 进行智能审核
 * 2. 若未配置 LLM，则使用本地关键词规则兜底
 * 3. 审核不通过的内容禁止发布
 */
@Injectable()
export class ContentAuditService {
  private readonly logger = new Logger(ContentAuditService.name);

  // 本地关键词黑名单(兜底用)
  // 注意:只保留明确的广告/引流特征词,避免误杀考研正常讨论(如"购买资料""报辅导班""对答案")
  private readonly adKeywords = [
    '加微信', '加vx', '加QQ', 'qq群', '微信群', '扫码', '二维码',
    '代购', '代发', '代考', '代做', '代写', '包过', '保过',
    '卖资料', '点击链接', 'http://', 'https://', 'www.',
    '日结', '刷单', '引流', '关注公众号',
    '保录', '内部资料', '绝密',
  ];

  // 交易意图词(弱特征):单独出现不拦截——考研买书买课是正常讨论
  private readonly tradeWords = [
    '购买', '出售', '转让', '低价', '便宜卖', '包邮', '下单', '优惠', '团购', '拼团',
  ];

  // 与考研无关的商品词:与交易词共现时判定为广告(如"购买中秋月饼")
  private readonly productWords = [
    '月饼', '面膜', '化妆品', '口红', '护肤品', '减肥', '保险', '贷款',
    '手机', '平板', 'ipad', '演唱会', '门票', '球鞋', '水果', '零食',
  ];

  // 学习相关词:出现时不将交易词判定为广告(如"购买复习资料""团购网课")
  private readonly studyWords = [
    '资料', '书', '课', '题', '真题', '讲义', '单词', '笔记',
    '政治', '英语', '数学', '专业课', '复习', '备考',
  ];

  private readonly illegalKeywords = [
    '枪支', '弹药', '毒品', '走私', '洗钱', '诈骗', '赌博', '博彩',
    '色情', '黄图', '约炮', '一夜情', '卖淫', '嫖娼',
    '暴力', '恐怖', '杀人', '自杀', '自残',
    '反动', '颠覆', '分裂国家', '邪教',
  ];

  private readonly unhealthyKeywords = [
    '傻逼', '操你', '草你', '妈的', '狗日', '傻逼', '垃圾人',
    '废物', '滚蛋', '去死', '白痴', '智障',
  ];

  constructor(private readonly config: ConfigService) {}

  /**
   * 审核文字内容
   * @param content 待审核内容
   * @returns 审核结果
   */
  async audit(content: string): Promise<AuditResult> {
    const apiKey = this.config.get<string>('LLM_API_KEY');

    // 优先使用 LLM 智能审核
    if (apiKey) {
      try {
        const result = await this.auditWithLLM(content);
        this.logger.debug(`LLM审核结果: passed=${result.passed}, reason=${result.reason}`);
        return result;
      } catch (e) {
        this.logger.warn(`LLM审核调用失败,降级为关键词审核: ${e?.message ?? ''}`);
      }
    }

    // 兜底:本地关键词审核
    return this.auditWithKeywords(content);
  }

  /**
   * 使用大模型进行智能审核
   */
  private async auditWithLLM(content: string): Promise<AuditResult> {
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const baseUrl = this.config.get<string>('LLM_API_BASE', 'https://open.bigmodel.cn/api/paas/v4');
    const model = this.config.get<string>('LLM_MODEL', 'glm-4-flash');

    const prompt = `你是一个内容审核员。请审核以下用户留言内容,判断是否包含以下违规内容:
1. 广告推广:任何形式的商业广告、引流、联系方式推广(微信、QQ、二维码、链接等)
2. 违法违规:违法犯罪相关内容(毒品、枪支、赌博、诈骗、走私等)
3. 不健康内容:色情、暴力、辱骂、人身攻击、极端言论等
4. 其他违反公序良俗的内容

待审核内容:
"""
${content}
"""

请严格按以下 JSON 格式返回,不要输出其他文字:
{
  "passed": true/false,
  "reason": "如果不通过,说明具体违规原因;如果通过,填空字符串",
  "riskLevel": "low/medium/high",
  "categories": ["ad"/"illegal"/"unhealthy"/"other"]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是严格的内容审核员,只输出JSON格式的审核结果。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as any;
      const text = data?.choices?.[0]?.message?.content ?? '';

      // 尝试解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          passed: result.passed === true,
          reason: result.reason || '',
          riskLevel: result.riskLevel || 'low',
          categories: result.categories || [],
        };
      }

      // 解析失败则默认通过(避免误杀)
      this.logger.warn(`LLM返回格式解析失败,内容: ${text.slice(0, 100)}`);
      return { passed: true, reason: '' };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  /**
   * 本地关键词审核(兜底方案)
   */
  private auditWithKeywords(content: string): AuditResult {
    const lowerContent = content.toLowerCase();
    const foundCategories: string[] = [];
    const reasons: string[] = [];

    // 检查广告关键词
    const adFound = this.adKeywords.filter((k) => lowerContent.includes(k.toLowerCase()));
    if (adFound.length > 0) {
      foundCategories.push('ad');
      reasons.push(`包含广告推广关键词: ${adFound.slice(0, 3).join('、')}`);
    }

    // 组合判定:交易词 + 非学习商品词 → 广告(区分"购买资料"与"购买月饼")
    const tradeFound = this.tradeWords.filter((k) => lowerContent.includes(k.toLowerCase()));
    if (tradeFound.length > 0) {
      const hasStudy = this.studyWords.some((k) => lowerContent.includes(k.toLowerCase()));
      const productFound = this.productWords.filter((k) => lowerContent.includes(k.toLowerCase()));
      if (!hasStudy && productFound.length > 0) {
        foundCategories.push('ad');
        reasons.push(`包含广告推广内容: ${tradeFound[0]}、${productFound[0]}`);
      }
    }

    // 检查违法关键词
    const illegalFound = this.illegalKeywords.filter((k) => lowerContent.includes(k.toLowerCase()));
    if (illegalFound.length > 0) {
      foundCategories.push('illegal');
      reasons.push(`包含违法违规内容: ${illegalFound.slice(0, 3).join('、')}`);
    }

    // 检查不健康关键词
    const unhealthyFound = this.unhealthyKeywords.filter((k) => lowerContent.includes(k.toLowerCase()));
    if (unhealthyFound.length > 0) {
      foundCategories.push('unhealthy');
      reasons.push(`包含不健康内容: ${unhealthyFound.slice(0, 3).join('、')}`);
    }

    if (foundCategories.length > 0) {
      return {
        passed: false,
        reason: reasons.join('; '),
        riskLevel: foundCategories.includes('illegal') ? 'high' : foundCategories.includes('ad') ? 'medium' : 'low',
        categories: foundCategories,
      };
    }

    return { passed: true, reason: '' };
  }
}
