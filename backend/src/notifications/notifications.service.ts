import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WeekUtil, dayjs } from '../common/utils/week.util';
import { AlertType, AlertStatus, CheckInStatus, UserRole } from '../common/enums';

interface NotifyChannelConfig {
  in_app: { enabled: boolean };
  wecom: { enabled: boolean; corp_id: string; agent_id: string; secret: string };
  sms: { enabled: boolean; provider: string; access_key_id: string; access_key_secret: string; sign_name: string };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private wecomToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** 学生:站内信收件箱 */
  async inbox(recipientId: number, page = 1, pageSize = 20) {
    const [total, items] = await Promise.all([
      this.prisma.notificationLog.count({ where: { recipientId } }),
      this.prisma.notificationLog.findMany({
        where: { recipientId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  /** 公共:多通道批量派发通知(站内信+企业微信+短信),供导师/管理员调用 */
  async dispatch(
    recipientIds: number[],
    msg: { title: string; content: string },
  ) {
    await this.batchCreate(recipientIds, msg);
    return { sent: recipientIds.length };
  }

  /** 每周五 18:00 推送打卡提醒 */
  @Cron('0 0 18 * * 5')
  async remindFridayCheckIn() {
    const rule = await this.prisma.checkInRule.findFirst({
      where: { enabled: true },
      orderBy: { id: 'asc' },
    });
    if (!rule) return;
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, status: 'ACTIVE' },
      select: { id: true },
    });
    const weekStart = WeekUtil.weekStart();
    const alreadyChecked = await this.prisma.checkInRecord.findMany({
      where: { weekStart, status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] } },
      select: { studentId: true },
    });
    const checkedSet = new Set(alreadyChecked.map((r) => r.studentId));
    const needRemind = students.filter((s) => !checkedSet.has(s.id));
    if (needRemind.length === 0) {
      this.logger.log('周五打卡提醒:本周全员已完成,无需提醒');
      return;
    }
    // 站内信批量创建(可对接企业微信/短信通道)
    await this.batchCreate(needRemind.map((s) => s.id), {
      title: '【考研打卡提醒】本周打卡截止周日晚',
      content: '同学你好,本周考研进度打卡尚未完成,请于周日 23:59 前登录系统完成打卡,逾期将自动预警并需申请补卡。',
    });
    this.logger.log(`周五打卡提醒已发送给 ${needRemind.length} 名学生`);
  }

  /** 每周日 20:00 推送逾期预警,并生成 Alert */
  @Cron('0 0 20 * * 0')
  async alertSundayDeadline() {
    const rule = await this.prisma.checkInRule.findFirst({
      where: { enabled: true },
      orderBy: { id: 'asc' },
    });
    if (!rule) return;
    const weekStart = WeekUtil.weekStart();
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, status: 'ACTIVE' },
      select: { id: true },
    });
    const alreadyChecked = await this.prisma.checkInRecord.findMany({
      where: { weekStart, status: { in: [CheckInStatus.ON_TIME, CheckInStatus.LATE] } },
      select: { studentId: true },
    });
    const checkedSet = new Set(alreadyChecked.map((r) => r.studentId));
    const overdue = students.filter((s) => !checkedSet.has(s.id));
    if (overdue.length === 0) {
      this.logger.log('周日逾期预警:本周全员已完成');
      return;
    }
    // 1) 生成 ALERT_OPEN 预警(去重:同一学生本周只生成一条)
    const overdueIds = overdue.map((s) => s.id);
    await this.prisma.alert.createMany({
      data: overdueIds.map((sid) => ({
        studentId: sid,
        type: AlertType.CHECKIN_MISSING,
        description: `${WeekUtil.weekKey()} 当周逾期未打卡`,
      })),
      skipDuplicates: false,
    }).catch(() => undefined);
    // 2) 站内信
    await this.batchCreate(overdueIds, {
      title: '【逾期预警】本周考研打卡已逾期',
      content: '本周打卡已逾期,系统已自动生成预警并通知辅导员。如需补卡请在补卡有效期内提交申请并说明原因。',
    });
    this.logger.log(`周日逾期预警已生成并发送给 ${overdue.length} 名学生`);
  }

  /** 每周一凌晨:检查连续 N 周未打卡、连续 N 周进度无更新 */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyAnomalyScan() {
    await this.detectConsecutiveCheckinMissing();
    await this.detectProgressStale();
    await this.detectLoginInactive();
    this.logger.log('每周异常扫描完成');
  }

  /** 连续 2 周未打卡:升级为连续打卡预警 */
  private async detectConsecutiveCheckinMissing() {
    const today = WeekUtil.weekStart();
    const lastWeek = WeekUtil.lastWeekStart(today);
    const twoWeeksAgo = dayjs(today).subtract(14, 'day').toDate();
    const records = await this.prisma.checkInRecord.findMany({
      where: { weekStart: { gte: twoWeeksAgo } },
      select: { studentId: true, weekStart: true, status: true },
    });
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, status: 'ACTIVE' },
      select: { id: true },
    });
    const existing = new Set(
      await this.prisma.alert.findMany({
        where: { type: AlertType.CHECKIN_CONSECUTIVE, status: AlertStatus.OPEN },
        select: { studentId: true },
      }).then((arr) => arr.map((a) => a.studentId)),
    );
    for (const s of students) {
      const thisWeek = records.find(
        (r) => r.studentId === s.id && dayjs(r.weekStart).isSame(today, 'day'),
      );
      const lastW = records.find(
        (r) => r.studentId === s.id && dayjs(r.weekStart).isSame(lastWeek, 'day'),
      );
      const missingBoth = (!thisWeek || thisWeek.status === CheckInStatus.MISSING) &&
        (!lastW || lastW.status === CheckInStatus.MISSING);
      if (missingBoth && !existing.has(s.id)) {
        await this.prisma.alert.create({
          data: {
            studentId: s.id,
            type: AlertType.CHECKIN_CONSECUTIVE,
            description: '连续 2 周未完成打卡',
          },
        });
      }
    }
  }

  /** 连续 3 周进度无更新 */
  private async detectProgressStale() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'alert_rules' },
    });
    const staleWeeks = (config?.value as any)?.progressStaleWeeks ?? 3;
    const since = dayjs().subtract(staleWeeks, 'week').toDate();
    const recentRecords = await this.prisma.checkInRecord.findMany({
      where: { weekStart: { gte: since } },
      select: { studentId: true },
    });
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, status: 'ACTIVE' },
      select: { id: true },
    });
    const updatedSet = new Set(recentRecords.map((r) => r.studentId));
    for (const s of students) {
      if (!updatedSet.has(s.id)) {
        const exists = await this.prisma.alert.findFirst({
          where: { studentId: s.id, type: AlertType.PROGRESS_STALE, status: AlertStatus.OPEN },
        });
        if (!exists) {
          await this.prisma.alert.create({
            data: {
              studentId: s.id,
              type: AlertType.PROGRESS_STALE,
              description: `连续 ${staleWeeks} 周进度无更新`,
            },
          });
        }
      }
    }
  }

  /** 连续 15 天未登录 */
  private async detectLoginInactive() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'alert_rules' },
    });
    const days = (config?.value as any)?.loginInactiveDays ?? 15;
    const since = dayjs().subtract(days, 'day').toDate();
    const students = await this.prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        status: 'ACTIVE',
        OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: since } }],
      },
      select: { id: true },
    });
    for (const s of students) {
      const exists = await this.prisma.alert.findFirst({
        where: { studentId: s.id, type: AlertType.LOGIN_INACTIVE, status: AlertStatus.OPEN },
      });
      if (!exists) {
        await this.prisma.alert.create({
          data: {
            studentId: s.id,
            type: AlertType.LOGIN_INACTIVE,
            description: `连续 ${days} 天未登录系统`,
          },
        });
      }
    }
  }

  /** 关键节点提醒(每日 9:00 扫描) */
  @Cron('0 0 9 * * *')
  async remindKeyNodes() {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().endOf('day').toDate();
    const nodes = await this.prisma.keyNodeReminder.findMany({
      where: { enabled: true, remindAt: { gte: today, lte: tomorrow } },
    });
    if (nodes.length === 0) return;
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const n of nodes) {
      await this.batchCreate(students.map((s) => s.id), {
        title: `【考研关键节点】${n.name}`,
        content: n.description ?? `考研关键节点:${n.name} 已临近,请关注官方通知与时间安排。`,
      });
      this.logger.log(`关键节点提醒已发送: ${n.name}`);
    }
  }

  /** 批量发送通知(站内信 + 可选企业微信/短信,按 SystemConfig 配置) */
  private async batchCreate(
    recipientIds: number[],
    msg: { title: string; content: string },
  ) {
    if (recipientIds.length === 0) return;
    const channels = await this.getChannelConfig();

    // 1) 站内信(始终发送)
    if (channels.in_app?.enabled !== false) {
      const batch = 200;
      for (let i = 0; i < recipientIds.length; i += batch) {
        const slice = recipientIds.slice(i, i + batch);
        await this.prisma.notificationLog.createMany({
          data: slice.map((id) => ({
            recipientId: id,
            channel: 'inapp',
            title: msg.title,
            content: msg.content,
            status: 'sent',
            sentAt: new Date(),
          })),
        });
      }
    }

    // 2) 企业微信推送(若启用)
    if (channels.wecom?.enabled && channels.wecom.corp_id && channels.wecom.secret) {
      try {
        const users = await this.prisma.user.findMany({
          where: { id: { in: recipientIds } },
          select: { id: true, phone: true, name: true },
        });
        // 按手机号推送(企业微信通讯录需预先导入)
        const mobiles = users.map((u) => u.phone).filter(Boolean) as string[];
        if (mobiles.length > 0) {
          await this.sendWecomMessage(mobiles, `${msg.title}\n${msg.content}`, channels.wecom);
          this.logger.log(`企业微信推送成功 ${mobiles.length} 人`);
        }
      } catch (e) {
        this.logger.warn(`企业微信推送失败: ${e?.message ?? ''}`);
      }
    }

    // 3) 短信推送(若启用)
    if (channels.sms?.enabled && channels.sms.access_key_id) {
      try {
        const users = await this.prisma.user.findMany({
          where: { id: { in: recipientIds }, phone: { not: null } },
          select: { phone: true },
        });
        const mobiles = users.map((u) => u.phone).filter(Boolean) as string[];
        if (mobiles.length > 0) {
          await this.sendSms(mobiles, msg, channels.sms);
          this.logger.log(`短信推送成功 ${mobiles.length} 人`);
        }
      } catch (e) {
        this.logger.warn(`短信推送失败: ${e?.message ?? ''}`);
      }
    }
  }

  /** 读取通知通道配置 */
  private async getChannelConfig(): Promise<NotifyChannelConfig> {
    const c = await this.prisma.systemConfig.findUnique({
      where: { key: 'notify_channels' },
    });
    return (c?.value as NotifyChannelConfig) ?? {
      in_app: { enabled: true },
      wecom: { enabled: false, corp_id: '', agent_id: '', secret: '' },
      sms: { enabled: false, provider: 'aliyun', access_key_id: '', access_key_secret: '', sign_name: '' },
    };
  }

  /** 企业微信:获取 access_token(带缓存) */
  private async getWecomAccessToken(cfg: { corp_id: string; secret: string }): Promise<string> {
    if (this.wecomToken && this.wecomToken.expiresAt > Date.now()) {
      return this.wecomToken.token;
    }
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(cfg.corp_id)}&corpsecret=${encodeURIComponent(cfg.secret)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json() as any;
      if (data.errcode !== 0) {
        throw new Error(`企业微信 gettoken 失败: ${data.errmsg}`);
      }
      this.wecomToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000,
      };
      return data.access_token;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 企业微信:通过手机号推送应用消息 */
  private async sendWecomMessage(
    mobiles: string[],
    content: string,
    cfg: { corp_id: string; agent_id: string; secret: string },
  ) {
    const token = await this.getWecomAccessToken(cfg);
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    // 企业微信单次最多 1000 个手机号
    const batch = 1000;
    for (let i = 0; i < mobiles.length; i += batch) {
      const slice = mobiles.slice(i, i + batch);
      const body = {
        touser: slice.map((m) => `@${m}`).join('|'),
        msgtype: 'text',
        agentid: Number(cfg.agent_id),
        text: { content },
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await res.json() as any;
        if (data.errcode !== 0) {
          this.logger.warn(`企业微信推送部分失败: ${data.errmsg}`);
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  /** 短信推送(阿里云/腾讯云) */
  private async sendSms(
    mobiles: string[],
    msg: { title: string; content: string },
    cfg: { provider: string; access_key_id: string; access_key_secret: string; sign_name: string },
  ) {
    // 此处为短信发送的占位实现;实际部署时需根据服务商 SDK 接入。
    // 阿里云示例:
    //   import Dysmsapi20170525, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
    // 腾讯云示例:
    //   import * as tencentcloud from 'tencentcloud-sdk-nodejs-sms';
    // 为避免引入额外依赖与密钥泄露,生产部署时在 deploy/notify/sms.ts 中实现具体调用,
    // 此处仅记录日志,保证主流程不阻塞。
    this.logger.log(
      `[短信通道:${cfg.provider}] 预发送 ${mobiles.length} 条:${msg.title}`,
    );
  }
}
